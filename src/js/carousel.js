// Skills carousel: auto-advance and wrap-around previous / next arrows; swiping and the dots stay CSS-only (scroll-snap, ::scroll-marker).
// The scroll calls leave the behavior to the CSS scroll-behavior: smooth, or instant with prefers-reduced-motion
(function () {
  const CYCLE_DELAY_MS = 2500;

  const track = document.querySelector('.skills-carousel');
  if (!track) return;

  const slides = Array.from(track.children);
  const container = track.parentElement;
  let isVisible = false;
  let lastInteraction = 0;

  // Moves by one slide (direction: 1 = next, -1 = previous) whatever the snap alignment (centred on phones,
  // start-aligned on wider screens), and wraps around to the other end once the first or last one is reached
  function showSlide(direction) {
    const maxScroll = track.scrollWidth - track.clientWidth;
    if (direction > 0 && track.scrollLeft >= maxScroll - 1) {
      track.scrollTo({ left: 0 });
      return;
    }
    if (direction < 0 && track.scrollLeft <= 1) {
      track.scrollTo({ left: maxScroll });
      return;
    }
    const slideStep = Math.abs(slides[1].getBoundingClientRect().left - slides[0].getBoundingClientRect().left);
    // scrollBy rather than scrollIntoView: never scrolls the page itself
    track.scrollBy({ left: direction * slideStep });
  }

  // The arrows are hidden in the HTML so that they never show without the script that drives them
  [['.carousel-button--previous', -1], ['.carousel-button--next', 1]].forEach(function ([selector, direction]) {
    const button = container.querySelector(selector);
    button.hidden = false;
    button.addEventListener('click', function () { showSlide(direction); });
  });

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
    if (!isPaused()) showSlide(1);
  }, CYCLE_DELAY_MS);
})();
