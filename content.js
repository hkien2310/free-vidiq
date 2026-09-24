/**
 * content.js - Entry content script chạy trên youtube.com
 * Quản lý nút kích hoạt trên header và kết nối Modal với page-world
 */

(() => {
  let modalInstance = null;
  let shadowRoot = null;
  let isInitialized = false;


  /**
   * Tạo Shadow DOM cô lập cho Modal
   */
  function setupModal() {
    if (modalInstance) return modalInstance;

    let host = document.getElementById('find-trend-root');
    if (!host) {
      host = document.createElement('div');
      host.id = 'find-trend-root';
      document.documentElement.appendChild(host);
    }

    shadowRoot = host.attachShadow({ mode: 'open' });
    const cssUrl = chrome.runtime.getURL('ui/styles.css');

    modalInstance = new window.FindTrendModal();
    modalInstance.init(shadowRoot, cssUrl);

    // Xử lý callback Load More
    modalInstance.onLoadMoreCallback = () => {
      sendPageRequest('LOAD_MORE');
    };

    return modalInstance;
  }

  /**
   * Gửi request sang MAIN world (page-world.js)
   */
  function sendPageRequest(action, payload = {}) {
    window.dispatchEvent(new CustomEvent('FIND_TREND_REQUEST', {
      detail: {
        action,
        payload,
        requestId: Date.now() + Math.random()
      }
    }));
  }

  /**
   * Lắng nghe kết quả trả về từ page-world.js
   */
  window.addEventListener('FIND_TREND_RESPONSE', (e) => {
    const { action, data } = e.detail || {};
    if (!modalInstance) return;

    if (action === 'INIT_FEED') {
      if (data && data.videos && data.videos.length) {
        modalInstance.addVideos(data.videos);
      } else {
        scrapeVideosFromDOM();
      }
    } else if (action === 'LOAD_MORE') {
      if (data && data.videos && data.videos.length) {
        modalInstance.addVideos(data.videos);
      } else {
        modalInstance.setLoading(false);
      }
    } else if (action === 'SEARCH') {
      if (data && data.videos) {
        modalInstance.addVideos(data.videos);
      }
      modalInstance.setLoading(false);
    } else if (action === 'UPDATE_CHANNEL_SUBS') {
      if (data && data.channelId) {
        modalInstance.updateChannelSubs(data.channelId, data.subs, data.medianViews);
      }
    }
  });

  /**
   * Cào trực tiếp từ DOM của YouTube (Cả lockupViewModel và videoRenderer)
   */
  function scrapeVideosFromDOM() {
    const videoElements = document.querySelectorAll('ytd-rich-item-renderer, yt-lockup-view-model, ytd-video-renderer');
    const scraped = [];

    videoElements.forEach(el => {
      const link = el.querySelector('a[href*="/watch?v="], a#video-title-link, a#thumbnail');
      const href = link?.getAttribute('href') || '';
      const match = href.match(/[?&]v=([^&]+)/);
      const videoId = match ? match[1] : '';
      if (!videoId || videoId.startsWith('RD')) return;

      const title = el.querySelector('#video-title, h3, a[href*="/watch?v="] span')?.textContent?.trim() || '';
      if (title.startsWith('Mix - ') || title.startsWith('Danh sách kết hợp - ') || title.startsWith('Bản phối - ')) return;
      const channel = el.querySelector('#channel-name a, ytd-channel-name a, [class*="avatar"] a, [class*="channel"]')?.textContent?.trim() || '';
      
      const metaLines = el.querySelectorAll('#metadata-line span, [class*="metadata"] span');
      let viewCountText = '';
      let publishedTimeText = '';
      if (metaLines.length >= 2) {
        viewCountText = metaLines[0]?.textContent?.trim() || '';
        publishedTimeText = metaLines[1]?.textContent?.trim() || '';
      }

      const thumbImg = el.querySelector('img[src*="ytimg.com"], yt-image img, #thumbnail img');
      const thumbnail = thumbImg?.getAttribute('src') || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      const duration = el.querySelector('badge-shape, ytd-thumbnail-overlay-time-status-renderer, [class*="time-status"]')?.textContent?.trim() || '';

      scraped.push({
        videoId,
        title,
        channel,
        viewCountText,
        publishedTimeText,
        thumbnail,
        durationText: duration,
        isShort: href.includes('/shorts/')
      });
    });

    if (scraped.length && modalInstance) {
      modalInstance.addVideos(scraped);
    }
  }

  /**
   * Đảm bảo CSS cho nút Find Trend trên masthead luôn có sẵn trong document.head
   */
  function ensureHeaderStyles() {
    if (document.getElementById('ft-header-btn-style')) return;
    const style = document.createElement('style');
    style.id = 'ft-header-btn-style';
    style.textContent = `
      #find-trend-trigger-btn {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 6px !important;
        background: linear-gradient(135deg, #1e3a8a, #2563eb) !important;
        color: #ffffff !important;
        border: 1px solid rgba(96, 165, 250, 0.4) !important;
        border-radius: 18px !important;
        padding: 0 14px !important;
        height: 36px !important;
        font-size: 13px !important;
        font-weight: 700 !important;
        cursor: pointer !important;
        box-shadow: 0 2px 8px rgba(37, 99, 235, 0.35) !important;
        transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease !important;
        margin-right: 12px !important;
        flex-shrink: 0 !important;
        z-index: 9999 !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        vertical-align: middle !important;
        line-height: 1 !important;
        user-select: none !important;
        -webkit-user-select: none !important;
      }
      #find-trend-trigger-btn:hover {
        transform: scale(1.04) !important;
        box-shadow: 0 4px 14px rgba(37, 99, 235, 0.5) !important;
        background: linear-gradient(135deg, #2563eb, #3b82f6) !important;
      }
      #find-trend-trigger-btn:active {
        transform: scale(0.97) !important;
      }
      #find-trend-trigger-btn span:first-child {
        font-size: 15px !important;
      }
      .ft-channel-badge {
        position: absolute !important;
        top: 8px !important;
        left: 8px !important;
        z-index: 30 !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 5px !important;
        pointer-events: none !important;
        font-family: Roboto, -apple-system, sans-serif !important;
      }
      .ft-badge-chip-vph {
        height: 20px !important;
        display: inline-flex !important;
        align-items: center !important;
        padding: 0 6px !important;
        border-radius: 4px !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        line-height: 1 !important;
        background: rgba(0, 0, 0, 0.8) !important;
        color: #60a5fa !important;
        border: 1px solid rgba(96, 165, 250, 0.35) !important;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5) !important;
      }
      .ft-badge-chip-outlier {
        height: 20px !important;
        display: inline-flex !important;
        align-items: center !important;
        padding: 0 6px !important;
        border-radius: 4px !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        line-height: 1 !important;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5) !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  /**
   * Gắn nút "🔥 Find Trend" vào YouTube masthead header (chỉ trên trang chủ)
   */
  function injectHeaderButton() {
    ensureHeaderStyles();

    const isHome = location.pathname === '/' || location.pathname === '';
    const isSearch = location.pathname === '/results';
    const existingBtn = document.getElementById('find-trend-trigger-btn');

    // Không phải trang chủ hoặc search → ẩn nút nếu có
    if (!isHome && !isSearch) {
      if (existingBtn) existingBtn.style.display = 'none';
      return;
    }

    if (existingBtn && existingBtn.isConnected) {
      existingBtn.style.display = 'inline-flex';
      return;
    }

    const container = document.querySelector('ytd-masthead #end #buttons') || 
                      document.querySelector('ytd-masthead #buttons') ||
                      document.querySelector('ytd-masthead #end') ||
                      document.querySelector('#masthead-container #end');

    if (!container) return;

    let btn = existingBtn;
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'find-trend-trigger-btn';
      btn.className = 'ft-header-btn';
      btn.innerHTML = '<span>🔥</span><span>Find Trend</span>';
      btn.title = 'Khám phá video viral & trending trên YouTube (100% Local)';

      btn.addEventListener('click', () => {
        const modal = setupModal();
        modal.open();

        const currentUrl = location.pathname + location.search;
        if (modal._loadedUrl !== currentUrl || modal.allVideos.length === 0) {
          modal.allVideos = [];
          modal.filteredVideos = [];
          modal._loadedUrl = currentUrl;
          modal.setLoading(true);
          sendPageRequest('INIT_FEED');
        }
      });
    }

    container.prepend(btn);
  }

  /**
   * Kiểm tra xem trang hiện tại có phải trang kênh YouTube không
   */
  function isChannelPage() {
    const p = location.pathname;
    return p.startsWith('/@') || p.startsWith('/channel/') || p.startsWith('/c/') || p.startsWith('/user/');
  }

  /**
   * Tính trung vị của mảng số
   */
  function calculateMedian(arr) {
    if (!arr || !arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
  }

  /**
   * Quét và gắn nhãn VPH + Outlier lên các thumbnail video trên trang kênh
   */
  function scanAndBadgeChannelVideos() {
    ensureHeaderStyles();

    if (!isChannelPage()) {
      document.querySelectorAll('.ft-channel-badge').forEach(b => b.remove());
      return;
    }

    const parser = window.FindTrendParser;
    if (!parser) return;

    const cards = document.querySelectorAll('yt-lockup-view-model, ytd-rich-item-renderer, ytd-grid-video-renderer');
    const videoData = [];
    const seenIds = new Set();

    cards.forEach(card => {
      const link = card.querySelector('a[href*="/watch?v="]');
      const href = link?.getAttribute('href') || '';
      const match = href.match(/[?&]v=([^&]+)/);
      if (!match) return;
      const videoId = match[1];
      if (seenIds.has(videoId)) return;

      let viewText = '', timeText = '';
      card.querySelectorAll('span').forEach(span => {
        if (span.closest('.ft-channel-badge')) return;
        const t = span.textContent.replace(/\u00A0/g, ' ').trim();
        if (!t) return;
        if (!timeText && /(second|minute|hour|day|week|month|year|giây|phút|giờ|ngày|tuần|tháng|năm)\s*(ago|trước)/i.test(t)) {
          timeText = t;
        } else if (!viewText && /^[▷\s]*[\d.,]+\s*([kmbtrtriệuỷnghìn]*)$/i.test(t)) {
          viewText = t.replace(/^[▷\s]+/, '');
        }
      });

      const views = parser.parseViewCount(viewText);
      const hours = parser.parsePublishedHours(timeText) || 24;
      const vph = parser.calculateVPH(views, hours);

      if (views > 0) {
        seenIds.add(videoId);
        videoData.push({ card, videoId, views, vph });
      }
    });

    if (!videoData.length) return;
    const medViews = calculateMedian(videoData.map(v => v.views)) || 1;

    videoData.forEach(v => {
      const outlierVal = v.views / medViews;
      const thumbWrap = v.card.querySelector('yt-thumbnail-view-model, ytd-thumbnail, [class*="content-image"]') || 
                        v.card.querySelector('a[href*="/watch?v="]') || 
                        v.card;

      if (!thumbWrap) return;
      thumbWrap.style.position = 'relative';

      let container = thumbWrap.querySelector('.ft-channel-badge');
      if (!container) {
        container = document.createElement('div');
        container.className = 'ft-channel-badge';

        const vphChip = document.createElement('span');
        vphChip.className = 'ft-badge-chip-vph';

        const outlierChip = document.createElement('span');
        outlierChip.className = 'ft-badge-chip-outlier';

        container.appendChild(vphChip);
        container.appendChild(outlierChip);
        thumbWrap.appendChild(container);
      }

      container.dataset.videoId = v.videoId;

      const vphChip = container.querySelector('.ft-badge-chip-vph');
      const outlierChip = container.querySelector('.ft-badge-chip-outlier');

      if (vphChip) {
        vphChip.textContent = `⚡ ${parser.formatVPH(v.vph)}`;
      }

      if (outlierChip) {
        const isViral = outlierVal >= 3.0;
        const isGood = outlierVal >= 1.5;
        const bg = isViral ? 'rgba(220, 38, 38, 0.9)' : (isGood ? 'rgba(217, 119, 6, 0.9)' : 'rgba(15, 23, 42, 0.85)');
        const border = isViral ? '#ef4444' : (isGood ? '#f59e0b' : 'rgba(255, 255, 255, 0.2)');
        const textColor = (isViral || isGood) ? '#ffffff' : '#cbd5e1';

        outlierChip.style.background = bg;
        outlierChip.style.border = `1px solid ${border}`;
        outlierChip.style.color = textColor;
        outlierChip.textContent = `🔥 ${parser.formatOutlier(outlierVal)}`;
      }
    });
  }

  /**
   * Giám sát thay đổi DOM trên trang kênh để gắn badge khi scroll/load thêm video
   */
  function observeChannelVideos() {
    let timer = null;
    const observer = new MutationObserver(() => {
      if (!isChannelPage()) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(scanAndBadgeChannelVideos, 250);
    });

    const target = document.querySelector('ytd-app') || document.body;
    if (target) {
      observer.observe(target, { childList: true, subtree: true });
    }
  }

  /**
   * Giám sát liên tục ytd-masthead để chống Polymer xóa nút khi re-render
   */
  function observeMasthead() {
    const masthead = document.querySelector('ytd-masthead') || document.body;
    if (!masthead) {
      setTimeout(observeMasthead, 300);
      return;
    }

    let debounceTimer = null;
    const observer = new MutationObserver(() => {
      const btn = document.getElementById('find-trend-trigger-btn');
      if (!btn || !btn.isConnected) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(injectHeaderButton, 100);
      }
    });

    observer.observe(masthead, { childList: true, subtree: true });
  }

  /**
   * Theo dõi sự kiện SPA Navigation của YouTube
   */
  let lastPageUrl = location.href;
  function onNavigate() {
    const newUrl = location.href;
    if (newUrl !== lastPageUrl) {
      // Reset modal data when navigating to a different page
      if (modalInstance) {
        modalInstance.allVideos = [];
        modalInstance.close();
      }
      document.querySelectorAll('.ft-channel-badge').forEach(b => b.remove());
      lastPageUrl = newUrl;
    }
    injectHeaderButton();
    scanAndBadgeChannelVideos();
  }

  function setupNavigationObserver() {
    window.addEventListener('yt-navigate-finish', onNavigate);
    window.addEventListener('yt-page-data-updated', onNavigate);
    window.addEventListener('popstate', onNavigate);
  }

  // Khởi động
  function init() {
    if (isInitialized) return;
    isInitialized = true;
    
    injectHeaderButton();
    observeMasthead();
    setupNavigationObserver();
    observeChannelVideos();
    scanAndBadgeChannelVideos();

    // Auto-open modal trên search page nếu được navigate từ modal search bar
    if (location.pathname === '/results' && sessionStorage.getItem('ft_auto_open')) {
      sessionStorage.removeItem('ft_auto_open');
      setTimeout(() => {
        const modal = setupModal();
        modal.open();
        modal.setLoading(true);
        sendPageRequest('INIT_FEED');
      }, 1500);
    }

    // Vòng lặp kiểm tra trong 5s đầu đề phòng Polymer hydration ghi đè muộn
    let retries = 0;
    const bootInterval = setInterval(() => {
      retries++;
      injectHeaderButton();
      scanAndBadgeChannelVideos();
      if (retries >= 10 && document.getElementById('find-trend-trigger-btn')) {
        clearInterval(bootInterval);
      }
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
