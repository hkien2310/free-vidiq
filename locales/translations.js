/**
 * locales/translations.js - Bộ từ điển dịch thuật song ngữ EN (Mặc định) và VI
 */

const FindTrendTranslations = {
  en: {
    // Header & Brand
    appTitle: "Viral Filters",
    badgeLogo: "TREND",
    
    // Format section
    videoFormat: "Video Format",
    longVideos: "📺 Long Videos",
    shorts: "⚡ Shorts",

    // Sliders
    maxDuration: "Max Duration:",
    anyLength: "Any length",
    minutesSuffix: "mins",
    minsLessOrEqual: "≤ {val} mins",

    publishedDate: "Published Date:",
    anyTime: "Any time",
    todayHours: "⚡ Past 24 hours",
    daysAgo: "Past {val} days",

    minViews: "Minimum Views:",
    anyViews: "Any views",
    viewsGreaterOrEqual: "≥ {val} views",

    channelSubs: "Channel Subscribers:",
    anySubs: "Any size",
    subsLessThan: "< {val} subs",
    subsChecking: "Checking...",
    subsCheckingChannels: "checking {count} channels...",

    minVph: "Minimum Velocity:",
    anyVph: "Any VPH",
    vphGreaterOrEqual: "≥ {val} VPH",

    outlierScore: "Outlier Score:",
    anyOutlier: "Any score",
    outlierMinOnly: "≥ {min}x",
    outlierMaxOnly: "≤ {max}x",
    outlierRangeVal: "{min}x - {max}x",

    // Sort
    sortPriority: "Sort Priority",
    sortVph: "⚡ Velocity (VPH)",
    sortOutlier: "🔥 Outlier Breakout",
    sortViews: "👁 Most Viewed",
    sortNewest: "⏱ Newest Uploads",

    // Actions
    resetFilters: "🔄 Reset Filters",
    loadMore: "⚡ Load More Videos",
    loadingMore: "⏳ Loading...",
    downloadCsv: "⬇ Download CSV",
    searchPlaceholder: "Filter or press Enter to search YouTube...",
    counter: "Showing {filtered} / {total} videos",

    // Banner info
    bannerTitle: "Discover Viral & Outlier Videos on YouTube (100% Local)",
    bannerVph: "VPH: Views/Hour",
    bannerOutlier: "Outlier Breakout",
    bannerLocal: "No Account Needed",

    // Empty state
    emptyTitle: "No matching videos found",
    emptyDesc: "Try adjusting your sliders or click 'Load More Videos' to discover new content.",

    // Cards
    viewsText: "views",
    agoText: "ago",
    subsBadgeText: "subs",
    hoursAgoShort: "{val}h ago",

    // CSV Headers
    csvTitle: "Title",
    csvUrl: "Video URL",
    csvChannel: "Channel Name",
    csvViews: "Views",
    csvVph: "Views Per Hour (VPH)",
    csvOutlier: "Outlier Multiplier",
    csvPublished: "Published Time",
    csvType: "Type",
    csvDuration: "Duration",

    // Guide Modal
    guideBtn: "Guide",
    guideTitle: "Quick Guide & Search Strategies",
    guidePresetsTitle: "Battle-Tested Filter Presets",
    applyPreset: "Apply",
    presetViralTitle: "Viral Breakout Videos",
    presetViralDesc: "Find outlier hits outperforming their channel to study hooks, viral titles & thumbnails.",
    presetConsistentTitle: "High-Consistency Channels",
    presetConsistentDesc: "Find videos with steady high views and baseline outlier to study proven niches & formats.",
    presetGemTitle: "Hidden Gems (Small Channels)",
    presetGemDesc: "Discover small creators getting massive views. High opportunity, low competition.",
    guideMetricsTitle: "Core Metrics Explained",
    metricVphDesc: "Views Per Hour measures real-time viral velocity. Over 200 VPH means trending, 1K+ is exploding.",
    metricOutlierDesc: "Compares video views against the channel's 50-video median (vidIQ-style). ~1.0x = normal baseline, >3.0x = breakout, >10x = super viral.",
    guideTipsTitle: "Pro Tips",
    tipSearch: "Type keywords in the search bar and press Enter to search YouTube and auto-filter results.",
    tipTicks: "Click directly on any tick label under a slider to jump to that exact value.",
    tipDualOutlier: "Drag both Min and Max handles on the Outlier slider to isolate specific performance brackets.",
    gotItBtn: "Got it, let's explore!"
  },

  vi: {
    // Header & Brand
    appTitle: "Bộ lọc Viral",
    badgeLogo: "TREND",

    // Format section
    videoFormat: "Định dạng Video",
    longVideos: "📺 Video dài",
    shorts: "⚡ Shorts",

    // Sliders
    maxDuration: "Độ dài tối đa:",
    anyLength: "Mọi độ dài",
    minutesSuffix: "phút",
    minsLessOrEqual: "≤ {val} phút",

    publishedDate: "Thời gian đăng:",
    anyTime: "Mọi lúc",
    todayHours: "⚡ 24 giờ qua",
    daysAgo: "Trong {val} ngày qua",

    minViews: "Lượt xem tối thiểu:",
    anyViews: "Mọi mức view",
    viewsGreaterOrEqual: "≥ {val} views",

    channelSubs: "Quy mô kênh:",
    anySubs: "Mọi quy mô",
    subsLessThan: "< {val} subs",
    subsChecking: "Đang kiểm tra...",
    subsCheckingChannels: "đang kiểm tra {count} kênh...",

    minVph: "Tốc độ xem tối thiểu:",
    anyVph: "Mọi tốc độ",
    vphGreaterOrEqual: "≥ {val} VPH",

    outlierScore: "Hệ số Outlier:",
    anyOutlier: "Mọi hệ số",
    outlierMinOnly: "≥ {min}x",
    outlierMaxOnly: "≤ {max}x",
    outlierRangeVal: "{min}x - {max}x",

    // Sort
    sortPriority: "Sắp xếp ưu tiên",
    sortVph: "⚡ VPH (Tăng nhanh)",
    sortOutlier: "🔥 Outlier (Đột biến)",
    sortViews: "👁 View cao nhất",
    sortNewest: "⏱ Mới đăng nhất",

    // Actions
    resetFilters: "🔄 Đặt lại bộ lọc",
    loadMore: "⚡ Nạp thêm video",
    loadingMore: "⏳ Đang nạp thêm...",
    downloadCsv: "⬇ Tải CSV",
    searchPlaceholder: "Tìm theo tiêu đề video hoặc tên kênh...",
    counter: "Hiển thị {filtered} / {total} video",

    // Banner info
    bannerTitle: "Tìm kiếm video Outlier & Viral trên YouTube (100% Local)",
    bannerVph: "VPH: Views/Giờ",
    bannerOutlier: "Outlier: Hệ số đột biến",
    bannerLocal: "Không cần tài khoản",

    // Empty state
    emptyTitle: "Không tìm thấy video nào phù hợp",
    emptyDesc: "Thử kéo lại thanh trượt hoặc bấm 'Nạp thêm video' để quét thêm video mới.",

    // Cards
    viewsText: "lượt xem",
    agoText: "trước",
    subsBadgeText: "subs",
    hoursAgoShort: "{val}h trước",

    // CSV Headers
    csvTitle: "Tiêu đề",
    csvUrl: "Đường dẫn Video",
    csvChannel: "Tên Kênh",
    csvViews: "Lượt xem",
    csvVph: "Lượt xem mỗi giờ (VPH)",
    csvOutlier: "Hệ số đột biến Outlier",
    csvPublished: "Thời gian đăng",
    csvType: "Định dạng",
    csvDuration: "Thời lượng",

    // Guide Modal
    guideBtn: "Hướng dẫn",
    guideTitle: "Hướng dẫn sử dụng & Chiến thuật tìm Trend",
    guidePresetsTitle: "Công thức lọc thực chiến (1-Click)",
    applyPreset: "Áp dụng",
    presetViralTitle: "Săn video Viral / Đột biến",
    presetViralDesc: "Tìm video vượt trội gấp nhiều lần kênh để học cách giật tít, làm thumbnail gây tò mò và mở đầu hook.",
    presetConsistentTitle: "Kênh Đẳng cấp, Ổn định",
    presetConsistentDesc: "Tìm video view cao đều đặn và outlier bình thường để học cấu trúc format và thị trường ngách bền vững.",
    presetGemTitle: "Săn Ngọc ẩn (Kênh nhỏ view khủng)",
    presetGemDesc: "Khám phá các kênh ít sub nhưng video bùng nổ hàng chục/trăm nghìn view — ngách ít cạnh tranh.",
    guideMetricsTitle: "Giải thích chỉ số cốt lõi",
    metricVphDesc: "Views Per Hour: Vận tốc tăng view/giờ. >200 VPH là đang trend, >1.000 VPH là đang bão view.",
    metricOutlierDesc: "Đo độ đột biến so với 50 video gần nhất của chính kênh đó (chuẩn vidIQ). ~1.0x = đúng phong độ, >3.0x = đột biến, >10x = siêu viral.",
    guideTipsTitle: "Mẹo sử dụng nhanh",
    tipSearch: "Gõ từ khóa vào ô tìm kiếm rồi bấm Enter để nhảy thẳng sang YouTube Search của chủ đề đó.",
    tipTicks: "Bấm trực tiếp vào các mốc chữ dưới thanh trượt để chuyển nhanh tới giá trị mong muốn.",
    tipDualOutlier: "Kéo 2 đầu Min và Max trên thanh Outlier để chọn chính xác khoảng hệ số bạn cần.",
    gotItBtn: "Đã hiểu, bắt đầu thôi!"
  }
};

if (typeof window !== 'undefined') {
  window.FindTrendTranslations = FindTrendTranslations;
}
