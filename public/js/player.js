const el = (id) => document.getElementById(id);

(function mountSky() {
  const sky = el('sky');
  const tpl = el('sleigh-tpl');
  if (!sky || !tpl) return;
  for (const name of ['f1', 'f2', 'f3 reverse']) {
    const flyer = document.createElement('div');
    flyer.className = `flyer ${name}`;
    flyer.appendChild(tpl.content.cloneNode(true));
    sky.appendChild(flyer);
  }
})();

let spinning = false;
let revealed = false;
let lastSig = '';

let token = '';
let data = null;

const statusLabels = { setup: 'Dar neprasidėjo', live: 'Vyksta!', ended: 'Baigta' };

const clamp = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeIn = (t) => t * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/* ---------------- Scene ---------------- */

function setPaperName(name) {
  const text = el('paper-name');
  const str = String(name ?? '').trim();
  text.textContent = str;
  text.removeAttribute('textLength');
  text.removeAttribute('lengthAdjust');
  let size = 27;
  if (str.length > 8) size = 24;
  if (str.length > 11) size = 21;
  if (str.length > 14) size = 18;
  if (str.length > 18) size = 16;
  text.setAttribute('font-size', String(size));
  if (str.length * size * 0.62 > 138) {
    text.setAttribute('textLength', '138');
    text.setAttribute('lengthAdjust', 'spacingAndGlyphs');
  }
}

function setArm(angle) {
  el('arm').setAttribute('transform', `rotate(${angle.toFixed(2)})`);
}

function setPaper(offset, scale, angle) {
  el('paper').setAttribute(
    'transform',
    `translate(0,${offset.toFixed(2)}) scale(${scale.toFixed(3)}) rotate(${angle.toFixed(2)})`
  );
}

function setBag(angle) {
  el('bag').setAttribute('transform', `rotate(${angle.toFixed(2)} 344 390)`);
}

function setWaving(on) {
  el('santa-scene').classList.toggle('is-idle', on);
}

function poseIdle(wave = true) {
  setArm(-16);
  setPaper(195, 0.52, 0);
  setBag(0);
  el('sparkles').style.opacity = '0';
  setWaving(wave);
}

function poseReveal() {
  setArm(-44);
  setPaper(8, 1, 0);
  setBag(0);
  el('sparkles').style.opacity = '0.9';
  setWaving(false);
}

