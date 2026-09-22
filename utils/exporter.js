/**
 * exporter.js - Xuất danh sách video đã phân tích ra file CSV
 */

function exportVideosToCSV(videos, filename = 'youtube_trending_videos.csv') {
  const i18n = window.FindTrendI18n;
  const t = i18n ? i18n.t : (k => k);

  if (!videos || !videos.length) {
    alert(t('emptyTitle'));
    return;
  }

  const headers = [
    t('csvTitle'),
    t('csvUrl'),
    t('csvChannel'),
    t('csvViews'),
    t('csvVph'),
    t('csvOutlier'),
    t('csvPublished'),
    t('csvType'),
    t('csvDuration')
  ];

  const escapeCSV = (str) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = videos.map(v => [
    escapeCSV(v.title),
    escapeCSV(`https://www.youtube.com/watch?v=${v.videoId}`),
    escapeCSV(v.channel),
    v.views || 0,
    v.vph || 0,
    v.outlier ? `${v.outlier}x` : 'N/A',
    escapeCSV(v.publishedTimeText || `${Math.round(v.hoursAgo)}h ago`),
    escapeCSV(v.isShort ? 'Shorts' : 'Video'),
    escapeCSV(v.durationText || '')
  ]);

  const csvContent = '\uFEFF' + [
    headers.join(','),
    ...rows.map(r => r.join(','))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

if (typeof window !== 'undefined') {
  window.FindTrendExporter = {
    exportVideosToCSV
  };
}
