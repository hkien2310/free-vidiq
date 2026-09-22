/**
 * parser.js - Xử lý bóc tách số liệu View, Thời gian và tính toán VPH, Outlier Score
 */

/**
 * Chuyển chuỗi view YouTube (EN/VI) thành số nguyên
 * Ví dụ: "208K views", "1.2M views", "45 N lượt xem", "1,2 Tr lượt xem", "12,345 views"
 */
function parseViewCount(viewStr) {
  if (!viewStr || typeof viewStr !== 'string') return 0;
  const clean = viewStr.replace(/\u00A0/g, ' ').trim().toLowerCase();
  if (clean.includes('no views') || clean.includes('chưa có lượt xem')) return 0;

  const match = clean.match(/([\d\.,]+)\s*([a-zà-ỹ]*)/i);
  if (!match) return 0;

  let numStr = match[1];
  const unit = (match[2] || '').toLowerCase();

  let multiplier = 1;
  if (/^(b|tỷ|ty|billion)/i.test(unit)) {
    multiplier = 1_000_000_000;
  } else if (/^(m|tr|triệu|trieu|million)/i.test(unit)) {
    multiplier = 1_000_000;
  } else if (/^(k|n|nghìn|nghin|thousand)/i.test(unit)) {
    multiplier = 1_000;
  }

  if (multiplier > 1) {
    numStr = numStr.replace(/,/g, '.');
    const base = parseFloat(numStr);
    return isNaN(base) ? 0 : Math.round(base * multiplier);
  }

  if ((numStr.match(/[\.,]/g) || []).length > 1) {
    numStr = numStr.replace(/[\.,]/g, '');
  } else if (numStr.includes('.') || numStr.includes(',')) {
    const sep = numStr.includes('.') ? '.' : ',';
    const parts = numStr.split(sep);
    if (parts[1]?.length === 3) {
      numStr = parts[0] + parts[1];
    } else {
      numStr = numStr.replace(',', '.');
    }
  }

  const base = parseFloat(numStr);
  return isNaN(base) ? 0 : Math.round(base);
}

/**
 * Chuyển chuỗi subscriber YouTube (EN/VI) thành số nguyên
 * Ví dụ: "35.4K subscribers", "1.2M subscribers", "35,4 N người đăng ký", "1,2 Tr người đăng ký"
 */
function parseSubscriberCount(subStr) {
  if (!subStr || typeof subStr !== 'string') return 0;
  const clean = subStr.replace(/\u00A0/g, ' ').trim().toLowerCase();
  if (clean.includes('no subscribers') || clean.includes('không có người đăng ký')) return 0;

  const match = clean.match(/([\d\.,]+)\s*([a-zà-ỹ]*)\s*(?:sub|người đăng ký)/i);
  if (!match) return 0;

  let numStr = match[1];
  const unit = (match[2] || '').toLowerCase();

  let multiplier = 1;
  if (/^(b|tỷ|ty|billion)/i.test(unit)) {
    multiplier = 1_000_000_000;
  } else if (/^(m|tr|triệu|trieu|million)/i.test(unit)) {
    multiplier = 1_000_000;
  } else if (/^(k|n|nghìn|nghin|thousand)/i.test(unit)) {
    multiplier = 1_000;
  }

  if (multiplier > 1) {
    numStr = numStr.replace(/,/g, '.');
    const base = parseFloat(numStr);
    return isNaN(base) ? 0 : Math.round(base * multiplier);
  }

  if ((numStr.match(/[\.,]/g) || []).length > 1) {
    numStr = numStr.replace(/[\.,]/g, '');
  } else if (numStr.includes('.') || numStr.includes(',')) {
    const sep = numStr.includes('.') ? '.' : ',';
    const parts = numStr.split(sep);
    if (parts[1]?.length === 3) {
      numStr = parts[0] + parts[1];
    } else {
      numStr = numStr.replace(',', '.');
    }
  }

  const base = parseFloat(numStr);
  return isNaN(base) ? 0 : Math.round(base);
}

/**
 * Chuyển chuỗi thời gian YouTube (EN/VI) thành số giờ đã trôi qua
 * Ví dụ: "3 hours ago", "2 days ago", "1 month ago", "2 giờ trước", "5 ngày trước", "Just now", "Vừa xong"
 */
