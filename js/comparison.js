// Before/after sliders: the invisible range input drives the --split position used by the CSS
(function () {
  document.querySelectorAll('.comparison').forEach(function (comparison) {
    const range = comparison.querySelector('.comparison-range');
    range.addEventListener('input', function () {
      comparison.style.setProperty('--split', range.value + '%');
    });
  });
})();
