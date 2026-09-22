/**
 * ui/modal.js - Xây dựng và quản lý giao diện Modal Dashboard trực quan với các thanh Range Slider
 * Hỗ trợ Đa ngôn ngữ (Mặc định EN, chuyển đổi nhanh VI) và Tự động nạp Subscriber chạy ngầm
 */

// Thang chia phân đoạn tỉ lệ (Segmented scale)
// Đảm bảo kéo mượt từng step nhỏ (1 phút, 1 ngày, 5K view, 5K sub...)
// trong khi 5 điểm mốc Landmark (0%, 25%, 50%, 75%, 100%) vẫn cố định tuyệt đối

const DURATION_SEGMENTS = [
  [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
  [30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 42, 44, 46, 48, 50, 52, 55, 58, 60],
  [60, 70, 80, 90, 120, null]
];
const DURATION_TICKS = ['≤ 3m', '≤ 15m', '≤ 30m', '≤ 60m', 'Any'];

const TIME_SEGMENTS = [
  [1, 2, 3, 4, 5, 6, 7],
  [7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 25, 28, 30],
  [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90],
  [90, 105, 120, 135, 150, 165, 180]
];
const TIME_TICKS = ['24h', '7d', '30d', '90d', 'Any'];

const VIEW_SEGMENTS = [
  [0, 5000, 10000, 15000, 20000, 25000],
  [25000, 35000, 50000, 65000, 80000, 100000],
  [100000, 150000, 200000, 250000, 300000, 350000, 400000, 500000],
  [500000, 600000, 700000, 800000, 900000, 1000000]
];
const VIEW_TICKS = ['0', '25K', '100K', '500K', '1M+'];

const SUB_SEGMENTS = [
  [5000, 7500, 10000, 15000, 20000, 25000],
  [25000, 35000, 50000, 70000, 85000, 100000],
  [100000, 150000, 200000, 250000, 300000, 400000, 500000],
  [500000, 750000, 1000000, 2000000, null]
];
const SUB_TICKS = ['< 5K', '< 25K', '< 100K', '< 500K', 'Any'];

function posToVal(segments, pos) {
  const num = parseInt(pos, 10);
  if (num >= 100) {
    const lastSeg = segments[segments.length - 1];
    return lastSeg[lastSeg.length - 1];
  }
  if (num <= 0) {
    return segments[0][0];
  }
  const segIndex = Math.min(Math.floor(num / 25), segments.length - 1);
  const seg = segments[segIndex];
  const localRatio = (num - segIndex * 25) / 25;
  const itemIndex = Math.round(localRatio * (seg.length - 1));
  return seg[itemIndex];
}

function valToPos(segments, val) {
  if (val === null) return 100;
  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s];
    const idx = seg.indexOf(val);
    if (idx !== -1) {
      const localRatio = idx / (seg.length - 1);
      return Math.round(s * 25 + localRatio * 25);
    }
  }
  return 100;
}

class FindTrendModal {
  constructor() {
    this.shadowRoot = null;
    this.cssUrl = '';
    this.allVideos = [];
    this.filteredVideos = [];
    this.filters = {
      videoType: 'video',     // Mặc định: 'video' (chỉ video dài), hoặc 'shorts'
      maxDurationMin: null,   // Phút tối đa (null = Mọi độ dài)
      daysAgo: 180,           // 180 = Mọi lúc, hoặc số ngày tối đa
      minViews: 0,            // Lượt xem tối thiểu
      maxSubs: null,          // null = Không giới hạn, hoặc số sub tối đa
      searchTitle: ''
    };
    this.sortBy = 'vph';      // 'vph' | 'outlier' | 'views' | 'newest'
    this.isLoading = false;
    this.onLoadMoreCallback = null;
    this.onSearchCallback = null;
  }

  t(key, params = {}) {
    return window.FindTrendI18n ? window.FindTrendI18n.t(key, params) : key;
  }

  getLang() {
    return window.FindTrendI18n ? window.FindTrendI18n.getLang() : 'en';
  }