function parsePublishedHours(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 24;

  const clean = timeStr.replace(/\u00A0/g, ' ').trim().toLowerCase();

  // Xử lý các từ chỉ thời điểm vừa mới đăng
  if (clean.includes('just now') || clean.includes('vừa xong') || clean.includes('moment') || clean.includes('vài giây')) {
    return 0.1; // ~6 phút trước
  }
  if (clean.includes('yesterday') || clean.includes('hôm qua')) {
    return 24;
  }

  const match = clean.match(/(\d+)\s*(second|minute|hour|day|week|month|year|giây|phút|giờ|ngày|tuần|tháng|năm)/i);
  if (!match) return 24;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 'second':
    case 'giây':
      return 0.05;
    case 'minute':
    case 'phút':
      return Math.max(0.1, value / 60);
    case 'hour':
    case 'giờ':
      return Math.max(1, value);
    case 'day':
    case 'ngày':
      return value * 24;
    case 'week':
    case 'tuần':
      return value * 24 * 7;
    case 'month':
    case 'tháng':
      return value * 24 * 30;
    case 'year':
    case 'năm':
      return value * 24 * 365;
    default:
      return 24;
  }
}

/**
 * Tính Views Per Hour (VPH)
 */
function calculateVPH(views, hours) {
  if (!views || views <= 0) return 0;
  // Sàn 0.1 giờ (6 phút) để video mới đăng có chỉ số vận tốc chính xác mà không bị chia cho 0
  const validHours = Math.max(hours, 0.1);
  const vph = views / validHours;
  return parseFloat(vph.toFixed(1));
}

/**
 * Định dạng hiển thị VPH (ví dụ: 129.6 VPH hoặc 1.2K VPH)
 */
function formatVPH(vph) {
  if (vph >= 1_000_000) {
    return (vph / 1_000_000).toFixed(1) + 'M VPH';
  }
  if (vph >= 1_000) {
    return (vph / 1_000).toFixed(1) + 'K VPH';
  }
  return vph.toFixed(1) + ' VPH';
}

/**
 * Định dạng số view hiển thị ngắn gọn (ví dụ: 208K, 1.2M)
 */
function formatCompactNumber(num) {
  if (!num) return '0';
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toLocaleString();
}

/**
 * Tính Outlier Score (Hệ số đột biến — chuẩn vidIQ)
 *
 * Ưu tiên: medianViews (views / median views của kênh) — giống vidIQ.
 * Fallback khi chưa có medianViews: subs-based log-scaled ratio.
 * Fallback cuối: VPH vs feed median.
 *
 * 1.0x = phong độ bình thường  |  > 3x = đột biến  |  > 10x = viral
 */
function calculateOutlierScore(video, medianVPH = 10) {
  const views = video.views || 0;
  const vph = video.vph || 0;
  const subs = video.subs || 0;
  const channelMedian = video.medianViews || 0;

  if (views < 200) return 1.0;

  // Case 1: medianViews available (vidIQ-accurate)
  if (channelMedian > 0) {
    const score = views / channelMedian;
    return parseFloat(Math.max(0.1, score).toFixed(1));
  }

  // Case 2: subs-based fallback with log-scaled ratio
  if (subs && subs > 0) {
    const ratio = 0.3 / Math.pow(Math.max(subs, 1000) / 1000, 0.22);
    const expectedViews = Math.max(200, subs * ratio);
    return parseFloat(Math.max(0.1, views / expectedViews).toFixed(1));
  }

  // Case 3: VPH vs feed median
  const score = vph / Math.max(10, medianVPH);
  return parseFloat(Math.max(0.1, score).toFixed(1));
}

/**
 * Chuyển chuỗi thời lượng (HH:MM:SS hoặc MM:SS hoặc "Shorts") thành số giây
 */
function parseDurationSeconds(durationStr) {
  if (!durationStr || typeof durationStr !== 'string') return 0;
  if (durationStr.toLowerCase().includes('short')) return 45;
  return durationStr.trim().split(':').reduce((acc, v) => acc * 60 + (parseInt(v, 10) || 0), 0);
}

// Gắn vào window để chạy mượt mà trong Content Script không cần bundler
if (typeof window !== 'undefined') {
  window.FindTrendParser = {
    parseViewCount,
    parsePublishedHours,
    calculateVPH,
    formatVPH,
    formatCompactNumber,
    calculateOutlierScore,
    parseDurationSeconds,
    parseSubscriberCount
  };
}

