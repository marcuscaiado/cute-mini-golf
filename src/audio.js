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

/** Ball bouncing off a wall — rubber thud */
export function sfxBounce() {
  playTone(220, 0.1, 'triangle', 0.1);
  playTone(110, 0.08, 'square', 0.04, 0.02);
  playNoise(0.06, 0.04);
}

/** Ball drops into hole — cute descending plop */
export function sfxHoleSink() {
  playTone(600, 0.12, 'sine', 0.12);
  playTone(400, 0.15, 'sine', 0.1, 0.08);
  playTone(250, 0.2, 'sine', 0.08, 0.16);
}

/** Victory fanfare — happy ascending melody */
export function sfxVictory() {
  const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    playTone(freq, 0.25, 'sine', 0.12, i * 0.15);
    playTone(freq * 0.5, 0.25, 'triangle', 0.06, i * 0.15); // Harmony
  });
  // Sparkle on top
  playTone(1568, 0.4, 'sine', 0.06, 0.6);
  playTone(2093, 0.5, 'sine', 0.04, 0.7);
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
