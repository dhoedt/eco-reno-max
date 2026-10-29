// Translates the page from translations/<language>.json; the HTML itself is written in the default language
(function () {
  const DEFAULT_LANGUAGE = 'fr';
  const SUPPORTED_LANGUAGES = ['fr', 'nl'];
  const PREFERRED_LANGUAGE_KEY = 'ecorenomax-preferred-lang';
  const translationCache = {};

  function isSupported(language) {
    return SUPPORTED_LANGUAGES.includes(language);
  }

  // localStorage throws in some privacy modes: the choice is then simply not remembered
  function readStoredLanguage() {
    try {
      return localStorage.getItem(PREFERRED_LANGUAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  function storeLanguage(language) {
    try {
      localStorage.setItem(PREFERRED_LANGUAGE_KEY, language);
    } catch (error) {
      // Not remembered, but the page is still translated
    }
  }

  function findBrowserLanguage() {
    const browserLanguage = (navigator.languages || [navigator.language])
      .map(function (language) { return language.slice(0, 2).toLowerCase(); })
      .find(isSupported);
    return browserLanguage || DEFAULT_LANGUAGE;
  }

  // An explicit choice wins; otherwise follow the browser, without storing it so later browser changes still apply
  function findInitialLanguage() {
    const storedLanguage = readStoredLanguage();
    return isSupported(storedLanguage) ? storedLanguage : findBrowserLanguage();
  }

  function fetchTranslations(language) {
    if (translationCache[language]) return Promise.resolve(translationCache[language]);
    return fetch('translations/' + language + '.json')
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (translations) {
        translationCache[language] = translations;
        return translations;
      });
  }

  // Translations may hold markup (e.g. <strong>), hence innerHTML; the JSON files are first-party
  function applyTranslations(translations) {
    document.querySelectorAll('[data-i18n]').forEach(function (element) {
      const text = translations[element.dataset.i18n];
      if (text !== undefined) element.innerHTML = text;
    });
    document.querySelectorAll('[data-i18n-alt]').forEach(function (element) {
      const text = translations[element.dataset.i18nAlt];
      if (text !== undefined) element.alt = text;
    });
    document.querySelectorAll('[data-i18n-label]').forEach(function (element) {
      const text = translations[element.dataset.i18nLabel];
      if (text !== undefined) element.setAttribute('aria-label', text);
    });
  }

  function markActiveLanguage(language) {
    document.documentElement.lang = language;
    document.querySelectorAll('.lang-btn').forEach(function (button) {
      button.classList.toggle('active', button.dataset.lang === language);
    });
  }

  // On failure the page keeps its current language rather than ending up half translated
  function setLanguage(language) {
    return fetchTranslations(language)
      .then(function (translations) {
        applyTranslations(translations);
        markActiveLanguage(language);
      })
      .catch(function (error) {
        console.warn('Translation "' + language + '" unavailable:', error);
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    const initialLanguage = findInitialLanguage();
    // The HTML is already in the default language: no need to fetch it on load
    if (initialLanguage !== DEFAULT_LANGUAGE) setLanguage(initialLanguage);

    document.querySelectorAll('.lang-btn').forEach(function (button) {
      button.addEventListener('click', function () {
        const chosenLanguage = button.dataset.lang;
        storeLanguage(chosenLanguage);
        setLanguage(chosenLanguage);
      });
    });
  });
})();
