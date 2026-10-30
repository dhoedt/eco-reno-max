// Auto-advances the skills carousel; navigation itself stays CSS-only (scroll-snap, ::scroll-button, ::scroll-marker)
(function () {
  const CYCLE_DELAY_MS = 5000;

  const track = document.querySelector('.skills-carousel');
  if (!track || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const slides = Array.from(track.children);
  const container = track.parentElement;
  let isVisible = false;
  let lastInteraction = 0;

  // Advances by one slide whatever the snap alignment (centred on phones, start-aligned on wider screens),
  // and wraps back to the first one once the end is reached
  function showNextSlide() {
    const maxScroll = track.scrollWidth - track.clientWidth;
    if (track.scrollLeft >= maxScroll - 1) {
      track.scrollTo({ left: 0 });
      return;
    }
    const slideStep = Math.abs(slides[1].getBoundingClientRect().left - slides[0].getBoundingClientRect().left);
    // scrollBy rather than scrollIntoView: never scrolls the page itself
    track.scrollBy({ left: slideStep });
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
