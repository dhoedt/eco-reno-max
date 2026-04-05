(function () {
  const DEFAULT_LANG = 'fr';
  const PREFERRED_LANGUAGE_KEY = 'ecorenomax-preferred-lang';
  const TRANSLATION_CACHE = {};

  function findPreferredLanguage() {
    var preferred = (navigator.languages || [navigator.language])
      .map((language) => language.slice(0, 2).toLowerCase())
      .find((language) => language === 'fr' || language === 'nl');
    return preferred || DEFAULT_LANG;
  }

  function fetchTranslations(lang) {
    if (TRANSLATION_CACHE[lang]) return Promise.resolve(TRANSLATION_CACHE[lang]);
    return fetch('translations/' + lang + '.json')
      .then(function (file) { return file.json(); })
      .then(function (translation) {
        TRANSLATION_CACHE[lang] = translation;
        return translation;
      });
  }

  function setLanguage(lang) {
    fetchTranslations(lang).then((translation) => {
      applyTranslations(translation);
      document.documentElement.lang = lang;
      document.querySelectorAll('.lang-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.lang === lang);
      });
    });
  }

  function applyTranslations(t) {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      if (t[el.dataset.i18n] !== undefined) el.innerHTML = t[el.dataset.i18n];
    });
    document.querySelectorAll('[data-i18n-alt]').forEach(function (el) {
      if (t[el.dataset.i18nAlt] !== undefined) el.alt = t[el.dataset.i18nAlt];
    });
    document.querySelectorAll('[data-i18n-label]').forEach(function (el) {
      if (t[el.dataset.i18nLabel] !== undefined) el.setAttribute('aria-label', t[el.dataset.i18nLabel]);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!localStorage.getItem(PREFERRED_LANGUAGE_KEY)) {
      localStorage.setItem(PREFERRED_LANGUAGE_KEY, findPreferredLanguage());
    }
    const LANGUAGE = localStorage.getItem(PREFERRED_LANGUAGE_KEY);
    setLanguage(LANGUAGE);
    document.querySelectorAll('.lang-btn')
      .forEach(function (btn) {
        btn.addEventListener('click', () => {
          const CHOSEN_LANGUAGE = btn.dataset.lang;
          localStorage.setItem(PREFERRED_LANGUAGE_KEY, CHOSEN_LANGUAGE);
          setLanguage(CHOSEN_LANGUAGE);
        });
      });
  });
})();
