/**
 * utils/i18n.js - English-only i18n helper
 */
(() => {
  function t(key, params = {}) {
    const dict = window.FindTrendTranslations?.['en'] || {};
    let text = dict[key] || key;
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return text;
  }

  if (typeof window !== 'undefined') {
    window.FindTrendI18n = {
      getLang: () => 'en',
      setLang: () => {},
      t
    };
  }
})();
