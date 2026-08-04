// Animated expand/collapse for <details>.
//
// Done in JS rather than CSS. The pure-CSS route — transitioning
// ::details-content with interpolate-size — reports as supported here but
// leaves the element at block-size 0 even when [open] matches, so panels
// simply never open. A broken disclosure is far worse than an unanimated one,
// so this drives the height directly instead.
//
// Falls back to native behaviour when the browser can't animate or the user
// has asked it not to.

const DURATION_MS = 300;

function bodyOf(details) {
  return details.querySelector(':scope > .panel__body, :scope > .tuning-item__body, :scope > .advanced__body');
}

function animate(details, body, from, to, done) {
  body.style.overflow = 'hidden';
  body.style.height = `${from}px`;

  requestAnimationFrame(() => {
    body.style.transition = `height ${DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    body.style.height = `${to}px`;
  });

  // transitionend can be missed if the element is re-hidden mid-flight, so
  // the timeout is the source of truth for cleanup.
  setTimeout(() => {
    body.style.transition = '';
    body.style.height = '';
    body.style.overflow = '';
    details.dataset.animating = '';
    if (done) done();
  }, DURATION_MS);
}

export function initDisclosureAnimation(root = document) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  root.querySelectorAll('details').forEach((details) => {
    const summary = details.querySelector(':scope > summary');
    const body = bodyOf(details);
    if (!summary || !body) return;

    summary.addEventListener('click', (event) => {
      // Mid-animation clicks would fight the running transition.
      if (details.dataset.animating === '1') {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      details.dataset.animating = '1';

      if (details.open) {
        animate(details, body, body.scrollHeight, 0, () => { details.open = false; });
      } else {
        details.open = true;
        animate(details, body, 0, body.scrollHeight);
      }
    });
  });
}
