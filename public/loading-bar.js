/**
 * MFS loading progress bar.
 *
 * A thin bar pinned to the top of the document that creeps forward while the
 * page loads, snaps to 100% when it is ready, then fades away. It is shared by
 * the workspace shell and every legacy module, and can also be driven manually:
 *
 *   window.MFSProgress.start();   // begin (e.g. before switching module)
 *   window.MFSProgress.done();    // finish (e.g. when the module is ready)
 *
 * Pointer events are disabled, so the page stays usable while it runs.
 */
(function () {
  'use strict';
  if (window.MFSProgress) return;

  var reduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
  var MIN_SHOW_DELAY = 120;   // don't flash the bar for instant loads
  var SAFETY_MS = 20000;      // never leave the bar hanging

  var bar = null;
  var fill = null;
  var shown = false;          // the bar has been added to the page
  var finished = false;
  var value = 0;
  var creepTimer = null;
  var showTimer = null;
  var safetyTimer = null;

  // The script sits in <head>, so <body> may not exist yet on first run.
  function whenBodyReady(callback) {
    if (document.body) { callback(); return; }
    document.addEventListener('DOMContentLoaded', function () { callback(); }, { once: true });
  }

  function build() {
    if (bar || !document.body) return;
    bar = document.createElement('div');
    bar.className = 'mfs-progress';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', 'Loading');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', '0');
    fill = document.createElement('i');
    bar.appendChild(fill);
    document.body.appendChild(bar);
  }

  function paint(next) {
    value = Math.max(value, Math.min(100, next));
    if (fill) fill.style.width = value + '%';
    if (bar) bar.setAttribute('aria-valuenow', String(Math.round(value)));
  }

  function creep() {
    if (creepTimer) return;
    creepTimer = window.setInterval(function () {
      if (finished) return;
      var step = value < 50 ? 6 : value < 80 ? 2.4 : value < 93 ? 0.9 : 0.3;
      paint(value + step);
    }, 170);
  }

  function show() {
    if (shown || finished) return;
    if (!document.body) { showTimer = window.setTimeout(show, 60); return; }
    build();
    if (!bar) return;
    shown = true;
    window.requestAnimationFrame(function () { if (bar) bar.classList.add('is-visible'); });
    paint(7);
    creep();
  }

  function stopCreep() {
    if (creepTimer) { window.clearInterval(creepTimer); creepTimer = null; }
  }

  function remove() {
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    bar = null;
    fill = null;
    shown = false;
  }

  function finish(delay, failed) {
    if (finished) return;
    finished = true;
    stopCreep();
    if (safetyTimer) { window.clearTimeout(safetyTimer); safetyTimer = null; }
    if (showTimer) { window.clearTimeout(showTimer); showTimer = null; }
    if (!shown || !bar) return;               // never appeared: nothing to hide
    if (failed) bar.classList.add('is-error');
    paint(100);
    window.setTimeout(function () {
      if (!bar) return;
      bar.classList.remove('is-visible');
      window.setTimeout(remove, reduced ? 0 : 320);
    }, delay);
  }

  window.MFSProgress = {
    start: function () {
      finished = false;
      value = 0;
      stopCreep();
      if (bar) { paint(7); creep(); return; }   // already on screen
      if (showTimer) window.clearTimeout(showTimer);
      if (safetyTimer) window.clearTimeout(safetyTimer);
      showTimer = window.setTimeout(show, MIN_SHOW_DELAY);
      safetyTimer = window.setTimeout(function () { finish(0, false); }, SAFETY_MS);
    },
    done: function () { finish(180, false); },
    fail: function () { finish(450, true); }
  };

  // Automatic behaviour for a normal document load.
  if (document.readyState !== 'complete') {
    window.MFSProgress.start();
    window.addEventListener('load', function () { window.MFSProgress.done(); }, { once: true });
  }
})();
