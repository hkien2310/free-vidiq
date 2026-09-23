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

const VPH_SEGMENTS = [
  [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
  [50, 60, 70, 80, 100, 120, 140, 160, 180, 200],
  [200, 250, 300, 350, 400, 500, 600, 700, 800, 1000],
  [1000, 1200, 1500, 2000, 2500, 3000, 4000, 5000]
];
const VPH_TICKS = ['0', '50', '200', '1K', '5K+'];

const OUTLIER_SEGMENTS = [
  [0, 0.2, 0.4, 0.6, 0.8, 1.0],
  [1.0, 1.2, 1.4, 1.5, 1.8, 2.0],
  [2.0, 2.5, 3.0, 3.5, 4.0, 5.0],
  [5.0, 6.0, 7.0, 8.0, 9.0, 10.0]
];
const OUTLIER_TICKS = ['0x', '1.0x', '2.0x', '5.0x', '10x+'];

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
      minVph: 0,              // Views/hour tối thiểu
      minOutlier: 0,          // 0 = Mọi hệ số / Không giới hạn dưới
      maxOutlier: null,       // null hoặc 10.0 = Không giới hạn trên
      searchTitle: ''
    };
    this.sortBy = 'default';  // 'default' | 'vph' | 'outlier' | 'views' | 'newest'
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

              <!-- 6. SLIDER: TỐC ĐỘ XEM (VPH) -->
              <div class="ft-slider-card">
                <div class="ft-slider-header">
                  <span class="ft-slider-title">
                    <span>⚡</span>
                    <span>${this.t('minVph')}</span>
                  </span>
                  <span class="ft-slider-val" id="ftVphVal">${this.getVphLabel(this.filters.minVph)}</span>
                </div>
                <input type="range" class="ft-slider" id="ftVphSlider" min="0" max="100" step="1" value="${this.getVphPos(this.filters.minVph)}">
                <div class="ft-slider-ticks">
                  ${this.renderTicks(VPH_TICKS)}
                </div>
              </div>

              <!-- 7. SLIDER: HỆ SỐ ĐỘT BIẾN (OUTLIER) MIN - MAX -->
              <div class="ft-slider-card">
                <div class="ft-slider-header">
                  <span class="ft-slider-title">
                    <span>🔥</span>
                    <span>${this.t('outlierScore')}</span>
                  </span>
                  <span class="ft-slider-val" id="ftOutlierVal">${this.getOutlierLabel(this.filters.minOutlier, this.filters.maxOutlier)}</span>
                </div>
                <div class="ft-dual-slider-wrap" id="ftOutlierWrap">
                  <div class="ft-dual-slider-track"></div>
                  <div class="ft-dual-slider-highlight" id="ftOutlierHighlight"></div>
                  <input type="range" class="ft-slider ft-dual-slider" id="ftOutlierMinSlider" min="0" max="100" step="1" value="${this.getOutlierMinPos(this.filters.minOutlier)}">
                  <input type="range" class="ft-slider ft-dual-slider" id="ftOutlierMaxSlider" min="0" max="100" step="1" value="${this.getOutlierMaxPos(this.filters.maxOutlier)}">
                </div>
                <div class="ft-slider-ticks">
                  ${this.renderTicks(OUTLIER_TICKS)}
                </div>
              </div>

              <!-- 8. SẮP XẾP ƯU TIÊN -->
              <div class="ft-filter-section">
                <div class="ft-filter-title">
                  <span>🚀</span>
                  <span>${this.t('sortPriority')}</span>
                </div>
                <div class="ft-pill-group" data-group="sortBy">
                  <button class="ft-pill ${this.sortBy === 'default' ? 'active' : ''}" data-val="default">🔄 Default</button>
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

              <button class="ft-btn-help" id="ftHelpBtn" title="${this.t('guideTitle')}">
                <span>📖 ${this.t('guideBtn')}</span>
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
                <div class="ft-banner-tag" id="ftBannerGuideBtn" style="cursor: pointer; background: rgba(59, 130, 246, 0.16); border-color: rgba(59, 130, 246, 0.35);">📖 <span>${this.t('guideBtn')}</span></div>
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

          <!-- Guide Overlay Modal -->
          <div class="ft-guide-overlay" id="ftGuideOverlay" style="display: none;">
            <div class="ft-guide-modal">
              <div class="ft-guide-header">
                <div class="ft-guide-title">
                  <span>📖</span>
                  <span>${this.t('guideTitle')}</span>
                </div>
                <button class="ft-guide-close" id="ftGuideCloseBtn" title="Close">&times;</button>
              </div>
              <div class="ft-guide-body">
                <!-- 3 Presets -->
                <div class="ft-guide-section">
                  <div class="ft-guide-sec-title">🎯 ${this.t('guidePresetsTitle')}</div>
                  <div class="ft-guide-presets">
                    <div class="ft-guide-preset-card">
                      <div class="ft-preset-header">
                        <span class="ft-preset-icon">🔥</span>
                        <span class="ft-preset-name">${this.t('presetViralTitle')}</span>
                        <button class="ft-btn-preset-apply" data-preset="viral">${this.t('applyPreset')}</button>
                      </div>
                      <p class="ft-preset-desc">${this.t('presetViralDesc')}</p>
                      <div class="ft-preset-tags">
                        <span>Outlier ≥ 3.0x</span>
                        <span>≤ 30d</span>
                        <span>VPH ≥ 50</span>
                      </div>
                    </div>

                    <div class="ft-guide-preset-card">
                      <div class="ft-preset-header">
                        <span class="ft-preset-icon">📊</span>
                        <span class="ft-preset-name">${this.t('presetConsistentTitle')}</span>
                        <button class="ft-btn-preset-apply" data-preset="consistent">${this.t('applyPreset')}</button>
                      </div>
                      <p class="ft-preset-desc">${this.t('presetConsistentDesc')}</p>
                      <div class="ft-preset-tags">
                        <span>Views ≥ 50K</span>
                        <span>Outlier 0.8x - 1.5x</span>
                      </div>
                    </div>

                    <div class="ft-guide-preset-card">
                      <div class="ft-preset-header">
                        <span class="ft-preset-icon">💎</span>
                        <span class="ft-preset-name">${this.t('presetGemTitle')}</span>
                        <button class="ft-btn-preset-apply" data-preset="hiddenGem">${this.t('applyPreset')}</button>
                      </div>
                      <p class="ft-preset-desc">${this.t('presetGemDesc')}</p>
                      <div class="ft-preset-tags">
                        <span>Subs < 25K</span>
                        <span>Views ≥ 25K</span>
                        <span>Outlier ≥ 2.0x</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Core metrics explanation -->
                <div class="ft-guide-section">
                  <div class="ft-guide-sec-title">⚡ ${this.t('guideMetricsTitle')}</div>
                  <div class="ft-guide-metrics">
                    <div class="ft-metric-item">
                      <div class="ft-metric-label">⚡ VPH (Views Per Hour)</div>
                      <div class="ft-metric-text">${this.t('metricVphDesc')}</div>
                    </div>
                    <div class="ft-metric-item">
                      <div class="ft-metric-label">🔥 Outlier Score (vidIQ standard)</div>
                      <div class="ft-metric-text">${this.t('metricOutlierDesc')}</div>
                    </div>
                  </div>
                </div>

                <!-- Pro tips -->
                <div class="ft-guide-section">
                  <div class="ft-guide-sec-title">💡 ${this.t('guideTipsTitle')}</div>
                  <ul class="ft-guide-tips">
                    <li><strong>Enter to Search:</strong> ${this.t('tipSearch')}</li>
                    <li><strong>Click on Ticks:</strong> ${this.t('tipTicks')}</li>
                    <li><strong>Dual-handle Outlier:</strong> ${this.t('tipDualOutlier')}</li>
                  </ul>
                </div>
              </div>
              <div class="ft-guide-footer">
                <button class="ft-btn-guide-gotit" id="ftGuideGotItBtn">${this.t('gotItBtn')}</button>
              </div>
            </div>
          </div>
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

  getVphPos(vph) {
    return valToPos(VPH_SEGMENTS, vph);
  }

  getVphLabel(vph) {
    if (vph === 0) return this.t('anyVph');
    const parser = window.FindTrendParser;
    const formatted = parser ? parser.formatVPH(vph) : `${vph} VPH`;
    return this.t('vphGreaterOrEqual', { val: formatted });
  }

  getOutlierMinPos(min) {
    if (min === null || min === undefined || min <= 0) return 0;
    return valToPos(OUTLIER_SEGMENTS, min);
  }

  getOutlierMaxPos(max) {
    if (max === null || max === undefined || max >= 10.0) return 100;
    return valToPos(OUTLIER_SEGMENTS, max);
  }

  getOutlierLabel(min, max) {
    const isMinDefault = !min || min <= 0;
    const isMaxDefault = max === null || max === undefined || max >= 10.0;

    if (isMinDefault && isMaxDefault) {
      return this.t('anyOutlier');
    }
    if (!isMinDefault && isMaxDefault) {
      return this.t('outlierMinOnly', { min: Number(min).toFixed(1) });
    }
    if (isMinDefault && !isMaxDefault) {
      return this.t('outlierMaxOnly', { max: Number(max).toFixed(1) });
    }
    return this.t('outlierRangeVal', { min: Number(min).toFixed(1), max: Number(max).toFixed(1) });
  }

  updateOutlierDisplay() {
    const root = this.shadowRoot;
    if (!root) return;
    const minSlider = root.getElementById('ftOutlierMinSlider');
    const maxSlider = root.getElementById('ftOutlierMaxSlider');
    const highlight = root.getElementById('ftOutlierHighlight');
    const valEl = root.getElementById('ftOutlierVal');

    if (!minSlider || !maxSlider) return;

    const minPos = parseInt(minSlider.value, 10);
    const maxPos = parseInt(maxSlider.value, 10);

    if (highlight) {
      highlight.style.left = `calc(8px + (100% - 16px) * ${minPos / 100})`;
      highlight.style.width = `calc((100% - 16px) * ${(maxPos - minPos) / 100})`;
    }
    if (valEl) {
      valEl.textContent = this.getOutlierLabel(this.filters.minOutlier, this.filters.maxOutlier);
    }
    this.highlightActiveTicks();
  }

  highlightActiveTicks() {
    const root = this.shadowRoot;
    if (!root) return;
    root.querySelectorAll('.ft-slider-card').forEach(card => {
      const sliders = card.querySelectorAll('.ft-slider');
      if (sliders.length === 1) {
        const currentPos = parseInt(sliders[0].value, 10);
        card.querySelectorAll('.ft-slider-ticks span').forEach(tick => {
          const tickPos = parseInt(tick.dataset.pos, 10);
          tick.classList.toggle('active', Math.abs(currentPos - tickPos) <= 1);
        });
      } else if (sliders.length === 2) {
        const minPos = parseInt(sliders[0].value, 10);
        const maxPos = parseInt(sliders[1].value, 10);
        card.querySelectorAll('.ft-slider-ticks span').forEach(tick => {
          const tickPos = parseInt(tick.dataset.pos, 10);
          const isAtEnd = Math.abs(minPos - tickPos) <= 1 || Math.abs(maxPos - tickPos) <= 1;
          tick.classList.toggle('active', isAtEnd);
        });
      }
    });
  }

  openGuide() {
    const el = this.shadowRoot.getElementById('ftGuideOverlay');
    if (el) el.style.display = 'flex';
  }

  closeGuide() {
    const el = this.shadowRoot.getElementById('ftGuideOverlay');
    if (el) el.style.display = 'none';
  }

  applyPreset(presetType) {
    if (presetType === 'viral') {
      this.filters = {
        ...this.filters,
        minOutlier: 3.0,
        maxOutlier: null,
        daysAgo: 30,
        minViews: 0,
        maxSubs: null,
        minVph: 50
      };
      this.sortBy = 'outlier';
    } else if (presetType === 'consistent') {
      this.filters = {
        ...this.filters,
        minViews: 50000,
        minOutlier: 0.8,
        maxOutlier: 1.5,
        daysAgo: 180,
        maxSubs: null,
        minVph: 0
      };
      this.sortBy = 'views';
    } else if (presetType === 'hiddenGem') {
      this.filters = {
        ...this.filters,
        maxSubs: 25000,
        minViews: 25000,
        minOutlier: 2.0,
        maxOutlier: null,
        daysAgo: 90,
        minVph: 0
      };
      this.sortBy = 'vph';
    }

    this.syncSlidersUI();
    this.applyFiltersAndRender();
    this.closeGuide();
  }

  syncSlidersUI() {
    const root = this.shadowRoot;
    if (!root) return;

    const durSlider = root.getElementById('ftDurationSlider');
    const durVal = root.getElementById('ftDurationVal');
    if (durSlider && durVal) {
      durSlider.value = String(valToPos(DURATION_SEGMENTS, this.filters.maxDurationMin));
      durVal.textContent = this.getDurationLabel(this.filters.maxDurationMin);
    }

    const timeSlider = root.getElementById('ftTimeSlider');
    const timeVal = root.getElementById('ftTimeVal');
    if (timeSlider && timeVal) {
      timeSlider.value = String(valToPos(TIME_SEGMENTS, this.filters.daysAgo));
      timeVal.textContent = this.getTimeLabel(this.filters.daysAgo);
    }

    const viewSlider = root.getElementById('ftViewSlider');
    const viewVal = root.getElementById('ftViewVal');
    if (viewSlider && viewVal) {
      viewSlider.value = String(valToPos(VIEW_SEGMENTS, this.filters.minViews));
      viewVal.textContent = this.getViewLabel(this.filters.minViews);
    }

    const subSlider = root.getElementById('ftSubSlider');
    const subVal = root.getElementById('ftSubVal');
    if (subSlider && subVal) {
      subSlider.value = String(valToPos(SUB_SEGMENTS, this.filters.maxSubs));
      subVal.textContent = this.getSubLabel(this.filters.maxSubs);
    }

    const vphSlider = root.getElementById('ftVphSlider');
    const vphVal = root.getElementById('ftVphVal');
    if (vphSlider && vphVal) {
      vphSlider.value = String(valToPos(VPH_SEGMENTS, this.filters.minVph));
      vphVal.textContent = this.getVphLabel(this.filters.minVph);
    }

    const outlierMinSlider = root.getElementById('ftOutlierMinSlider');
    const outlierMaxSlider = root.getElementById('ftOutlierMaxSlider');
    if (outlierMinSlider && outlierMaxSlider) {
      outlierMinSlider.value = String(this.getOutlierMinPos(this.filters.minOutlier));
      outlierMaxSlider.value = String(this.getOutlierMaxPos(this.filters.maxOutlier));
      this.updateOutlierDisplay();
    }

    root.querySelectorAll('[data-group="sortBy"] .ft-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.val === this.sortBy);
    });

    this.highlightActiveTicks();
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

    // 6. Slider Tốc độ xem (VPH)
    const vphSlider = root.getElementById('ftVphSlider');
    const vphVal = root.getElementById('ftVphVal');
    vphSlider.addEventListener('input', () => {
      const vph = posToVal(VPH_SEGMENTS, vphSlider.value);
      this.filters.minVph = vph;
      vphVal.textContent = this.getVphLabel(vph);
      this.highlightActiveTicks();
      this.applyFiltersAndRender();
    });

    // 7. Slider Hệ số đột biến (Outlier) MIN - MAX
    const outlierMinSlider = root.getElementById('ftOutlierMinSlider');
    const outlierMaxSlider = root.getElementById('ftOutlierMaxSlider');
    const outlierWrap = root.getElementById('ftOutlierWrap');

    const onMinInput = () => {
      let minPos = parseInt(outlierMinSlider.value, 10);
      let maxPos = parseInt(outlierMaxSlider.value, 10);
      if (minPos > maxPos) {
        outlierMinSlider.value = String(maxPos);
        minPos = maxPos;
      }
      this.filters.minOutlier = posToVal(OUTLIER_SEGMENTS, minPos);
      this.updateOutlierDisplay();
      this.applyFiltersAndRender();
    };

    const onMaxInput = () => {
      let minPos = parseInt(outlierMinSlider.value, 10);
      let maxPos = parseInt(outlierMaxSlider.value, 10);
      if (maxPos < minPos) {
        outlierMaxSlider.value = String(minPos);
        maxPos = minPos;
      }
      const val = posToVal(OUTLIER_SEGMENTS, maxPos);
      this.filters.maxOutlier = maxPos >= 100 ? null : val;
      this.updateOutlierDisplay();
      this.applyFiltersAndRender();
    };

    if (outlierMinSlider && outlierMaxSlider) {
      outlierMinSlider.addEventListener('input', onMinInput);
      outlierMaxSlider.addEventListener('input', onMaxInput);

      outlierMinSlider.addEventListener('mousedown', () => {
        outlierMinSlider.style.zIndex = '5';
        outlierMaxSlider.style.zIndex = '3';
      });
      outlierMinSlider.addEventListener('touchstart', () => {
        outlierMinSlider.style.zIndex = '5';
        outlierMaxSlider.style.zIndex = '3';
      });
      outlierMaxSlider.addEventListener('mousedown', () => {
        outlierMaxSlider.style.zIndex = '5';
        outlierMinSlider.style.zIndex = '3';
      });
      outlierMaxSlider.addEventListener('touchstart', () => {
        outlierMaxSlider.style.zIndex = '5';
        outlierMinSlider.style.zIndex = '3';
      });
    }

    if (outlierWrap) {
      outlierWrap.addEventListener('click', (e) => {
        if (e.target.classList.contains('ft-dual-slider')) return;
        const rect = outlierWrap.getBoundingClientRect();
        const clickRatio = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
        const minPos = parseInt(outlierMinSlider.value, 10);
        const maxPos = parseInt(outlierMaxSlider.value, 10);
        if (Math.abs(clickRatio - minPos) <= Math.abs(clickRatio - maxPos)) {
          outlierMinSlider.value = String(clickRatio);
          onMinInput();
        } else {
          outlierMaxSlider.value = String(clickRatio);
          onMaxInput();
        }
      });
    }

    // Hỗ trợ click trực tiếp vào nhãn tick để nhảy đến điểm mốc tương ứng
    root.querySelectorAll('.ft-slider-card').forEach(card => {
      const sliders = card.querySelectorAll('.ft-slider');
      card.querySelectorAll('.ft-slider-ticks span').forEach(tick => {
        tick.addEventListener('click', () => {
          const pos = tick.dataset.pos;
          if (pos === undefined) return;
          const targetPos = parseInt(pos, 10);
          if (sliders.length === 1) {
            sliders[0].value = pos;
            sliders[0].dispatchEvent(new Event('input'));
          } else if (sliders.length === 2) {
            const minSlider = sliders[0];
            const maxSlider = sliders[1];
            const minPos = parseInt(minSlider.value, 10);
            const maxPos = parseInt(maxSlider.value, 10);
            if (Math.abs(targetPos - minPos) <= Math.abs(targetPos - maxPos)) {
              minSlider.value = pos;
              minSlider.dispatchEvent(new Event('input'));
            } else {
              maxSlider.value = pos;
              maxSlider.dispatchEvent(new Event('input'));
            }
          }
        });
      });
    });

    this.updateOutlierDisplay();
    this.highlightActiveTicks();

    // 8. Sắp xếp ưu tiên
    root.querySelectorAll('[data-group="sortBy"] .ft-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        root.querySelectorAll('[data-group="sortBy"] .ft-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.sortBy = pill.dataset.val;
        this.applyFiltersAndRender();
      });
    });

    // 9. Reset bộ lọc
    root.getElementById('ftResetBtn').addEventListener('click', () => {
      this.filters = {
        videoType: 'video',
        maxDurationMin: null,
        daysAgo: 180,
        minViews: 0,
        maxSubs: null,
        minVph: 0,
        minOutlier: 0,
        maxOutlier: null,
        searchTitle: ''
      };
      this.sortBy = 'default';
      root.getElementById('ftSearchInput').value = '';
      this.syncSlidersUI();
      this.applyFiltersAndRender();
    });

    // 10. Hướng dẫn sử dụng (Guide Modal)
    const openGuide = () => this.openGuide();
    const closeGuide = () => this.closeGuide();

    const helpBtn = root.getElementById('ftHelpBtn');
    if (helpBtn) helpBtn.addEventListener('click', openGuide);

    const bannerGuideBtn = root.getElementById('ftBannerGuideBtn');
    if (bannerGuideBtn) bannerGuideBtn.addEventListener('click', openGuide);

    const guideCloseBtn = root.getElementById('ftGuideCloseBtn');
    if (guideCloseBtn) guideCloseBtn.addEventListener('click', closeGuide);

    const guideGotItBtn = root.getElementById('ftGuideGotItBtn');
    if (guideGotItBtn) guideGotItBtn.addEventListener('click', closeGuide);

    const guideOverlay = root.getElementById('ftGuideOverlay');
    if (guideOverlay) {
      guideOverlay.addEventListener('click', (e) => {
        if (e.target.id === 'ftGuideOverlay') closeGuide();
      });
    }

    // Các nút Áp dụng Preset trong Guide
    root.querySelectorAll('.ft-btn-preset-apply').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        if (preset) this.applyPreset(preset);
      });
    });


    // Tìm kiếm bằng ô Search input
    let searchTimeout = null;
    const searchInput = root.getElementById('ftSearchInput');
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.filters.searchTitle = (e.target.value || '').trim().toLowerCase();
        this.applyFiltersAndRender();
      }, 200);
    });
    // Enter → navigate to YouTube search
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = searchInput.value.trim();
        if (q) {
          sessionStorage.setItem('ft_auto_open', '1');
          window.location.href = `/results?search_query=${encodeURIComponent(q)}`;
        }
      }
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
      const hoursAgo = parser ? parser.parsePublishedHours(v.publishedTimeText) : null;
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

    for (const v of processed) {
      v.outlier = parser ? parser.calculateOutlierScore(v) : 1.0;
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
        for (const v of this.allVideos) {
          if (v.channelId === channelId) {
            v.outlier = parser.calculateOutlierScore(v);
          }
        }
      }

      // Nếu bộ lọc maxSubs, outlier đang active hoặc đang sort outlier thì render lại
      if (this.filters.maxSubs !== null || this.filters.minOutlier > 0 || this.filters.maxOutlier !== null || this.sortBy === 'outlier') {
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
      result = result.filter(v => v.hoursAgo !== null && v.hoursAgo <= maxHours);
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

    // 6. Lọc tốc độ xem tối thiểu (VPH) từ Slider
    if (this.filters.minVph > 0) {
      result = result.filter(v => v.vph >= this.filters.minVph);
    }

    // 7. Lọc hệ số đột biến (Outlier Score) từ Slider MIN và MAX
    if (this.filters.minOutlier > 0) {
      result = result.filter(v => v.outlier >= this.filters.minOutlier);
    }
    if (this.filters.maxOutlier !== null && this.filters.maxOutlier < 10.0) {
      result = result.filter(v => v.outlier <= this.filters.maxOutlier);
    }

    // 8. Tìm kiếm theo tiêu đề hoặc kênh
    if (this.filters.searchTitle) {
      result = result.filter(v => 
        v.title.toLowerCase().includes(this.filters.searchTitle) ||
        v.channel.toLowerCase().includes(this.filters.searchTitle)
      );
    }

    // 9. Sắp xếp
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
        result.sort((a, b) => {
          if (a.hoursAgo === null) return 1;
          if (b.hoursAgo === null) return -1;
          return a.hoursAgo - b.hoursAgo;
        });
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

    if (!grid) return;

    if (this.filteredVideos.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.style.display = 'flex';
      return;
    }

    if (empty) empty.style.display = 'none';

    const parser = window.FindTrendParser;

    grid.innerHTML = this.filteredVideos.map(v => {
      const formatFn = parser ? (parser.formatCompactNumber || parser.formatNumber) : (n => n);
      const viewsFormatted = formatFn ? formatFn(v.views) : v.views;
      const vphFormatted = parser ? parser.formatVPH(v.vph) : v.vph;
      const subsFormatted = v.subs ? (formatFn ? formatFn(v.subs) : v.subs) : null;
      const timeDisplay = v.publishedTimeText || (v.hoursAgo !== null ? this.t('hoursAgoShort', { val: Math.round(v.hoursAgo) }) : 'Release');

      return `
        <article class="ft-card" data-id="${v.videoId}">
          <div class="ft-card-thumb-wrap">
            <a href="/watch?v=${v.videoId}" target="_blank" rel="noopener">
              <img class="ft-card-thumb" src="${v.thumbnail}" alt="${v.title}" loading="lazy" />
              ${v.durationText ? `<span class="ft-card-duration">${v.durationText}</span>` : ''}
            </a>
          </div>
          <div class="ft-card-body">
            <a class="ft-card-title" href="/watch?v=${v.videoId}" target="_blank" rel="noopener" title="${v.title}">${v.title}</a>
            <div class="ft-card-meta">
              <span class="ft-card-channel" title="${v.channel}">${v.channel}</span>
              ${subsFormatted ? `<span class="ft-badge-subs" title="Channel Subscribers">👥 ${subsFormatted} subs</span>` : ''}
            </div>
            <div class="ft-card-stats">
              <span>${viewsFormatted} ${this.t('viewsText')}</span>
              <span>•</span>
              <span>${timeDisplay}</span>
            </div>
            <div class="ft-card-badges">
              <span class="ft-badge-vph" title="Views Per Hour">${v.vph > 0 ? `⚡ ${vphFormatted}` : `⚡ -- VPH`}</span>
              ${v.outlier > 0 ? `<span class="ft-badge-outlier" title="Outlier Score: ${v.outlier}x">🔥 ${v.outlier}x</span>` : ''}
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