function playDraw(name) {
  return new Promise((resolve) => {
    setPaperName(name);
    poseIdle(false);

    const start = performance.now();
    const DIP = 520;
    const SHAKE = 700;
    const LIFT = 1000;
    const SETTLE = 500;
    const PAUSE = 300;
    const t1 = DIP;
    const t2 = t1 + SHAKE;
    const t3 = t2 + LIFT;
    const t4 = t3 + SETTLE;
    const total = t4 + PAUSE;
    const sparkles = el('sparkles');

    function frame(now) {
      const t = now - start;

      let arm;
      if (t < t1) arm = lerp(-16, 27, easeIn(clamp(t / t1)));
      else if (t < t2) arm = 27 + Math.sin((t - t1) / 60) * 4;
      else if (t < t3) arm = lerp(27, -44, easeOut(clamp((t - t2) / LIFT)));
      else arm = -44;
      setArm(arm);

      let bag = 0;
      if (t >= t1 - 100 && t < t2 + 200) {
        const fade = t < t2 ? 1 : 1 - (t - t2) / 200;
        bag = Math.sin((t - t1) / 55) * 3.2 * fade;
      }
      setBag(bag);

      let off = 195;
      let scale = 0.52;
      const rot = 0;
      if (t >= t2 && t < t3) {
        const k = easeOut(clamp((t - t2) / LIFT));
        off = lerp(195, 8, k);
        scale = lerp(0.52, 1, k);
      } else if (t >= t3) {
        const k = clamp((t - t3) / SETTLE);
        off = 8 - Math.sin(k * Math.PI) * 6;
        scale = 1 + Math.sin(k * Math.PI) * 0.03;
      }
      setPaper(off, scale, rot);

      let op = 0;
      if (t >= t1 && t < t3) op = Math.min(1, (t - t1) / 250);
      else if (t >= t3) op = Math.max(0, 1 - (t - t3) / (SETTLE + PAUSE));
      sparkles.style.opacity = String(op);

      if (t < total) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

/* ---------------- Rendering ---------------- */

function render() {
  if (!data) return;
  document.title = `${data.eventTitle || 'Slaptasis Kalėdų senelis'} – tavo kvietimas`;
  el('event-title').textContent = data.eventTitle || 'Slaptasis Kalėdų senelis';
  el('greeting').textContent = `Labas, ${data.name}!`;

  const pill = el('status-pill');
  pill.className = `pill ${data.status}`;
  pill.hidden = false;
  el('status-text').textContent = statusLabels[data.status] || data.status;

  const stage = el('draw-stage');
  const spinButton = el('spin');
  const waiting = el('waiting');

  if (data.spun && data.target) {
    el('subtitle').textContent = 'Jau ištraukei savo žmogų! Nė žodžio nė vienam!';
    setPaperName(data.target);
    stage.hidden = false;
    poseReveal();
    spinButton.hidden = true;
    waiting.hidden = true;
    revealed = true;
    return;
  }
  revealed = false;

  if (data.status === 'setup') {
    el('subtitle').textContent = 'Jau beveik beveik!';
    el('waiting-text').textContent = 'Organizatorius dar nepradėjo žaidimo. Puslapis atsinaujins pats – kol kas gali ramiai gurkšnoti kakavą.';
    waiting.hidden = false;
    stage.hidden = true;
    spinButton.hidden = true;
    return;
  }

  if (data.status === 'ended') {
    el('subtitle').textContent = 'Slaptasis Kalėdų senelis jau išėjo miego.';
    el('waiting-text').textContent = 'Renginys uždarytas, tad maišas daugiau neatsidarys.';
    waiting.hidden = false;
    stage.hidden = true;
    spinButton.hidden = true;
    return;
  }

  el('subtitle').textContent = 'Paspausk mygtuką – Kalėdų senelis ištrauks tau vardą iš maišo!';
  waiting.hidden = true;
  stage.hidden = false;
  poseIdle();
  spinButton.hidden = false;
  spinButton.disabled = false;
}

/* ---------------- Actions ---------------- */

el('spin').addEventListener('click', spin);

async function spin() {
  if (spinning || !data || data.status !== 'live' || data.spun) return;
  spinning = true;
  const button = el('spin');
  const originalLabel = button.innerHTML;
  button.disabled = true;
  button.textContent = 'Senelis ieško...';

  try {
    const res = await fetch(`/api/player/${token}/spin`, { method: 'POST' });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Vardo ištraukti nepavyko.');

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPaperName(result.target);
      poseReveal();
    } else {
      await playDraw(result.target);
    }

    burstConfetti();
    data.spun = true;
    data.target = result.target;
    revealed = true;
    button.hidden = true;
    el('subtitle').textContent = 'Jau ištraukei savo žmogų! Nė žodžio nė vienam!';
  } catch (err) {
    showError(err.message);
    button.innerHTML = originalLabel;
    button.disabled = false;
    poseIdle();
  } finally {
    spinning = false;
  }
}

function burstConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#e7c884', '#d61f3c', '#1c8a5a', '#f6e3b0', '#ffffff'];
  const layer = document.createElement('div');
  layer.className = 'confetti';
  for (let i = 0; i < 70; i++) {
    const piece = document.createElement('i');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.width = `${6 + Math.random() * 6}px`;
    piece.style.height = `${10 + Math.random() * 8}px`;
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    piece.style.animationDelay = `${Math.random() * 0.5}s`;
    piece.style.animationDuration = `${2.2 + Math.random() * 1.8}s`;
    layer.appendChild(piece);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 4600);
}

function showError(message) {
  const box = el('error');
  box.textContent = message;
  box.hidden = !message;
}

function signature(d) {
  return `${d.status}|${d.spun}|${d.target}`;
}

/* ---------------- Boot ---------------- */

(async function init() {
  const parts = location.pathname.split('/').filter(Boolean);
  token = (parts[1] || '').toLowerCase();
  try {
    if (!token) throw new Error('Šiai kvietimo nuorodai trūksta kodo.');
    const res = await fetch(`/api/player/${encodeURIComponent(token)}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Ši kvietimo nuoroda negalioja.');
    }
    data = await res.json();
    el('loading').hidden = true;
    el('app').hidden = false;
    lastSig = signature(data);
    render();

    setInterval(async () => {
      if (spinning || revealed) return;
      try {
        const res = await fetch(`/api/player/${encodeURIComponent(token)}`);
        if (!res.ok) return;
        const next = await res.json();
        if (signature(next) !== lastSig) {
          data = next;
          render();
        }
      } catch {
        // ignore background poll errors
      }
    }, 4000);
  } catch (err) {
    el('loading').hidden = true;
    showError(err.message);
  }
})();
