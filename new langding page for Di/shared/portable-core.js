// Tiny language layer so the portable sections work in any project.
// If the host project already has its own t() / getLang() / onLang(), those are used instead.
(function () {
  const store = window.I18N = window.I18N || { en: {}, vi: {} };
  let lang = (navigator.language || '').startsWith('vi') ? 'vi' : 'en';
  try { const s = localStorage.getItem('lang'); if (s === 'en' || s === 'vi') lang = s; } catch (e) {}
  const hooks = [];
  if (!window.getLang) window.getLang = () => lang;
  if (!window.setLang) window.setLang = l => { lang = l; try { localStorage.setItem('lang', l); } catch (e) {} };
  if (!window.t) window.t = k => { const L = window.getLang(); return store[L] && store[L][k] != null ? store[L][k] : (store.en[k] != null ? store.en[k] : k); };
  if (!window.onLang) window.onLang = fn => hooks.push(fn);

  window.Cyano = {
    // merge { en: {...}, vi: {...} } into the shared dictionary
    addStrings(d) { ['en', 'vi'].forEach(l => Object.assign(store[l] = store[l] || {}, d[l] || {})); },
    // translate every [data-i18n] / [data-i18n-html] on the page, then run the sections' refresh hooks
    applyLang() {
      document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = window.t(el.dataset.i18n); });
      document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = window.t(el.dataset.i18nHtml); });
      hooks.forEach(fn => fn());
    },
    setLang(l) { window.setLang(l); window.Cyano.applyLang(); }
  };
})();
