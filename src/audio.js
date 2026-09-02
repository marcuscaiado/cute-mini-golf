// =============================================
//  KAWAII AUDIO ENGINE
//  Zero-dependency procedural sound effects
//  using the Web Audio API
// =============================================

let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

// Ensure audio context is resumed on first user interaction
function unlockAudio() {
  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume();
}
document.addEventListener('mousedown', unlockAudio, { once: true });
document.addEventListener('touchstart', unlockAudio, { once: true });

// --- HELPER: Play a tone ---
function playTone(freq, duration, type = 'sine', volume = 0.15, delay = 0) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
  gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration);
}

// --- HELPER: Noise burst (for whoosh / impact) ---
function playNoise(duration, volume = 0.08, delay = 0) {
  const ctx = getCtx();
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize); // Fading noise
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

  // Bandpass filter for a softer sound
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2000;
  filter.Q.value = 0.5;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(ctx.currentTime + delay);
}

// =============================================
//  PUBLIC SFX FUNCTIONS
// =============================================

/** Club swing / hit — soft whoosh + impact pop */
export function sfxSwing(power = 0.5) {
  const vol = 0.05 + power * 0.12;
  // Whoosh
  playNoise(0.15, vol);
  // Impact pop
  playTone(300 + power * 200, 0.08, 'triangle', vol * 1.2, 0.02);
  playTone(150, 0.06, 'sine', vol * 0.6, 0.03);
}

/** Ball rolling on grass — subtle low rumble */
export function sfxRoll() {
  playNoise(0.3, 0.02);
  playTone(80, 0.3, 'sine', 0.02);
}

/** Ball bouncing off a wall — crisp ping-pong ball 'pock/ping' tap */
export function sfxBounce(intensity = 1.0) {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const vol = Math.min(0.3, 0.08 + intensity * 0.15);

  // 1. High resonant celluloid "ping" pop (fast exponential pitch drop)
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  const startFreq = 1250 + (Math.random() - 0.5) * 150;
  osc.frequency.setValueAtTime(startFreq, t);
  osc.frequency.exponentialRampToValueAtTime(startFreq * 0.4, t + 0.04);

  gain.gain.setValueAtTime(vol * 1.6, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.045);

  // 2. Hollow ping-pong shell body resonance (~540Hz down to ~300Hz)
  const bodyOsc = ctx.createOscillator();
  const bodyGain = ctx.createGain();
  bodyOsc.type = 'sine';
  bodyOsc.frequency.setValueAtTime(540, t);
  bodyOsc.frequency.exponentialRampToValueAtTime(300, t + 0.035);
  bodyGain.gain.setValueAtTime(vol * 0.9, t);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

  bodyOsc.connect(bodyGain);
  bodyGain.connect(ctx.destination);
  bodyOsc.start(t);
  bodyOsc.stop(t + 0.035);

  // 3. Crisp acoustic click/tap (filtered noise burst)
  playNoise(0.02, vol * 0.8);
}

// =============================================
//  QUAD-COLOR CONFETTI CANNON (Spectrum Engine)
// =============================================
const confettiParticles = [];
const QUAD_COLORS = ['#00f5ff', '#ff007f', '#ffd166', '#06d6a0', '#8ab4f8', '#f28b82', '#c084fc'];
let confettiCanvas = null;
let confettiCtx = null;

function initConfetti() {
  if (!confettiCanvas) {
    confettiCanvas = document.getElementById('confetti-canvas');
    if (confettiCanvas) {
      confettiCtx = confettiCanvas.getContext('2d');
      const resize = () => {
        confettiCanvas.width = window.innerWidth;
        confettiCanvas.height = window.innerHeight;
      };
      window.addEventListener('resize', resize);
      resize();

      const loop = () => {
        if (confettiCtx && confettiCanvas) {
          confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
          for (let i = confettiParticles.length - 1; i >= 0; i--) {
            const p = confettiParticles[i];
            p.x += p.speedX;
            p.y += p.speedY;
            p.speedY += p.gravity;
            p.opacity -= p.decay;
            p.rotation += p.rotSpeed;
            if (p.opacity <= 0) {
              confettiParticles.splice(i, 1);
              continue;
            }
            confettiCtx.save();
            confettiCtx.globalAlpha = Math.max(0, p.opacity);
            confettiCtx.translate(p.x, p.y);
            confettiCtx.rotate((p.rotation * Math.PI) / 180);
            confettiCtx.fillStyle = p.color;
            confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            confettiCtx.restore();
          }
        }
        requestAnimationFrame(loop);
      };
      loop();
    }
  }
}

