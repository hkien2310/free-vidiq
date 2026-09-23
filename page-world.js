/**
 * page-world.js - Chạy trong MAIN world của trang YouTube
 * Truy cập trực tiếp window.ytcfg và window.ytInitialData
 * "Đọc ké" tự động mọi API network và token của YouTube Web
 */

(() => {
  const originalFetch = window.fetch;
  let continuationToken = null;

  // Cache channel stats (subs + medianViews) in memory
  const channelStatsCache = new Map();
  const channelPendingQueue = new Set();
  let isProcessingQueue = false;

  // ponytail: localStorage cache with 24h TTL — survives page reloads, zero extra infra
  const CACHE_KEY = 'ft_channel_cache';
  const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

  function loadDiskCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const entries = JSON.parse(raw);
      const now = Date.now();
      for (const [id, entry] of Object.entries(entries)) {
        if (now - entry.t < CACHE_TTL) {
          channelStatsCache.set(id, { subs: entry.s, medianViews: entry.m });
        }
      }
    } catch (e) {}
  }

  function saveDiskCache() {
    try {
      const out = {};
      const now = Date.now();
      // Also merge existing disk entries we didn't load (from other tabs)
      try {
        const existing = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        for (const [id, entry] of Object.entries(existing)) {
          if (now - entry.t < CACHE_TTL) out[id] = entry;
        }
      } catch (e) {}
      for (const [id, stats] of channelStatsCache) {
        out[id] = { s: stats.subs, m: stats.medianViews, t: now };
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(out));
    } catch (e) {}
  }

  loadDiskCache();

  function getApiKey() {
    return window.ytcfg?.get?.("INNERTUBE_API_KEY") || "";
  }

  function getContext() {
    return window.ytcfg?.get?.("INNERTUBE_CONTEXT") || {
      client: {
        clientName: "WEB",
        clientVersion: window.ytcfg?.get?.("INNERTUBE_CLIENT_VERSION") || "2.20240301.00.00"
      }
    };
  }

  // Luôn ép hl: "en" khi gọi API nội bộ để dữ liệu trả về 100% chuẩn tiếng Anh
  function getEnContext() {
    const raw = getContext();
    return {
      ...raw,
      client: {
        ...(raw.client || {}),
        hl: 'en'
      }
    };
  }

  /**
   * Parse abbreviated view/sub text → number (e.g. "1.1M views" → 1100000)
   */
  function parseAbbreviatedNumber(str) {
    if (!str || typeof str !== 'string') return 0;
    const m = str.replace(/\u00A0/g, ' ').trim().match(/([\d.,]+)\s*([a-zà-ỹ]*)/i);
    if (!m) return 0;
    const u = (m[2] || '').toLowerCase();
    let mult = 1;
    if (/^(b|tỷ|ty)/i.test(u)) mult = 1e9;
    else if (/^(m|tr)/i.test(u)) mult = 1e6;
    else if (/^(k|n)/i.test(u)) mult = 1e3;
    if (mult > 1) return Math.round(parseFloat(m[1].replace(/,/g, '.')) * mult) || 0;
    return parseInt(m[1].replace(/[.,]/g, ''), 10) || 0;
  }

  /**
   * Bóc tách số từ chuỗi subscriber
   */
  function parseSubText(str) {
    if (!str || typeof str !== 'string') return 0;
    const match = str.replace(/\u00A0/g, ' ').match(/([\d\.,]+)\s*([a-zà-ỹ]*)\s*(?:sub|người đăng ký)/i);
    if (!match) return 0;
    const unit = (match[2] || '').toLowerCase();
    const num = parseFloat(match[1].replace(/,/g, '.'));
    if (isNaN(num)) return 0;
    if (unit.startsWith('b') || unit.startsWith('tỷ') || unit.startsWith('ty')) return Math.round(num * 1e9);
    if (unit.startsWith('m') || unit.startsWith('tr')) return Math.round(num * 1e6);
    if (unit.startsWith('k') || unit.startsWith('n')) return Math.round(num * 1e3);
    return Math.round(num);
  }

  /**
   * Bóc tách số lượng subscribers của kênh từ avatar/dialog/hovercard
   */
  function extractSubNumber(obj) {
    if (!obj) return 0;
    
    function search(node, depth = 0) {
      if (!node || depth > 15) return null;
      if (typeof node === 'string') {
        if (/(\d+[\d\.,]*)\s*([kmbntrgtrtriệuỷnghìn]*)\s*(?:sub|người đăng ký)/i.test(node.replace(/\u00A0/g, ' '))) {
          return node;
        }
      } else if (typeof node === 'object') {
        for (const k of Object.keys(node)) {
          const found = search(node[k], depth + 1);
          if (found) return found;
        }
      }
      return null;
    }

    const foundStr = search(obj);
    return parseSubText(foundStr);
  }

  /**
   * Trích xuất subscriber trực tiếp từ channel header response
   */
  function extractChannelSubs(data) {
    if (!data) return 0;
    const header = data.header;
    if (!header) return 0;

    // 1. Classic c4TabbedHeaderRenderer
    const c4Text = header.c4TabbedHeaderRenderer?.subscriberCountText?.simpleText ||
                   header.c4TabbedHeaderRenderer?.subscriberCountText?.runs?.map(r => r.text).join('');
    if (c4Text) {
      const num = parseSubText(c4Text);
      if (num > 0) return num;
    }

    // 2. Modern pageHeaderRenderer / pageHeaderViewModel
    const vm = header.pageHeaderRenderer?.content?.pageHeaderViewModel || header.pageHeaderViewModel;
    const rows = vm?.metadata?.contentMetadataViewModel?.metadataRows || [];
    for (const row of rows) {
      for (const part of (row.metadataParts || [])) {
        const txt = part.text?.content || part.accessibilityLabel || '';
        const num = parseSubText(txt);
        if (num > 0) return num;
      }
    }

    // 3. Fallback tìm kiếm đệ quy
    return extractSubNumber(header);
  }

  /**
   * Extract video view counts from a channel tab content node (recursive walk)
   */
  function extractVideoViews(content) {
    if (!content) return [];
    const results = [];
    function walk(node, d) {
      if (!node || d > 20 || typeof node !== 'object') return;
      // gridVideoRenderer (classic channel Videos tab)
      if (node.gridVideoRenderer) {
        const vr = node.gridVideoRenderer;
        const vt = vr.viewCountText?.simpleText || vr.viewCountText?.runs?.map(r => r.text).join('') || '';
        const v = parseAbbreviatedNumber(vt);
        if (v > 0) results.push(v);
        return;
      }
      // videoRenderer
      if (node.videoRenderer) {
        const vr = node.videoRenderer;
        const vt = vr.viewCountText?.simpleText || vr.shortViewCountText?.simpleText || '';
        const v = parseAbbreviatedNumber(vt);
        if (v > 0) results.push(v);
        return;
      }
      // lockupViewModel (modern 2024+ format)
      if (node.lockupViewModel?.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO') {
        const rows = node.lockupViewModel.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows || [];
        for (const row of rows) {
          for (const p of (row.metadataParts || [])) {
            if (/view/i.test(p.text?.content || '')) {
              const v = parseAbbreviatedNumber(p.text.content);
              if (v > 0) { results.push(v); return; }
            }
          }
        }
        return;
      }
      for (const k of Object.keys(node)) {
        const c = node[k];
        if (Array.isArray(c)) c.forEach(i => walk(i, d + 1));
        else if (typeof c === 'object' && c) walk(c, d + 1);
      }
    }
    walk(content, 0);
    return results;
  }

  /**
   * Calculate median from an array of numbers
   */
  function median(arr) {
    if (arr.length === 0) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
  }

  /**
   * Fetch channel stats: subs + medianViews from Videos tab
   * Returns { subs, medianViews } or null
   */
  async function fetchChannelStats(channelId) {
    if (!channelId || (!channelId.startsWith('UC') && !channelId.startsWith('@'))) return null;
    const apiKey = getApiKey();
    const context = getEnContext();
    const browseUrl = `https://www.youtube.com/youtubei/v1/browse?key=${apiKey}`;
    const headers = { 'Content-Type': 'application/json' };

    try {
      // Request 1: channel page (gets subs from header)
      const res = await originalFetch(browseUrl, {
        method: 'POST', headers,
        body: JSON.stringify({ context, browseId: channelId })
      });
      if (!res.ok) return null;
      const data = await res.json();

      const subs = extractChannelSubs(data);

      // Find Videos tab
      let videoViews = [];
      let videosTabData = null;
      const tabs = data.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
      for (const tab of tabs) {
        const title = (tab.tabRenderer?.title || '').toLowerCase();
        if (title === 'videos') {
          if (tab.tabRenderer?.content) {
            videosTabData = tab.tabRenderer.content;
          } else {
            // Request 2: fetch Videos tab separately
            const params = tab.tabRenderer?.endpoint?.browseEndpoint?.params;
            if (params) {
              try {
                const res2 = await originalFetch(browseUrl, {
                  method: 'POST', headers,
                  body: JSON.stringify({ context, browseId: channelId, params })
                });
                if (res2.ok) {
                  const data2 = await res2.json();
                  for (const t of (data2.contents?.twoColumnBrowseResultsRenderer?.tabs || [])) {
                    if ((t.tabRenderer?.title || '').toLowerCase() === 'videos') {
                      videosTabData = t.tabRenderer?.content;
                      break;
                    }
                  }
                }
              } catch (e) {}
            }
          }
          break;
        }
      }

      if (videosTabData) {
        videoViews = extractVideoViews(videosTabData);

        // Request 3: continuation for more videos (target ~50+)
        if (videoViews.length < 50) {
          const contToken = extractContinuationToken(videosTabData);
          if (contToken) {
            try {
              const res3 = await originalFetch(browseUrl, {
                method: 'POST', headers,
                body: JSON.stringify({ context, continuation: contToken })
              });
              if (res3.ok) {
                const data3 = await res3.json();
                const moreViews = extractVideoViews(data3);
                videoViews = videoViews.concat(moreViews);
              }
            } catch (e) {}
          }
        }
      }

      const medianViews = median(videoViews);
      return { subs: subs || 0, medianViews };
    } catch (e) {
      return null;
    }
  }

  /**
   * Extract continuation token from a tab/response for pagination
   */
  function extractContinuationToken(node) {
    if (!node || typeof node !== 'object') return null;
    if (node.token && node.nextContinuationData) return node.nextContinuationData.continuation;
    if (node.continuationCommand?.token) return node.continuationCommand.token;
    if (node.continuation) return node.continuation;
    // Recursive search for continuationItemRenderer
    function find(obj, depth) {
      if (!obj || depth > 15) return null;
      if (typeof obj !== 'object') return null;
      if (obj.continuationItemRenderer) {
        return obj.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token || null;
      }
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (Array.isArray(v)) {
          for (const item of v) {
            const found = find(item, depth + 1);
            if (found) return found;
          }
        } else if (typeof v === 'object' && v) {
          const found = find(v, depth + 1);
          if (found) return found;
        }
      }
      return null;
    }
    return find(node, 0);
  }

  /**
   * Xử lý hàng đợi lấy stats (subs + medianViews) cho các kênh chưa có
   */
  async function processChannelQueue() {
    if (isProcessingQueue || channelPendingQueue.size === 0) return;
    isProcessingQueue = true;

    while (channelPendingQueue.size > 0) {
      // ponytail: batch 2 instead of 4 — each channel now makes 2 requests (header + videos tab)
      const batch = Array.from(channelPendingQueue).slice(0, 2);
      for (const id of batch) {
        channelPendingQueue.delete(id);
      }

      await Promise.all(batch.map(async (channelId) => {
        try {
          const stats = await fetchChannelStats(channelId);
          if (stats) {
            if (!stats.subs && !stats.medianViews) {
              console.warn(`[Find Trend] ⚠️ ${channelId}: parse returned 0 subs + 0 medianViews — YouTube may have changed format`);
            }
            channelStatsCache.set(channelId, stats);
            saveDiskCache();
            window.dispatchEvent(new CustomEvent('FIND_TREND_RESPONSE', {
              detail: {
                action: 'UPDATE_CHANNEL_SUBS',
                data: { channelId, subs: stats.subs, medianViews: stats.medianViews }
              }
            }));
          } else {
            console.warn(`[Find Trend] ❌ ${channelId}: fetch failed — API may be blocked or changed`);
          }
        } catch (err) {
          console.warn(`[Find Trend] ❌ ${channelId}: error —`, err.message);
        }
      }));

      if (channelPendingQueue.size > 0) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    isProcessingQueue = false;
  }

  /**
   * Trích xuất video từ lockupViewModel (Chuẩn YouTube hiện đại 2024-2026)
   */
  function extractLockupData(lockup) {
    if (!lockup || !lockup.contentId) return null;
    
    // 1. Loại bỏ các item không phải video cá nhân (như Playlist, Radio, Mix)
    if (lockup.contentType && 
        lockup.contentType !== 'LOCKUP_CONTENT_TYPE_VIDEO' && 
        lockup.contentType !== 'LOCKUP_CONTENT_TYPE_SHORTS') {
      return null;
    }

    const videoId = lockup.contentId;
    if (videoId.startsWith('RD') || videoId.startsWith('VL') || videoId.length > 20) {
      return null; // RD là mã YouTube Radio / Mix
    }

    const meta = lockup.metadata?.lockupMetadataViewModel;
    const title = meta?.title?.content || 'No title';

    // 2. Loại bỏ các danh sách kết hợp tự động (Mix - ...)
    if (title.startsWith('Mix - ') || 
        title.startsWith('Danh sách kết hợp - ') || 
        title.startsWith('Bản phối - ')) {
      return null;
    }

    const rows = meta?.metadata?.contentMetadataViewModel?.metadataRows || [];
    let channel = '';
    let channelId = '';
    let viewCountText = '';
    let publishedTimeText = '';

    const allParts = [];
    for (const r of rows) {
      if (Array.isArray(r.metadataParts)) allParts.push(...r.metadataParts);
    }

    for (const part of allParts) {
      const text = part.text?.content || '';
      const a11y = part.accessibilityLabel || '';
      const combined = (text + ' ' + a11y).toLowerCase();

      if (!channel && part.text?.commandRuns?.[0]?.onTap?.innertubeCommand?.browseEndpoint?.browseId) {
        channel = text;
        channelId = part.text.commandRuns[0].onTap.innertubeCommand.browseEndpoint.browseId;
        continue;
      }
      if (!viewCountText && (combined.includes('view') || combined.includes('lượt xem') || /^\d+(\.\d+)?[kmb]?$/i.test(text))) {
        viewCountText = a11y || text;
        continue;
      }
      if (!publishedTimeText && (combined.includes('ago') || combined.includes('trước') || /(second|minute|hour|day|week|month|year|giây|phút|giờ|ngày|tuần|tháng|năm)/i.test(combined))) {
        publishedTimeText = a11y || text;
        continue;
      }
    }

    if (!channel && allParts[0]) channel = allParts[0].text?.content || '';
    if (!channel && meta?.image?.decoratedAvatarViewModel?.a11yLabel) {
      channel = meta.image.decoratedAvatarViewModel.a11yLabel.replace(/^(Chuyển đến kênh|Go to channel)\s*/i, '');
    }
    if (!channelId) {
      channelId = meta?.image?.decoratedAvatarViewModel?.onTap?.innertubeCommand?.browseEndpoint?.browseId ||
                  meta?.image?.avatarStackViewModel?.rendererContext?.commandContext?.onTap?.innertubeCommand?.browseEndpoint?.browseId || '';
    }
    if (!viewCountText && allParts[1]) viewCountText = allParts[1].accessibilityLabel || allParts[1].text?.content || '';
    if (!publishedTimeText && allParts[2]) publishedTimeText = allParts[2].accessibilityLabel || allParts[2].text?.content || '';

    // Thumbnail
    const thumbSources = lockup.contentImage?.thumbnailViewModel?.image?.sources || [];
    const thumbnail = thumbSources.length 
      ? thumbSources[thumbSources.length - 1].url 
      : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    // Thời lượng
    const overlays = lockup.contentImage?.thumbnailViewModel?.overlays || [];
    let durationText = '';
    for (const ov of overlays) {
      const badges = ov.thumbnailBottomOverlayViewModel?.badges || [];
      if (badges[0]?.thumbnailBadgeViewModel?.text) {
        durationText = badges[0].thumbnailBadgeViewModel.text;
        break;
      }
    }

    const isShort = lockup.contentType === 'LOCKUP_CONTENT_TYPE_SHORTS' || 
                    durationText.toLowerCase().includes('short');

    // Số subscriber + medianViews của kênh
    let subs = extractSubNumber(meta?.image || lockup);
    let medianViews = 0;
    if (channelId && channelStatsCache.has(channelId)) {
      const cached = channelStatsCache.get(channelId);
      if (!subs) subs = cached.subs;
      medianViews = cached.medianViews;
    } else if (channelId) {
      channelPendingQueue.add(channelId);
    }

    return {
      videoId,
      title,
      viewCountText,
      publishedTimeText,
      channel,
      channelId,
      thumbnail,
      durationText,
      isShort,
      subs,
      medianViews
    };
  }

  /**
   * Trích xuất thông tin video từ videoRenderer (Fallback định dạng cũ)
   */
  function extractVideoData(vr) {
    if (!vr || !vr.videoId) return null;

    const title = vr.title?.runs?.map(r => r.text).join('') || vr.title?.simpleText || 'No title';
    const viewCountText = vr.viewCountText?.simpleText || 
                          vr.shortViewCountText?.simpleText || 
                          vr.viewCountText?.runs?.map(r => r.text).join('') || '';
    const publishedTimeText = vr.publishedTimeText?.simpleText || 
                              vr.publishedTimeText?.runs?.map(r => r.text).join('') || '';
    const channel = vr.ownerText?.runs?.[0]?.text || 
                    vr.shortBylineText?.runs?.[0]?.text || '';
    const channelId = vr.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || '';
    
    const thumbs = vr.thumbnail?.thumbnails || [];
    const thumbnail = thumbs.length ? thumbs[thumbs.length - 1].url : `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`;
    
    const durationText = vr.lengthText?.simpleText || '';

    let subs = 0;
    let medianViews = 0;
    if (channelId && channelStatsCache.has(channelId)) {
      const cached = channelStatsCache.get(channelId);
      subs = cached.subs;
      medianViews = cached.medianViews;
    } else if (channelId) {
      channelPendingQueue.add(channelId);
    }

    return {
      videoId: vr.videoId,
      title,
      viewCountText,
      publishedTimeText,
      channel,
      channelId,
      thumbnail,
      durationText,
      isShort: false,
      subs,
      medianViews
    };
  }

  /**
   * Trích xuất video từ shortsLockupViewModel hoặc reelItemRenderer
   */
  function extractShortsData(item) {
    if (!item) return null;
    
    const lockup = item.shortsLockupViewModel;
    if (lockup) {
      const videoId = lockup.entityId?.replace('shorts-shelf-item-', '') || '';
      const title = lockup.overlayMetadata?.primaryText?.content || '';
      const viewCountText = lockup.overlayMetadata?.secondaryText?.content || '';
      const thumbs = lockup.thumbnail?.sources || [];
      const thumbnail = thumbs.length ? thumbs[thumbs.length - 1].url : (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '');

      return {
        videoId,
        title,
        viewCountText,
        publishedTimeText: 'Recent',
        channel: 'Shorts Creator',
        channelId: '',
        thumbnail,
        durationText: 'Shorts',
        isShort: true
      };
    }

    const reel = item.reelItemRenderer;
    if (reel && reel.videoId) {
      const title = reel.headline?.simpleText || '';
      const viewCountText = reel.viewCountText?.simpleText || '';
      const thumbs = reel.thumbnail?.thumbnails || [];
      const thumbnail = thumbs.length ? thumbs[thumbs.length - 1].url : `https://i.ytimg.com/vi/${reel.videoId}/hqdefault.jpg`;

      return {
        videoId,
        title,
        viewCountText,
        publishedTimeText: 'Recent',
        channel: reel.ownerText?.runs?.[0]?.text || '',
        channelId: reel.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || '',
        thumbnail,
        durationText: 'Shorts',
        isShort: true
      };
    }

    return null;
  }

  /**
   * Bộ trích xuất tổng hợp hỗ trợ mọi định dạng
   */
  function extractAnyVideo(content) {
    if (!content) return null;
    if (content.lockupViewModel) return extractLockupData(content.lockupViewModel);
    if (content.videoRenderer) return extractVideoData(content.videoRenderer);
    if (content.shortsLockupViewModel) return extractShortsData(content);
    return null;
  }

  /**
   * Quét toàn bộ video từ dữ liệu trang chủ (ytInitialData)
   */
  function parseHomeFeed(initialData) {
    const videos = [];
    const richGrid = initialData?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.richGridRenderer?.contents;
    
    if (!richGrid || !Array.isArray(richGrid)) return { videos, continuation: null };

    for (const item of richGrid) {
      if (item.richItemRenderer?.content) {
        const v = extractAnyVideo(item.richItemRenderer.content);
        if (v) videos.push(v);
      } else if (item.richSectionRenderer?.content?.richShelfRenderer?.contents) {
        const shelfItems = item.richSectionRenderer.content.richShelfRenderer.contents;
        for (const shelfItem of shelfItems) {
          const v = extractAnyVideo(shelfItem.richItemRenderer?.content || shelfItem);
          if (v) videos.push(v);
        }
      }
      
      const token = item.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
      if (token) continuationToken = token;
    }

    // Kích hoạt nạp subs cho các kênh mới phát hiện
    processChannelQueue();

    return { videos, continuation: continuationToken };
  }

  /**
   * Quét video trực tiếp từ DOM trang chủ (sử dụng thuộc tính .data của Custom Elements)
   * Chạy tức thì khi SPA navigate từ search về home mà ytInitialData không reload
   */
  function parseHomeFeedFromDOM() {
    const videos = [];
    const items = document.querySelectorAll('ytd-rich-item-renderer');
    for (const item of items) {
      const content = item.data?.content;
      if (content) {
        const v = extractAnyVideo(content);
        if (v) videos.push(v);
      }
    }
    processChannelQueue();
    return { videos, continuation: continuationToken };
  }

  /**
   * Quét video từ trang search results (ytInitialData)
   */
  function parseSearchResults(initialData) {
    const videos = [];
    const sections = initialData?.contents?.twoColumnSearchResultsRenderer
      ?.primaryContents?.sectionListRenderer?.contents || [];

    for (const section of sections) {
      const items = section.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const v = extractAnyVideo(item);
        if (v) videos.push(v);
      }
      const token = section.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
      if (token) continuationToken = token;
    }

    processChannelQueue();
    return { videos, continuation: continuationToken };
  }

  /**
   * Phân tích và trích xuất video từ một payload response của YouTube Browse API
   */
  function parseBrowseResponse(data) {
    const newVideos = [];
    const actions = data?.onResponseReceivedActions || data?.onResponseReceivedCommands || [];

    for (const action of actions) {
      const items = action.appendContinuationItemsAction?.continuationItems || 
                    action.reloadContinuationItemsCommand?.continuationItems || [];
      
      for (const item of items) {
        // Homepage format
        if (item.richItemRenderer?.content) {
          const v = extractAnyVideo(item.richItemRenderer.content);
          if (v) newVideos.push(v);
        }
        // Search results format
        else if (item.itemSectionRenderer?.contents) {
          for (const sub of item.itemSectionRenderer.contents) {
            const v = extractAnyVideo(sub);
            if (v) newVideos.push(v);
          }
        }
        else if (item.richSectionRenderer?.content?.richShelfRenderer?.contents) {
          const shelfItems = item.richSectionRenderer.content.richShelfRenderer.contents;
          for (const shelfItem of shelfItems) {
            const v = extractAnyVideo(shelfItem.richItemRenderer?.content || shelfItem);
            if (v) newVideos.push(v);
          }
        }

        const token = item.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
        if (token) continuationToken = token;
      }
    }

    // Kích hoạt nạp subs cho các kênh mới phát hiện
    processChannelQueue();

    return newVideos;
  }

  /**
   * MONKEYPATCH window.fetch: "ĐỌC KÉ" TOÀN BỘ API NỘI BỘ YOUTUBE TRÊN WEB
   * Bất cứ khi nào YouTube cuộn trang hoặc nạp thêm, ta tự động bắt data
   */
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
      if (url.includes('/youtubei/v1/browse') || url.includes('/youtubei/v1/search')) {
        const clone = response.clone();
        clone.json().then(data => {
          const intercepted = parseBrowseResponse(data);
          if (intercepted.length > 0) {
            console.log(`[Find Trend] 📡 Đọc ké thành công ${intercepted.length} video từ API web!`);
            window.dispatchEvent(new CustomEvent('FIND_TREND_RESPONSE', {
              detail: {
                action: 'LOAD_MORE',
                data: { videos: intercepted }
              }
            }));
          }
        }).catch(() => {});
      }
    } catch (err) {}
    return response;
  };

  /**
   * Kích hoạt hành động load more thật trên web YouTube
   */
  function triggerWebLoadMore() {
    console.log('[Find Trend] Kích hoạt load more của trang web thật...');
    
    // 1. Cuộn trang xuống dưới cùng
    const scrollTarget = document.documentElement.scrollHeight || document.body.scrollHeight;
    window.scrollTo({ top: scrollTarget, behavior: 'smooth' });

    // 2. Tìm thẻ continuation của YouTube và cuộn tới nó
    const continuationEl = document.querySelector('ytd-continuation-item-renderer');
    if (continuationEl) {
      continuationEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    // 3. Bắn event scroll để YouTube kích hoạt loader
    window.dispatchEvent(new Event('scroll'));
  }

  // Lắng nghe sự kiện từ Content Script
  window.addEventListener('FIND_TREND_REQUEST', async (e) => {
    const { action, payload, requestId } = e.detail || {};

    if (action === 'INIT_FEED') {
      const isSearch = window.location.pathname === '/results';
      let res = { videos: [], continuation: null };

      if (isSearch) {
        res = parseSearchResults(window.ytInitialData);
      } else {
        // 1. Ưu tiên parse từ ytInitialData nếu có dữ liệu browse của Home
        if (window.ytInitialData?.contents?.twoColumnBrowseResultsRenderer) {
          res = parseHomeFeed(window.ytInitialData);
        }

        // 2. Nếu rỗng (do vừa từ Search về Home bằng SPA), quét thẳng từ DOM của YouTube
        if (res.videos.length === 0) {
          res = parseHomeFeedFromDOM();
        }
      }

      console.log(`[Find Trend] INIT_FEED: isSearch=${isSearch}, result=${res.videos.length} videos`);
      window.dispatchEvent(new CustomEvent('FIND_TREND_RESPONSE', {
        detail: { requestId, action, data: res }
      }));
    } else if (action === 'LOAD_MORE') {
      // 1. Thử gọi trực tiếp API continuation với hl: "en" để nhận video chuẩn tiếng Anh ngay lập tức
      if (continuationToken) {
        try {
          const apiKey = getApiKey();
          const context = getEnContext();
          const res = await originalFetch(`https://www.youtube.com/youtubei/v1/browse?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ context, continuation: continuationToken })
          });
          if (res.ok) {
            const data = await res.json();
            const videos = parseBrowseResponse(data);
            if (videos.length > 0) {
              console.log(`[Find Trend] ⚡ Nạp thành công ${videos.length} video mới trực tiếp từ API tiếng Anh!`);
              window.dispatchEvent(new CustomEvent('FIND_TREND_RESPONSE', {
                detail: { action: 'LOAD_MORE', data: { videos } }
              }));
              return;
            }
          }
        } catch (err) {}
      }

      // 2. Fallback kích hoạt load more của trang web thật nếu không có token
      triggerWebLoadMore();
    }
  });

  console.log('[Find Trend] Injected page-world network interceptor & real loader ready!');
})();