  init(shadowRoot, cssUrl) {
    this.shadowRoot = shadowRoot;
    this.cssUrl = cssUrl;
    this.renderSkeleton();
    this.bindEvents();
  }

  renderTicks(labels) {
    const n = labels.length;
    return labels.map((label, i) => {
      let style = '';
      if (i > 0 && i < n - 1) {
        const pct = (i / (n - 1)) * 100;
        style = ` style="left: ${pct}%;"`;
      }
      return `<span data-step-idx="${i}" data-pos="${i * 25}"${style}>${label}</span>`;
    }).join('');
  }

  renderSkeleton() {
    const lang = this.getLang();

    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="${this.cssUrl}">
      <div class="ft-modal-overlay" id="ftOverlay">
        <div class="ft-modal-container">
          <!-- LEFT SIDEBAR: BỘ LỌC RANGE SLIDERS -->
          <aside class="ft-sidebar">
            <div class="ft-sidebar-header">
              <div class="ft-sidebar-title">
                <span class="badge-logo">${this.t('badgeLogo')}</span>
                <span id="ftAppTitle">${this.t('appTitle')}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <button class="ft-btn-close" id="ftCloseSidebarBtn" title="Close">&times;</button>
              </div>
            </div>

            <div class="ft-sidebar-content">
              <!-- 1. ĐỊNH DẠNG VIDEO (MẶC ĐỊNH DÀI, BỎ TẤT CẢ) -->


              <!-- 2. SLIDER: ĐỘ DÀI TỐI ĐA -->
              <div class="ft-slider-card">
                <div class="ft-slider-header">
                  <span class="ft-slider-title">
                    <span>⏱</span>
                    <span>${this.t('maxDuration')}</span>
                  </span>
                  <span class="ft-slider-val" id="ftDurationVal">${this.getDurationLabel(this.filters.maxDurationMin)}</span>
                </div>
                <input type="range" class="ft-slider" id="ftDurationSlider" min="0" max="100" step="1" value="${this.getDurationPos(this.filters.maxDurationMin)}">
                <div class="ft-slider-ticks">
                  ${this.renderTicks(DURATION_TICKS)}
                </div>
              </div>

              <!-- 3. SLIDER: THỜI GIAN ĐĂNG (GẦN ĐÂY) -->
              <div class="ft-slider-card">
                <div class="ft-slider-header">
                  <span class="ft-slider-title">
                    <span>🕒</span>
                    <span>${this.t('publishedDate')}</span>
                  </span>
                  <span class="ft-slider-val" id="ftTimeVal">${this.getTimeLabel(this.filters.daysAgo)}</span>
                </div>
                <input type="range" class="ft-slider" id="ftTimeSlider" min="0" max="100" step="1" value="${this.getTimePos(this.filters.daysAgo)}">
                <div class="ft-slider-ticks">
                  ${this.renderTicks(TIME_TICKS)}
                </div>
              </div>

              <!-- 4. SLIDER: LƯỢT XEM TỐI THIỂU (VIEWS) -->
              <div class="ft-slider-card">
                <div class="ft-slider-header">
                  <span class="ft-slider-title">
                    <span>📈</span>
                    <span>${this.t('minViews')}</span>
                  </span>
                  <span class="ft-slider-val" id="ftViewVal">${this.getViewLabel(this.filters.minViews)}</span>
                </div>
                <input type="range" class="ft-slider" id="ftViewSlider" min="0" max="100" step="1" value="${this.getViewPos(this.filters.minViews)}">
                <div class="ft-slider-ticks">
                  ${this.renderTicks(VIEW_TICKS)}
                </div>
              </div>

              <!-- 5. SLIDER: QUY MÔ KÊNH (SUBSCRIBERS) -->
              <div class="ft-slider-card">
                <div class="ft-slider-header">
                  <span class="ft-slider-title">
                    <span>👥</span>
                    <span>${this.t('channelSubs')}</span>
                  </span>
                  <span class="ft-slider-val" id="ftSubVal">${this.getSubLabel(this.filters.maxSubs)}</span>
                </div>
                <input type="range" class="ft-slider" id="ftSubSlider" min="0" max="100" step="1" value="${this.getSubPos(this.filters.maxSubs)}">
                <div class="ft-slider-ticks">
                  ${this.renderTicks(SUB_TICKS)}
                </div>
              </div>

              <!-- 6. SẮP XẾP ƯU TIÊN -->
              <div class="ft-filter-section">
                <div class="ft-filter-title">
                  <span>🚀</span>
                  <span>${this.t('sortPriority')}</span>
                </div>
                <div class="ft-pill-group" data-group="sortBy">
                  <button class="ft-pill ${this.sortBy === 'vph' ? 'active' : ''}" data-val="vph">${this.t('sortVph')}</button>
                  <button class="ft-pill ${this.sortBy === 'outlier' ? 'active' : ''}" data-val="outlier">${this.t('sortOutlier')}</button>
                  <button class="ft-pill ${this.sortBy === 'views' ? 'active' : ''}" data-val="views">${this.t('sortViews')}</button>
                  <button class="ft-pill ${this.sortBy === 'newest' ? 'active' : ''}" data-val="newest">${this.t('sortNewest')}</button>
                </div>
              </div>
            </div>

            <div class="ft-sidebar-footer">
              <button class="ft-btn-reset" id="ftResetBtn" style="width: 100%;">
                <span>${this.t('resetFilters')}</span>
              </button>
            </div>
          </aside>

          <!-- RIGHT MAIN PANEL -->
          <main class="ft-main">
            <!-- Topbar -->
            <header class="ft-topbar">
              <div class="ft-search-box">
                <span class="ft-search-icon">🔍</span>
                <input type="text" class="ft-search-input" id="ftSearchInput" placeholder="${this.t('searchPlaceholder')}" value="${this.filters.searchTitle}">
              </div>

              <div class="ft-counter" id="ftCounter">${this.t('counter', { filtered: this.filteredVideos.length, total: this.allVideos.length })}</div>

              <button class="ft-btn-loadmore" id="ftLoadMoreBtn">
                <span>${this.isLoading ? this.t('loadingMore') : this.t('loadMore')}</span>
              </button>

              <button class="ft-btn-csv" id="ftCsvBtn" title="${this.t('downloadCsv')}">
                <span>${this.t('downloadCsv')}</span>
              </button>

              <button class="ft-btn-close" id="ftCloseBtn" title="Close">&times;</button>
            </header>

            <!-- Banner info -->
            <div class="ft-banner">
              <div class="ft-banner-left">
                <span class="ft-banner-icon">🎯</span>
                <span class="ft-banner-text">${this.t('bannerTitle')}</span>
              </div>
              <div class="ft-banner-tags">
                <div class="ft-banner-tag">⚡ <span>${this.t('bannerVph')}</span></div>
                <div class="ft-banner-tag">🔥 <span>${this.t('bannerOutlier')}</span></div>
                <div class="ft-banner-tag">🛡️ <span>${this.t('bannerLocal')}</span></div>
              </div>
            </div>

            <!-- Video Grid Area -->
            <div class="ft-grid-container" id="ftGridContainer">
              <div class="ft-video-grid" id="ftVideoGrid"></div>
              <div class="ft-empty-state" id="ftEmptyState" style="display: none;">
                <div class="ft-empty-icon">🔍</div>
                <div class="ft-empty-title">${this.t('emptyTitle')}</div>
                <div class="ft-empty-desc">${this.t('emptyDesc')}</div>
              </div>
            </div>
          </main>
        </div>
      </div>
    `;
  }

  getDurationPos(mins) {
    return valToPos(DURATION_SEGMENTS, mins);
  }
  getDurationIndex(mins) {
    return this.getDurationPos(mins);
  }

  getDurationLabel(mins) {
    if (mins === null) return this.t('anyLength');
    return this.t('minsLessOrEqual', { val: mins });
  }

  getTimePos(days) {
    return valToPos(TIME_SEGMENTS, days);
  }
  getTimeIndex(days) {
    return this.getTimePos(days);
  }

  getTimeLabel(days) {
    if (days >= 180) return this.t('anyTime');
    if (days === 1) return this.t('todayHours');
    return this.t('daysAgo', { val: days });
  }

  getViewPos(views) {
    return valToPos(VIEW_SEGMENTS, views);
  }
  getViewIndex(views) {
    return this.getViewPos(views);
  }

  getViewLabel(views) {
    if (views === 0) return this.t('anyViews');
    const parser = window.FindTrendParser;
    const formatted = parser ? parser.formatCompactNumber(views) : views;
    return this.t('viewsGreaterOrEqual', { val: formatted });
  }

  getSubPos(subs) {
    return valToPos(SUB_SEGMENTS, subs);
  }
  getSubIndex(subs) {
    return this.getSubPos(subs);
  }

  getSubLabel(subs) {
    const parser = window.FindTrendParser;
    if (subs === null) return this.t('anySubs');
    const formatted = parser ? parser.formatCompactNumber(subs) : subs;
    let label = this.t('subsLessThan', { val: formatted });

    const pendingCount = this.allVideos.filter(v => !v.subs && v.channelId).length;
    if (pendingCount > 0) {
      label += ` (${this.t('subsCheckingChannels', { count: pendingCount })})`;
    }
    return label;
  }

  highlightActiveTicks() {
    const root = this.shadowRoot;
    if (!root) return;
    root.querySelectorAll('.ft-slider-card').forEach(card => {
      const slider = card.querySelector('.ft-slider');
      if (!slider) return;
      const currentPos = parseInt(slider.value, 10);
      card.querySelectorAll('.ft-slider-ticks span').forEach(tick => {
        const tickPos = parseInt(tick.dataset.pos, 10);
        const isNear = Math.abs(currentPos - tickPos) <= 1;
        tick.classList.toggle('active', isNear);
      });
    });
  }

  bindEvents() {
    const root = this.shadowRoot;

    // Đóng modal
    const close = () => this.close();
    root.getElementById('ftCloseBtn').addEventListener('click', close);
    root.getElementById('ftCloseSidebarBtn').addEventListener('click', close);
    root.getElementById('ftOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'ftOverlay') close();
    });



    // 2. Slider Độ dài tối đa (step 1 phút)
    const durSlider = root.getElementById('ftDurationSlider');
    const durVal = root.getElementById('ftDurationVal');
    durSlider.addEventListener('input', () => {
      const mins = posToVal(DURATION_SEGMENTS, durSlider.value);
      this.filters.maxDurationMin = mins;
      durVal.textContent = this.getDurationLabel(mins);
      this.highlightActiveTicks();
      this.applyFiltersAndRender();
    });

    // 3. Slider Thời gian đăng (step 1 ngày)
    const timeSlider = root.getElementById('ftTimeSlider');
    const timeVal = root.getElementById('ftTimeVal');
    timeSlider.addEventListener('input', () => {
      const days = posToVal(TIME_SEGMENTS, timeSlider.value);
      this.filters.daysAgo = days;
      timeVal.textContent = this.getTimeLabel(days);
      this.highlightActiveTicks();
      this.applyFiltersAndRender();
    });

    // 4. Slider Lượt xem tối thiểu (Views)
    const viewSlider = root.getElementById('ftViewSlider');
    const viewVal = root.getElementById('ftViewVal');
    viewSlider.addEventListener('input', () => {
      const views = posToVal(VIEW_SEGMENTS, viewSlider.value);
      this.filters.minViews = views;
      viewVal.textContent = this.getViewLabel(views);
      this.highlightActiveTicks();
      this.applyFiltersAndRender();
    });

    // 5. Slider Quy mô kênh (Subscribers)
    const subSlider = root.getElementById('ftSubSlider');
    const subVal = root.getElementById('ftSubVal');
    subSlider.addEventListener('input', () => {
      const subs = posToVal(SUB_SEGMENTS, subSlider.value);
      this.filters.maxSubs = subs;
      subVal.textContent = this.getSubLabel(subs);
      this.highlightActiveTicks();
      this.applyFiltersAndRender();
    });

    // Hỗ trợ click trực tiếp vào nhãn tick để nhảy đến điểm mốc tương ứng
    root.querySelectorAll('.ft-slider-card').forEach(card => {
      const slider = card.querySelector('.ft-slider');
      card.querySelectorAll('.ft-slider-ticks span').forEach(tick => {
        tick.addEventListener('click', () => {
          const pos = tick.dataset.pos;
          if (pos !== undefined) {
            slider.value = pos;
            slider.dispatchEvent(new Event('input'));
          }
        });
      });
    });

    this.highlightActiveTicks();

    // 6. Sắp xếp ưu tiên
    root.querySelectorAll('[data-group="sortBy"] .ft-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        root.querySelectorAll('[data-group="sortBy"] .ft-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.sortBy = pill.dataset.val;
        this.applyFiltersAndRender();
      });
    });

    // 7. Reset bộ lọc
    root.getElementById('ftResetBtn').addEventListener('click', () => {
      this.filters = {
        videoType: 'video',
        maxDurationMin: null,
        daysAgo: 180,
        minViews: 0,
        maxSubs: null,
        searchTitle: ''
      };
      this.sortBy = 'vph';
      root.getElementById('ftSearchInput').value = '';

      // Reset sliders về đúng vị trí mốc
      durSlider.value = String(valToPos(DURATION_SEGMENTS, null));
      durVal.textContent = this.getDurationLabel(null);

      timeSlider.value = String(valToPos(TIME_SEGMENTS, 180));
      timeVal.textContent = this.getTimeLabel(180);

      viewSlider.value = String(valToPos(VIEW_SEGMENTS, 0));
      viewVal.textContent = this.getViewLabel(0);

      subSlider.value = String(valToPos(SUB_SEGMENTS, null));
      subVal.textContent = this.getSubLabel(null);

      this.highlightActiveTicks();

      // Reset Sort pills
      root.querySelectorAll('[data-group="sortBy"] .ft-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.val === 'vph');
      });

      this.applyFiltersAndRender();
    });


    // Tìm kiếm bằng ô Search input
    let searchTimeout = null;
    const searchInput = root.getElementById('ftSearchInput');
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.filters.searchTitle = e.target.value.trim().toLowerCase();
        this.applyFiltersAndRender();
      }, 200);
    });

    // Nút Load more
    root.getElementById('ftLoadMoreBtn').addEventListener('click', () => {
      if (this.isLoading) return;
      if (this.onLoadMoreCallback) {
        this.setLoading(true);
        this.onLoadMoreCallback();
      }
    });

    // Nút Tải CSV
    root.getElementById('ftCsvBtn').addEventListener('click', () => {
      if (window.FindTrendExporter) {
        window.FindTrendExporter.exportVideosToCSV(this.filteredVideos);
      }
    });
  }

  open() {
    const overlay = this.shadowRoot.getElementById('ftOverlay');
    if (overlay) overlay.classList.add('active');
  }

  close() {
    const overlay = this.shadowRoot.getElementById('ftOverlay');
    if (overlay) overlay.classList.remove('active');
  }

  setLoading(loading) {
    this.isLoading = loading;
    const btn = this.shadowRoot.getElementById('ftLoadMoreBtn');
    if (btn) {
      btn.innerHTML = loading ? `<span>${this.t('loadingMore')}</span>` : `<span>${this.t('loadMore')}</span>`;
      btn.style.opacity = loading ? '0.7' : '1';
    }
  }

  addVideos(newVideos) {
    const parser = window.FindTrendParser;
    const existingIds = new Set(this.allVideos.map(v => v.videoId));

    const processed = [];
    for (const v of newVideos) {
      if (!v || !v.videoId || existingIds.has(v.videoId)) continue;
      
      // Loại bỏ hoàn toàn YouTube Mix, Radio hoặc Playlist tự tạo
      if (v.title?.startsWith('Mix - ') || 
          v.title?.startsWith('Danh sách kết hợp - ') || 
          v.title?.startsWith('Bản phối - ') ||
          v.videoId?.startsWith('RD') ||
          v.thumbnail?.includes('skeleton') ||
          (!v.viewCountText && !v.publishedTimeText)) {
        continue;
      }

      existingIds.add(v.videoId);

      const views = parser ? parser.parseViewCount(v.viewCountText) : 0;
      const hoursAgo = parser ? parser.parsePublishedHours(v.publishedTimeText) : 24;
      const vph = parser ? parser.calculateVPH(views, hoursAgo) : 0;
      const durationSec = parser ? parser.parseDurationSeconds(v.durationText) : 0;

      processed.push({
        ...v,
        views,
        hoursAgo,
        vph,
        durationSec,
        subs: v.subs || null,
        outlier: 1.0,
        originalIndex: this.allVideos.length + processed.length
      });
    }

    this.allVideos = [...this.allVideos, ...processed];

    // Tính median VPH của toàn bộ danh sách
    const vphList = this.allVideos.map(v => v.vph).filter(v => v > 0).sort((a, b) => a - b);
    const medianVPH = vphList.length ? vphList[Math.floor(vphList.length / 2)] : 10;

    for (const v of this.allVideos) {
      v.outlier = parser ? parser.calculateOutlierScore(v, medianVPH) : 1.0;
    }

    this.setLoading(false);
    this.applyFiltersAndRender();
    this.updateSubValText();
  }

  /**
   * Nhận cập nhật số subscriber từ background queue
   */
  updateChannelSubs(channelId, subs, medianViews) {
    let hasChanges = false;
    for (const v of this.allVideos) {
      if (v.channelId === channelId) {
        if (subs) v.subs = subs;
        if (medianViews) v.medianViews = medianViews;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      const parser = window.FindTrendParser;
      if (parser) {
        const vphList = this.allVideos.map(v => v.vph).filter(n => n > 0).sort((a, b) => a - b);
        const medianVPH = vphList.length ? vphList[Math.floor(vphList.length / 2)] : 10;
        for (const v of this.allVideos) {
          if (v.channelId === channelId) {
            v.outlier = parser.calculateOutlierScore(v, medianVPH);
          }
        }
      }

      // Nếu bộ lọc maxSubs đang active hoặc đang sort outlier thì render lại
      if (this.filters.maxSubs !== null || this.sortBy === 'outlier') {
        this.applyFiltersAndRender();
      } else {
        this.updateCardSubBadges(channelId, subs);
      }
      this.updateSubValText();
    }
  }

  updateCardSubBadges(channelId, subs) {
    const parser = window.FindTrendParser;
    const cards = this.shadowRoot.querySelectorAll(`.ft-card[data-channel-id="${channelId}"]`);
    const badgeText = `👥 ${parser ? parser.formatCompactNumber(subs) : subs} ${this.t('subsBadgeText')}`;
    cards.forEach(card => {
      let badge = card.querySelector('.ft-badge-subs');
      if (badge) {
        badge.textContent = badgeText;
      } else {
        const channelWrap = card.querySelector('.ft-card-channel')?.parentElement;
        if (channelWrap) {
          const span = document.createElement('span');
          span.className = 'ft-badge-subs';
          span.title = this.t('channelSubs');
          span.textContent = badgeText;
          channelWrap.appendChild(span);
        }
      }
    });
  }

  updateSubValText() {
    const subVal = this.shadowRoot.getElementById('ftSubVal');
    if (!subVal) return;
    subVal.textContent = this.getSubLabel(this.filters.maxSubs);
  }

  applyFiltersAndRender() {
    let result = [...this.allVideos];

    // 1. Lọc định dạng Video (chỉ 2 lựa chọn: video dài hoặc shorts)
    if (this.filters.videoType === 'video') {
      result = result.filter(v => !v.isShort);
    } else if (this.filters.videoType === 'shorts') {
      result = result.filter(v => v.isShort);
    }

    // 2. Lọc độ dài tối đa Video từ Slider
    if (this.filters.maxDurationMin !== null) {
      const maxSec = this.filters.maxDurationMin * 60;
      result = result.filter(v => v.durationSec > 0 && v.durationSec <= maxSec);
    }

    // 3. Lọc thời gian đăng (Số ngày) từ Slider
    if (this.filters.daysAgo < 180) {
      const maxHours = this.filters.daysAgo * 24;
      result = result.filter(v => v.hoursAgo <= maxHours);
    }

    // 4. Lọc số lượng View tối thiểu từ Slider
    if (this.filters.minViews > 0) {
      result = result.filter(v => v.views >= this.filters.minViews);
    }

    // 5. Lọc quy mô kênh (Subscribers) từ Slider
    if (this.filters.maxSubs !== null) {
      result = result.filter(v => {
        if (v.subs !== null && v.subs > 0) {
          return v.subs <= this.filters.maxSubs;
        }
        return false;
      });
    }

    // 6. Tìm kiếm theo tiêu đề hoặc kênh
    if (this.filters.searchTitle) {
      result = result.filter(v => 
        v.title.toLowerCase().includes(this.filters.searchTitle) ||
        v.channel.toLowerCase().includes(this.filters.searchTitle)
      );
    }

    // 7. Sắp xếp
    switch (this.sortBy) {
      case 'vph':
        result.sort((a, b) => b.vph - a.vph);
        break;
      case 'outlier':
        result.sort((a, b) => b.outlier - a.outlier);
        break;
      case 'views':
        result.sort((a, b) => b.views - a.views);
        break;
      case 'newest':
        result.sort((a, b) => a.hoursAgo - b.hoursAgo);
        break;
      default:
        result.sort((a, b) => a.originalIndex - b.originalIndex);
        break;
    }

    this.filteredVideos = result;
    this.renderCards();
    this.updateCounter();
  }

  renderCards() {
    const grid = this.shadowRoot.getElementById('ftVideoGrid');
    const empty = this.shadowRoot.getElementById('ftEmptyState');
    const parser = window.FindTrendParser;

    if (!this.filteredVideos.length) {
      grid.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';

    grid.innerHTML = this.filteredVideos.map(v => {
      const vphFormatted = parser ? parser.formatVPH(v.vph) : `${v.vph} VPH`;
      const viewsFormatted = parser ? parser.formatCompactNumber(v.views) : `${v.views}`;
      const videoUrl = `https://www.youtube.com/watch?v=${v.videoId}`;
      const channelUrl = v.channelId ? `https://www.youtube.com/channel/${v.channelId}` : '#';

      return `
        <article class="ft-card" data-id="${v.videoId}" data-channel-id="${v.channelId || ''}">
          <div class="ft-card-thumb-wrap ${v.isShort ? 'short' : ''}">
            <img class="ft-card-thumb" src="${v.thumbnail}" alt="${v.title}" loading="lazy">
            ${v.durationText ? `<span class="ft-card-duration">${v.durationText}</span>` : ''}
          </div>
          <div class="ft-card-body">
            <a class="ft-card-title" href="${videoUrl}" target="_blank" title="${v.title}">${v.title}</a>
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <a class="ft-card-channel" href="${channelUrl}" target="_blank">${v.channel}</a>
              ${v.subs ? `<span class="ft-badge-subs" title="${this.t('channelSubs')}">👥 ${parser ? parser.formatCompactNumber(v.subs) : v.subs} ${this.t('subsBadgeText')}</span>` : ''}
            </div>
            <div class="ft-card-meta">
              <span>${viewsFormatted} ${this.t('viewsText')}</span>
              <span>•</span>
              <span>${v.publishedTimeText || this.t('hoursAgoShort', { val: Math.round(v.hoursAgo) })}</span>
            </div>
            <div class="ft-card-badges">
              <span class="ft-badge-vph" title="Views Per Hour">⚡ ${vphFormatted}</span>
              ${v.outlier > 1.2 ? `<span class="ft-badge-outlier" title="Outlier Score">🔥 ${v.outlier}x</span>` : ''}
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  updateCounter() {
    const el = this.shadowRoot.getElementById('ftCounter');
    if (el) {
      el.textContent = this.t('counter', { filtered: this.filteredVideos.length, total: this.allVideos.length });
    }
  }
}

if (typeof window !== 'undefined') {
  window.FindTrendModal = FindTrendModal;
}
