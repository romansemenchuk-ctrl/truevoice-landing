/* =========================================================
   TRUE VOICE — REMIX · FLOW ENGINE (plain JS, no React)
   • breathing overlay in hero (shared 4.6s rhythm)
   • depth entrance for sections (scale/fade)
   • marquee band soft entry
   • light horizon following scroll with inertia lag
   ========================================================= */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  var tries = 0;
  function init() {
    var hero = document.querySelector('.tv-hero');
    if (!hero) {
      if (tries++ < 60) setTimeout(init, 200);
      return;
    }

    /* breathing overlay inside hero */
    if (!hero.querySelector('.flow-breath')) {
      var breath = document.createElement('div');
      breath.className = 'flow-breath';
      breath.setAttribute('aria-hidden', 'true');
      hero.insertBefore(breath, hero.firstChild);
    }

    var isMobile = window.matchMedia('(max-width: 719px)').matches;

    /* light horizon layer (desktop only) */
    var horizon = null;
    if (!isMobile) {
      horizon = document.createElement('div');
      horizon.className = 'flow-horizon';
      horizon.setAttribute('aria-hidden', 'true');
      document.body.appendChild(horizon);
    }

    /* depth targets: all sections except hero */
    var depth = [];
    document.querySelectorAll('.tv-section').forEach(function (s) {
      if (s.classList.contains('tv-hero')) return;
      s.classList.add('flow-depth');
      depth.push(s);
    });

    /* marquee bands */
    var bands = Array.prototype.slice.call(document.querySelectorAll('.kx-band'));

    /* reveal sweep — must NOT depend on rAF (throttled tabs, capture) */
    function sweep() {
      var vh = window.innerHeight;
      for (var i = depth.length - 1; i >= 0; i--) {
        if (depth[i].getBoundingClientRect().top < vh * 0.92) {
          depth[i].classList.add('flow-in');
          depth.splice(i, 1);
        }
      }
      for (var j = bands.length - 1; j >= 0; j--) {
        var r = bands[j].getBoundingClientRect();
        if (r.top < vh && r.bottom > 0) {
          bands[j].classList.add('flow-band-in');
          bands.splice(j, 1);
        }
      }
    }
    sweep();
    setTimeout(sweep, 60);
    setTimeout(sweep, 400);
    window.addEventListener('scroll', sweep, { passive: true });
    window.addEventListener('resize', sweep, { passive: true });
    /* timer safety net: scroll/rAF are throttled in capture & background contexts */
    var iv = setInterval(function () {
      sweep();
      if (!depth.length && !bands.length) clearInterval(iv);
    }, 500);

    /* rAF loop only for the horizon lag (non-critical polish).
       Compositor-only: we translate the layer instead of rewriting the
       gradient, and we park the loop once the lag has settled. */
    if (horizon) {
      var smooth = window.scrollY || 0;
      var lastPx = null;
      var frame = function () {
        var y = window.scrollY || 0;
        smooth += (y - smooth) * 0.075;
        var px = Math.max(-90, Math.min(90, (y - smooth) * 0.9));
        // skip the style write entirely while the lag is settled
        if (lastPx === null || Math.abs(px - lastPx) > 0.3) {
          horizon.style.transform = 'translate3d(0,' + px.toFixed(1) + 'px,0)';
          lastPx = px;
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
