/* HMC shared button enhancer. v1.0.5

   The hover roll-up is gone (see hmc-buttons-1.0.5.css), and with it everything
   this script existed to support: the label copy, the data attribute holding it,
   and the measurement that placed the overlay. All of that is deleted rather
   than disabled.

   One job is left. Some markup ships its own dot element, and the stylesheet
   also draws a dot, so those buttons would show two. This finds a shipped dot by
   shape rather than class name, because the apps name it differently, and marks
   the button so the CSS dot stands down. It also clears data-hmc-label left on a
   button by an earlier version still sitting in someone's cache.

   Still attribute-only. These surfaces are React apps, and injecting or
   replacing child nodes React owns makes it throw NotFoundError the next time it
   re-renders a button whose label changes, such as a submitting state. Writing
   an attribute is safe: if React overwrites it, the observer re-applies it.

   Usage: `class="hmc-btn hmc-btn-primary"` or `hmc-btn-secondary`.
   Extra selectors can be adopted via `window.HMC_BUTTON_SELECTOR`. */
(function () {
  var SELECTOR = '.hmc-btn';

  /* True when the button already renders its own dot. Markup across the apps
     uses different classes for it, so this looks at shape rather than name:
     a small, empty, fully-rounded element. */
  function hasOwnDot(el) {
    for (var i = 0; i < el.children.length; i++) {
      var c = el.children[i];
      if (c.textContent.trim()) continue;
      var s = getComputedStyle(c);
      var w = parseFloat(s.width);
      if (w && w <= 14 && parseFloat(s.borderTopLeftRadius) >= w / 2 - 0.5) return true;
    }
    return false;
  }

  function enhance(el) {
    if (el.hasAttribute('data-hmc-label')) el.removeAttribute('data-hmc-label');
    if (el.style && el.style.getPropertyValue('--hmc-ov-left')) el.style.removeProperty('--hmc-ov-left');
    if (hasOwnDot(el)) {
      if (el.getAttribute('data-hmc-dot') !== 'off') el.setAttribute('data-hmc-dot', 'off');
    }
  }

  function run() {
    var sel = SELECTOR;
    if (window.HMC_BUTTON_SELECTOR) sel += ',' + window.HMC_BUTTON_SELECTOR;
    document.querySelectorAll(sel).forEach(enhance);
  }

  function start() {
    run();
    if (window.MutationObserver) {
      // Coalesce bursts so a re-rendering app does not re-run this per mutation.
      var queued = false;
      new MutationObserver(function () {
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () { queued = false; run(); });
      }).observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
