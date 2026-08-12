/* @jsx React.createElement */
/* =========================================================
   VoiceAmbient — глобальний фон сайту.

   Складається з:
   • VoiceSpine: фіксована вертикальна тонка лінія на правому
     краю екрана з живою осцилограмою. Показує прогрес скролу
     як точку-«головку запису». Працює весь час.
   • VoiceDrift: два повільно дрейфуючих градієнтних плями
     (red + gold) у fixed-шарі позаду всього сайту.
     Низька непрозорість, дуже повільний рух. Видно
     крізь напівпрозорі секції та в проміжках.
   • SectionMarks: маленькі реєстраційні мітки (tech-кутики)
     у кутах кожної секції — додає кінематографічного ритму.
   ========================================================= */

const { useEffect: useAmbEff, useRef: useAmbRef, useState: useAmbState } = React;

/* ── Spine: правий край, осцилограма + scroll head ───────── */
function VoiceSpine({ accent = '#C8102E', enabled = true }) {
  const canvasRef = useAmbRef(null);
  const rafRef    = useAmbRef(0);
  const scrollRef = useAmbRef(0);
  const totalRef  = useAmbRef(1);

  useAmbEff(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });

    let W = 0, H = 0, DPR = 1;

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 1.75);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width  = Math.floor(W * DPR);
      canvas.height = Math.floor(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function onScroll() {
      scrollRef.current = window.scrollY || 0;
      totalRef.current = Math.max(1,
        (document.documentElement.scrollHeight || 0) - window.innerHeight
      );
    }

    function hexToRGBA(hex, a) {
      const h = hex.replace('#', '');
      const r = parseInt(h.length === 3 ? h[0]+h[0] : h.slice(0,2), 16);
      const g = parseInt(h.length === 3 ? h[1]+h[1] : h.slice(2,4), 16);
      const b = parseInt(h.length === 3 ? h[2]+h[2] : h.slice(4,6), 16);
      return `rgba(${r},${g},${b},${a})`;
    }

    function frame(now) {
      const t = now * 0.001;
      ctx.clearRect(0, 0, W, H);

      // base axis
      const axisX = W * 0.5;
      ctx.strokeStyle = 'rgba(245,245,242,0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(axisX, 0); ctx.lineTo(axisX, H);
      ctx.stroke();

      // oscillogram — vertical line with horizontal noise/sine
      ctx.beginPath();
      const segs = Math.max(60, Math.floor(H / 6));
      for (let i = 0; i <= segs; i++) {
        const f = i / segs;
        const y = f * H;
        const amp =
          Math.sin(t * 0.9 + f * 14) * 2.4
        + Math.sin(t * 1.7 + f * 27) * 1.2
        + Math.sin(t * 0.3 + f * 4)  * 1.6;
        const x = axisX + amp;
        if (i === 0) ctx.moveTo(x, y);
        else         ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(245,232,200,0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // scroll head — moving dot + accent burst at progress
      const prog = Math.min(1, Math.max(0, scrollRef.current / totalRef.current));
      const headY = prog * H;
      // accent glow halo
      const grd = ctx.createRadialGradient(axisX, headY, 0, axisX, headY, 36);
      grd.addColorStop(0, hexToRGBA(accent, 0.5));
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(axisX - 36, headY - 36, 72, 72);

      // dot
      ctx.fillStyle = hexToRGBA(accent, 0.95);
      ctx.beginPath();
      ctx.arc(axisX, headY, 2.6, 0, Math.PI * 2);
      ctx.fill();

      // short tick at head
      ctx.strokeStyle = hexToRGBA(accent, 0.7);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(axisX - 6, headY); ctx.lineTo(axisX + 6, headY);
      ctx.stroke();

      // a few static reference ticks
      for (let k = 0; k < 11; k++) {
        const y = (k / 10) * H;
        ctx.strokeStyle = 'rgba(245,245,242,0.10)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(axisX - (k % 5 === 0 ? 5 : 3), y);
        ctx.lineTo(axisX + (k % 5 === 0 ? 5 : 3), y);
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    function start() { if (!rafRef.current) rafRef.current = requestAnimationFrame(frame); }
    function stop()  { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
    function onVis() { if (document.hidden) stop(); else start(); }

    resize();
    onScroll();
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    start();

    return () => {
      stop();
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [accent, enabled]);

  if (!enabled) return null;
  return (
    <div className="tv-spine" aria-hidden="true">
      <canvas ref={canvasRef} className="tv-spine-canvas"/>
      <div className="tv-spine-label tv-spine-label--top">VOX · 432Hz</div>
      <div className="tv-spine-label tv-spine-label--bot">REC · ∞</div>
    </div>
  );
}

/* ── Drift: fixed-position slow color blobs ─────────────── */
function VoiceDrift({ accent = '#C8102E', enabled = true }) {
  if (!enabled) return null;
  return (
    <div className="tv-drift" aria-hidden="true">
      <span
        className="tv-drift-blob tv-drift-blob--a"
        style={{ background: `radial-gradient(closest-side, ${accent}33, transparent 70%)` }}
      />
      <span className="tv-drift-blob tv-drift-blob--b" />
      <span
        className="tv-drift-blob tv-drift-blob--c"
        style={{ background: `radial-gradient(closest-side, ${accent}22, transparent 70%)` }}
      />
    </div>
  );
}

/* ── StarField: три шари зірок з паралаксом на скролі ──────
   Perf note: the first version drew ~385 arc() paths (x3 wrapped
   copies) every frame — over a thousand path ops per frame, which
   is what made the cursor and scroll stutter. Each layer is now
   pre-rendered once into an offscreen sprite; a frame costs a
   handful of drawImage calls. Twinkle survives by crossfading two
   pre-baked alpha phases, and the scroll offset is eased so the
   parallax reads as fluid rather than locked to the wheel. */
function StarField({ enabled = true }) {
  const canvasRef = useAmbRef(null);
  const rafRef    = useAmbRef(0);

  useAmbEff(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let W = 0, H = 0, DPR = 1;
    let sprites = [];            // [{a, b}] offscreen canvases per layer
    let targetScroll = 0, easedScroll = 0;
    let running = false;

    const LAYERS = [
      { count: 220, minR: 0.3, maxR: 0.7, baseA: 0.60, parallax: 0.06, tw: 0.55 },
      { count: 110, minR: 0.6, maxR: 1.1, baseA: 0.45, parallax: 0.14, tw: 0.42 },
      { count:  55, minR: 0.9, maxR: 1.6, baseA: 0.35, parallax: 0.26, tw: 0.30 },
    ];

    /* bake one layer into a sprite at a given twinkle phase */
    function bakeLayer(layer, stars, phase) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.floor(W * DPR));
      c.height = Math.max(1, Math.floor(H * DPR));
      const g = c.getContext('2d');
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      g.fillStyle = '#F5F5F2';
      for (const s of stars) {
        // per-star alpha differs between the two phases -> crossfade twinkles
        const t = 0.55 + 0.45 * Math.sin(s.phase + phase);
        g.globalAlpha = layer.baseA * (1 - layer.tw + layer.tw * t);
        g.beginPath();
        g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        g.fill();
      }
      return c;
    }

    function build() {
      sprites = LAYERS.map((layer) => {
        const stars = Array.from({ length: layer.count }, () => ({
          x: Math.random() * W,
          y: Math.random() * H,
          r: layer.minR + Math.random() * (layer.maxR - layer.minR),
          phase: Math.random() * Math.PI * 2,
        }));
        return { a: bakeLayer(layer, stars, 0), b: bakeLayer(layer, stars, Math.PI) };
      });
    }

    function resize() {
      const nDPR = Math.min(window.devicePixelRatio || 1, 1.5);
      const nW = canvas.clientWidth, nH = canvas.clientHeight;
      if (nW === W && nH === H && nDPR === DPR) return;
      DPR = nDPR; W = nW; H = nH;
      canvas.width = Math.floor(W * DPR);
      canvas.height = Math.floor(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      build();
    }

    function onScroll() { targetScroll = window.scrollY || 0; }

    function frame(now) {
      // inertial follow — this is what makes the parallax feel alive
      easedScroll += (targetScroll - easedScroll) * 0.085;
      const t = now * 0.001;

      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < sprites.length; i++) {
        const layer = LAYERS[i], sp = sprites[i];
        if (!sp) continue;
        let off = (-easedScroll * layer.parallax) % H;
        if (off > 0) off -= H;

        // crossfade the two baked phases (skipped when reduced-motion)
        const mix = reduced ? 1 : 0.5 + 0.5 * Math.sin(t * 0.6 + i * 1.7);
        for (let pass = 0; pass < 2; pass++) {
          const img = pass === 0 ? sp.a : sp.b;
          const alpha = pass === 0 ? mix : 1 - mix;
          if (alpha <= 0.01) continue;
          ctx.globalAlpha = alpha;
          ctx.drawImage(img, 0, off, W, H);
          ctx.drawImage(img, 0, off + H, W, H);
        }
      }
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(frame);
    }

    function start() { if (!running) { running = true; rafRef.current = requestAnimationFrame(frame); } }
    function stop()  { running = false; cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
    function onVis() { if (document.hidden) stop(); else start(); }

    resize();
    onScroll();
    easedScroll = targetScroll;
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    start();

    return () => {
      stop();
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVis);
      sprites = [];
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
        mixBlendMode: 'screen',
      }}
    />
  );
}

function VoiceAmbient({ accent = '#C8102E', spine = true, drift = true }) {
  return (
    <>
      <StarField enabled={true}/>
      <VoiceDrift accent={accent} enabled={drift}/>
      <VoiceSpine accent={accent} enabled={spine}/>
    </>
  );
}

window.VoiceAmbient = VoiceAmbient;
window.VoiceSpine   = VoiceSpine;
window.VoiceDrift   = VoiceDrift;
