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
    searchPlaceholder: "Search by video title or channel...",
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
    csvDuration: "Duration"
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
    csvDuration: "Thời lượng"
  }
};

if (typeof window !== 'undefined') {
  window.FindTrendTranslations = FindTrendTranslations;
}
