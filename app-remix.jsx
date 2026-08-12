/* @jsx React.createElement */
/* =========================================================
   TRUE VOICE — REMIX app entry
   Same sections, same copy — moodboard kinetic skin.
   New HeroRemix + KineticBand interludes + global FX.
   ========================================================= */

const { useState: useRxState, useEffect: useRxEffect, useCallback: useRxCb, useRef: useRxRef } = React;

const RX_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#E60012",
  "motion": "wall",
  "showSticky": true,
  "showSacredRing": false,
  "showSpine": true,
  "showDrift": true
}/*EDITMODE-END*/;

function rxGlow(hex, a) {
  if (!hex || hex[0] !== '#') return `rgba(230,0,18,${a})`;
  const h = hex.replace('#', '');
  const r = parseInt(h.length === 3 ? h[0]+h[0] : h.slice(0,2), 16);
  const g = parseInt(h.length === 3 ? h[1]+h[1] : h.slice(2,4), 16);
  const b = parseInt(h.length === 3 ? h[2]+h[2] : h.slice(4,6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ---------- icons — one family: 24-grid, 1.5 stroke, round caps ---------- */
const TV_ICON_PATHS = {
  // waveform pulse — "you hear the change"
  pulse:   <><path d="M2 12h3.2l2.4-7 3.4 14 2.8-9.5 2 5H22"/></>,
  // feather — "nothing to learn, it stays light"
  feather: <><path d="M20.2 3.8c-3.6-2-9 .4-11.6 3-2.2 2.2-2.8 5.2-2 7.6L3 20l5.6-3.6c2.4.8 5.4.2 7.6-2 2.6-2.6 5-8 4-10.6Z"/><path d="M8.6 16.4 16 9"/></>,
  // microphone — "proven on stage"
  mic:     <><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21m-3 0h6"/></>,
  play:    <><path d="M8 5.2 19 12 8 18.8V5.2Z"/></>,
  shield:  <><path d="M12 2.8 4.5 6v6c0 4.2 3 7.4 7.5 9.2 4.5-1.8 7.5-5 7.5-9.2V6L12 2.8Z"/><path d="m8.8 12 2.3 2.3 4.1-4.6"/></>,
};

function TvIcon({ name, size = 20 }) {
  const d = TV_ICON_PATHS[name];
  if (!d) return null;
  return (
    <svg className="tv-icon" width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {d}
    </svg>
  );
}
window.TvIcon = TvIcon;

/* ---------- hero intro clip ----------
   It is a minute of Roman talking to camera, so it does NOT autoplay:
   a muted looping monologue reads as broken. The poster shows until
   the viewer chooses to watch, then it plays with sound and controls.
   If assets/intro.mp4 is missing, onError swaps in the stage still. */
function HeroIntro() {
  const [failed, setFailed] = useRxState(false);
  const [playing, setPlaying] = useRxState(false);
  const ref = useRxRef(null);

  const start = useRxCb(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = false;
    v.play().then(() => setPlaying(true)).catch(() => {
      // some browsers refuse unmuted playback — fall back to muted
      v.muted = true;
      v.play().then(() => setPlaying(true)).catch(() => {});
    });
  }, []);

  if (failed) {
    return (
      <img
        src="assets/roman-stage.jpg"
        alt="Роман Семенчук співає на сцені"
        width="1440" height="990"
        loading="eager" decoding="async" />
    );
  }

  return (
    <>
      <video
        ref={ref}
        className={`tv-hero-video ${playing ? 'is-playing' : ''}`}
        src="assets/intro.mp4"
        poster="assets/intro-poster.jpg"
        width="1100" height="623"
        playsInline preload="none"
        controls={playing}
        onEnded={() => setPlaying(false)}
        onError={() => setFailed(true)}
        aria-label="Інтро: Роман Семенчук про TrueVoice" />
      {!playing && (
        <button type="button" className="tv-hero-play" onClick={start}>
          <span className="ring" aria-hidden="true">
            <window.TvIcon name="play" size={18} />
          </span>
          <span className="lbl">Дивитись інтро<span className="dur"> · 0:57</span></span>
        </button>
      )}
    </>
  );
}
window.HeroIntro = HeroIntro;

/* ---------- HERO (remix) — preserves all original text ---------- */
function HeroRemix({ onApply, motion = 'wall', accent = '#E60012' }) {
  const reduced = motion === 'off';
  const density = motion === 'wall' ? 1 : 0.6;
  const label = (window.startDateLabel ? window.startDateLabel() : '');

  return (
    <section className="tv-hero" id="top">
      {/* moving canvas field */}
      <div className="tv-hero-stage" data-parallax="0.12" aria-hidden="true">
        {motion === 'wall' && window.VoiceWall
          ? <window.VoiceWall accent={accent} density={density} reduced={reduced} intensity={1.15} />
          : window.VoiceColumn
            ? <window.VoiceColumn accent={accent} density={density} reduced={reduced} />
            : null}
        <div className="tv-hero-horizon" />
      </div>

      {/* giant parallax watermark */}
      <div className="hx-ghost" data-parallax="0.22" aria-hidden="true">ГОЛОС</div>

      <div className="tv-hero-inner">
       <div className="tv-hero-main">
        <div className="tv-hero-meta tv-reveal">
          <span className="tv-pill">Онлайн-курс від Романа Семенчука</span>
          <span className="tv-pill tv-pill--accent"><span className="dot" />Старт {label}</span>
        </div>

        <div className="tv-hero-wordmark tv-reveal" style={{ animationDelay: '80ms' }} aria-label="TRUE VOICE">
          <span className="t1">TRUE</span>
          <span className="t2">VOICE</span>
        </div>

        <h1 className="tv-hero-headline tv-reveal" style={{ animationDelay: '160ms' }}>
          Перестань <span className="ital">втрачати</span> голос перед виступом —{' '}
          <span className="tv-hero-accent">7 днів до живого звучання<span className="dot" style={{ color: 'var(--tv-accent)' }}>.</span></span>
        </h1>

        <p className="tv-hero-sub tv-reveal" style={{ animationDelay: '240ms' }}>
          7 практик по 15–20 хвилин через Telegram-бот відновлюють дихання, розслабляють тіло і повертають голосу природну силу.
        </p>

        {/* offer field: badge left · price centre · CTA right */}
        <div className="tv-hero-offer tv-reveal" style={{ animationDelay: '300ms' }}>
          <span className="tv-save-badge" aria-label="Знижка 85 відсотків">
            <span className="pct">−85%</span>
            <span className="lbl">знижка</span>
          </span>

          <div className="tv-hero-price">
            <span className="old">100&nbsp;$</span>
            <span className="arr">→</span>
            <span className="new">15&nbsp;$</span>
            <span className="til">7 місяців доступу</span>
            <span className="tv-hero-warranty">
              <window.TvIcon name="shield" size={14} />
              14 днів гарантії повернення
            </span>
          </div>

          <button className="tv-btn tv-btn--big" onClick={onApply}>
            Забрати всього за&nbsp;$15 <span className="arrow">→</span>
          </button>
        </div>
       </div>

       <aside className="tv-hero-aside tv-reveal" style={{ animationDelay: '440ms' }}>
        <figure className="tv-hero-shot">
          <window.HeroIntro />
        </figure>

        {/* review lives below the frame now — nothing sits on the video */}
        <figure className="tv-hero-review">
          <figcaption className="tv-hero-review-tag">
            <span className="dot" />Відгук учасника
          </figcaption>
          <blockquote>
            «На 3–4 день почала відпускати щелепа, голос став нижчим і теплішим».
          </blockquote>
          <cite>Віктор Терент’єв <span>· бізнес-коуч</span></cite>
        </figure>

        <ul className="tv-hero-specs">
          <li>
            <window.TvIcon name="pulse" />
            <strong>Перші зміни — вже після першої практики</strong>
            <em>Не через місяць. Сьогодні ввечері.</em>
          </li>
          <li>
            <window.TvIcon name="feather" />
            <strong>Вміти співати не треба</strong>
            <em>Без нот, вокальної теорії та музичної освіти.</em>
          </li>
          <li>
            <window.TvIcon name="mic" />
            <strong>Метод перевірений сценою</strong>
            <em>30+ років досвіду, 1000+ живих виступів.</em>
          </li>
        </ul>
       </aside>
      </div>

      <div className="tv-hero-tape" aria-hidden="true">
        <span>TC · 00:00:18</span><span>·</span>
        <span>VOX · 432 Hz</span><span>·</span>
        <span>ƒ 2.0</span><span>·</span>
        <span className="dot" /><span>REC</span>
      </div>
    </section>
  );
}

/* ---------- band content (thematic kinetic dividers) ---------- */
const BAND_1 = [
  { t: 'Дихай', kind: 'stroke' }, { kind: 'star' },
  { t: 'Звучи', kind: 'red' },    { kind: 'star' },
  { t: 'Відчуй', kind: 'stroke' },{ kind: 'star' },
  { t: 'Повернись', kind: 'solid' }, { kind: 'star' },
];
const BAND_2 = [
  { t: 'Тіло', kind: 'solid' },     { kind: 'star' },
  { t: 'Нерви', kind: 'stroke' },   { kind: 'star' },
  { t: 'Звук', kind: 'red' },       { kind: 'star' },
  { t: 'Резонанс', kind: 'stroke' },{ kind: 'star' },
];
const BAND_3 = [
  { t: '7 днів', kind: 'red' },        { kind: 'star' },
  { t: '7 практик', kind: 'stroke' },  { kind: 'star' },
  { t: 'Одне повернення', kind: 'solid' }, { kind: 'star' },
];
const BAND_4 = [
  { t: 'Живий голос', kind: 'solid' }, { kind: 'star' },
  { t: 'True Voice', kind: 'solid' },  { kind: 'star' },
  { t: 'Усе в тобі', kind: 'solid' },  { kind: 'star' },
];

function App() {
  const [t, setTweak] = window.useTweaks ? window.useTweaks(RX_DEFAULTS) : [RX_DEFAULTS, () => {}];
  const [popupOpen, setPopupOpen] = useRxState(false);
  const openPopup = useRxCb(() => {
    if (window.fbq) {
      window.fbq('track', 'InitiateCheckout', { content_name: 'TrueVoice Mini', value: 15, currency: 'USD' });
    }
    setPopupOpen(true);
  }, []);
  const closePopup = useRxCb(() => setPopupOpen(false), []);

  useRxEffect(() => {
    const el = document.documentElement;
    el.style.setProperty('--tv-accent', t.accent);
    el.style.setProperty('--accent', t.accent);
    el.style.setProperty('--tv-accent-glow', rxGlow(t.accent, 0.55));
    el.style.setProperty('--accent-glow', rxGlow(t.accent, 0.55));
    el.style.setProperty('--tv-accent-soft', rxGlow(t.accent, 0.16));
    el.dataset.sacred = t.showSacredRing ? 'on' : 'off';
  }, [t.accent, t.showSacredRing]);

  const W = window;
  return (
    <>
      {W.VoiceAmbient ? <W.VoiceAmbient accent={t.accent} spine={t.showSpine !== false} drift={t.showDrift !== false} /> : null}
      <W.Nav onApply={openPopup} />
      <HeroRemix onApply={openPopup} motion={t.motion} accent={t.accent} />

      <W.KineticBand items={BAND_1} variant="dark" speed={36} />
      <W.Manifest />
      <W.Pains />

      <W.KineticBand items={BAND_2} variant="dark" speed={42} reverse />
      <W.Method />
      <W.Founder />
      <W.Program />

      <W.KineticBand items={BAND_3} variant="dark" speed={34} />
      <W.HowItWorks onApply={openPopup} />
      <W.Bonuses />
      <W.Outcomes />
      <W.BeforeAfter />
      <W.Voices />
      <W.Guarantee />

      <W.KineticBand items={BAND_4} variant="accent" speed={30} reverse />
      <W.FinalCTA onApply={openPopup} />
      <W.FAQ />
      <W.Footer />

      {t.showSticky !== false ? <W.StickyBar onApply={openPopup} /> : null}
      <W.Popup open={popupOpen} onClose={closePopup} />

      {W.KineticEffects ? <W.KineticEffects /> : null}
      <RxTweaks tweaks={t} setTweak={setTweak} />
    </>
  );
}

function RxTweaks({ tweaks, setTweak }) {
  if (!window.TweaksPanel) return null;
  const { TweaksPanel, TweakSection, TweakColor, TweakRadio, TweakToggle } = window;
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection title="Сигнальний колір">
        <TweakColor
          label="Акцент"
          value={tweaks.accent}
          onChange={(v) => setTweak('accent', v)}
          options={['#E60012', '#FF2A1A', '#C8102E', '#FF4D00']}
        />
      </TweakSection>
      <TweakSection title="Hero-рух">
        <TweakRadio
          label="Поле"
          value={tweaks.motion}
          onChange={(v) => setTweak('motion', v)}
          options={[
            { value: 'wall', label: 'Wall' },
            { value: 'cinematic', label: 'Column' },
            { value: 'off', label: 'Off' },
          ]}
        />
        <TweakToggle label="Сакральне кільце" value={tweaks.showSacredRing} onChange={(v) => setTweak('showSacredRing', v)} />
      </TweakSection>
      <TweakSection title="Атмосфера">
        <TweakToggle label="Spine (правий край)" value={tweaks.showSpine !== false} onChange={(v) => setTweak('showSpine', v)} />
        <TweakToggle label="Color drift" value={tweaks.showDrift !== false} onChange={(v) => setTweak('showDrift', v)} />
      </TweakSection>
      <TweakSection title="Конверсія">
        <TweakToggle label="Sticky-бар" value={tweaks.showSticky} onChange={(v) => setTweak('showSticky', v)} />
      </TweakSection>
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
