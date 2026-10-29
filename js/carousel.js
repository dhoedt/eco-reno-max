// Auto-advances the skills carousel; navigation itself stays CSS-only (scroll-snap, ::scroll-button, ::scroll-marker)
(function () {
  const CYCLE_DELAY_MS = 5000;

  const track = document.querySelector('.skills-carousel');
  if (!track || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const slides = Array.from(track.children);
  const container = track.parentElement;
  let isVisible = false;
  let lastInteraction = 0;

  function centerOffset(element) {
    const rect = element.getBoundingClientRect();
    return rect.left + rect.width / 2;
  }

  function currentIndex() {
    const trackCenter = centerOffset(track);
    let closestIndex = 0;
    slides.forEach(function (slide, index) {
      if (Math.abs(centerOffset(slide) - trackCenter) < Math.abs(centerOffset(slides[closestIndex]) - trackCenter)) {
        closestIndex = index;
      }
    });
    return closestIndex;
  }

  function showNextSlide() {
    const nextSlide = slides[(currentIndex() + 1) % slides.length];
    // scrollBy rather than scrollIntoView: never scrolls the page itself
    track.scrollBy({ left: centerOffset(nextSlide) - centerOffset(track) });
  }

  // Paused while off-screen, in a background tab, hovered, focused, or shortly after the user moved it
  function isPaused() {
    return !isVisible
      || document.hidden
      || container.matches(':hover, :focus-within')
      || Date.now() - lastInteraction < CYCLE_DELAY_MS;
  }

  ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach(function (eventName) {
    container.addEventListener(eventName, function () { lastInteraction = Date.now(); }, { passive: true });
  });

  new IntersectionObserver(function (entries) {
    isVisible = entries[0].isIntersecting;
  }).observe(track);

  setInterval(function () {
    if (!isPaused()) showNextSlide();
  }, CYCLE_DELAY_MS);
})();
