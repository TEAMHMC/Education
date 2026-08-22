/* HMC shared button enhancer. v1.0.4

   Behaviour is identical to 1.0.3. The version moves with the stylesheet so a
   page loads one pair and never a 1.0.3 script against a 1.0.4 stylesheet.
   The 1.0.4 fix is entirely in the CSS: the overlay keeps its centred label
   clear of the dot with padding, and the pill can no longer outgrow its card.

   Sets a data attribute holding the button's label. The stylesheet renders it
   as an overlay copy that slides up on hover, which is how the roll-up works
   without a Webflow interaction.

   Deliberately attribute-only. These surfaces are React apps; injecting or
   replacing child nodes that React owns makes React throw NotFoundError the
   next time it re-renders a button whose label changes, such as a submitting
   or busy state. Writing an attribute is safe: if React overwrites it on
   re-render, the observer below simply re-applies it.

   Usage: `class="hmc-btn hmc-btn-primary"` or `hmc-btn-secondary`.
   Opt a button out of the hover copy with `data-hmc-norollup`.
   Extra selectors can be adopted via `window.HMC_BUTTON_SELECTOR`. */
(function () {
  var SELECTOR = '.hmc-btn';

  function label(el) {
    // textContent, not just direct text nodes: several buttons wrap their label
    // in a span, and those were getting no data-hmc-label and so no hover at all.
    return (el.textContent || '').trim();
  }

  /* The overlay covers the button, so a leading icon or dot disappears behind it
     for the duration of the hover. Measure where the label actually starts and
     let the overlay begin there, leaving the icon visible. Writing a custom
     property rather than restructuring keeps this safe for React. */
  function setOverlayInset(el) {
    var first = el.firstElementChild;
    if (!first) { el.style.removeProperty('--hmc-ov-left'); return; }
    var eb = el.getBoundingClientRect();
    var fb = first.getBoundingClientRect();
    if (!fb.width) { el.style.removeProperty('--hmc-ov-left'); return; }
    var gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    var left = Math.max(0, Math.round(fb.right - eb.left + gap));
    el.style.setProperty('--hmc-ov-left', left + 'px');
  }

  /* True when the button already renders its own dot. Markup across the apps
     uses different classes for it, so this looks at shape rather than name:
     a small, empty, fully-rounded element. Without this the CSS dot and the
     markup dot both render and the button shows two. */
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
    if (el.hasAttribute('data-hmc-norollup')) return;
    if (hasOwnDot(el)) {
      if (el.getAttribute('data-hmc-dot') !== 'off') el.setAttribute('data-hmc-dot', 'off');
    }
    var text = label(el);
    // Buttons that are icon-only have nothing to roll.
    if (!text) { el.removeAttribute('data-hmc-label'); return; }
    if (el.getAttribute('data-hmc-label') !== text) el.setAttribute('data-hmc-label', text);
    setOverlayInset(el);
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