export function explodeConfetti(x = window.innerWidth / 2, y = window.innerHeight * 0.45, count = 65) {
  initConfetti();
  for (let i = 0; i < count; i++) {
    confettiParticles.push({
      x, y,
      color: QUAD_COLORS[Math.floor(Math.random() * QUAD_COLORS.length)],
      size: Math.random() * 8 + 5,
      speedX: (Math.random() - 0.5) * 16,
      speedY: (Math.random() - 0.8) * 18,
      gravity: 0.45,
      opacity: 1,
      decay: Math.random() * 0.02 + 0.015,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10
    });
  }
}

/** Ball drops into hole — satisfying cup thunk + celestial dopamine chime + confetti */
export function sfxHoleSink() {
  const ctx = getCtx();
  const t = ctx.currentTime;

  // 1. Acoustic golf cup bottom "THUNK" (wood/plastic bottom tap + sub-bass body)
  const cupOsc = ctx.createOscillator();
  const cupGain = ctx.createGain();
  cupOsc.type = 'sine';
  cupOsc.frequency.setValueAtTime(140, t);
  cupOsc.frequency.exponentialRampToValueAtTime(38, t + 0.12);
  cupGain.gain.setValueAtTime(0.35, t);
  cupGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  cupOsc.connect(cupGain);
  cupGain.connect(ctx.destination);
  cupOsc.start(t);
  cupOsc.stop(t + 0.13);

  // Filtered click tap
  playNoise(0.03, 0.15);

  // 2. Pure Celestial Dopamine Ascension Arpeggio (C5, E5, G5, C6, E6)
  const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t + 0.06 + idx * 0.05);

    gain.gain.setValueAtTime(0, t + 0.06 + idx * 0.05);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.06 + idx * 0.05 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06 + idx * 0.05 + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t + 0.06 + idx * 0.05);
    osc.stop(t + 0.06 + idx * 0.05 + 0.5);
  });

  // Confetti explosion
  explodeConfetti(window.innerWidth / 2, window.innerHeight * 0.4, 65);
}

/** Victory fanfare — happy royal dopamine fanfare */
export function sfxVictory() {
  const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
  notes.forEach((freq, i) => {
    playTone(freq, 0.35, 'triangle', 0.16, i * 0.08);
    playTone(freq * 0.5, 0.35, 'sine', 0.1, i * 0.08);
  });
  playTone(2093, 0.6, 'sine', 0.06, 0.5);
}

/** UI click sound — light tap */
export function sfxClick() {
  playTone(800, 0.05, 'sine', 0.08);
  playTone(1200, 0.03, 'sine', 0.05, 0.02);
}

/** Character select — cute boing */
export function sfxSelect() {
  playTone(400, 0.1, 'sine', 0.1);
  playTone(600, 0.1, 'sine', 0.1, 0.08);
  playTone(800, 0.15, 'sine', 0.08, 0.16);
}

/** Speed booster pad / conveyor belt whoosh */
export function sfxBoost() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(320, t);
  osc.frequency.exponentialRampToValueAtTime(1400, t + 0.22);

  // Bandpass filter to make it smooth and energetic
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(900, t);
  filter.frequency.exponentialRampToValueAtTime(2400, t + 0.22);
  filter.Q.value = 3.0;

  gain.gain.setValueAtTime(0.18, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.25);

  playNoise(0.2, 0.06);
}

/** Spike trap impact — ceramic/glass ball break crack + low pop */
export function sfxBallBreak() {
  const ctx = getCtx();
  const t = ctx.currentTime;

  // Sharp snap/crack
  playNoise(0.15, 0.22);

  // Metallic dissonance shatter
  [920, 1340, 1850, 420].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = i % 2 === 0 ? 'triangle' : 'square';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.3, t + 0.12);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.14);
  });
}

/** 3D Loop-de-loop swirling acoustic chute whoosh */
export function sfxLoop() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  playNoise(0.4, 0.12);

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, t);
  osc.frequency.linearRampToValueAtTime(880, t + 0.2);
  osc.frequency.linearRampToValueAtTime(350, t + 0.4);

  gain.gain.setValueAtTime(0.14, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.42);
}

/** Ball respawn sparkle chime */
export function sfxRespawn() {
  playTone(523, 0.08, 'sine', 0.1, 0.0);
  playTone(784, 0.1, 'sine', 0.1, 0.06);
  playTone(1046, 0.15, 'sine', 0.12, 0.12);
}

