// Synthesized WebAudio sound only: no audio files, no network. Engine hum follows
// the car's speed, a two-tone siren wails while the police chase, and short blips
// cover shots, punches, pickups, mission success and failure, over a simple bass loop.
export function createAudio() {
  let ctx = null, master = null, engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null;
  let musicTimer = null, muted = false, musicStep = 0, started = false;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      ctx = new AudioContext();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engineOsc.connect(engineGain); engineGain.connect(master); engineOsc.start();
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sine'; sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
      started = true;
      startMusic();
      return true;
    } catch { return false; }
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type || 'square'; osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain); gain.connect(master); osc.start(t); osc.stop(t + dur + 0.02);
  }
  function noise(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    const t = ctx.currentTime, len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buffer;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = filterFreq || 1200;
    const gain = ctx.createGain(); gain.gain.value = vol || 0.3;
    src.connect(filter); filter.connect(gain); gain.connect(master); src.start(t);
  }
  const BASS = [55, 0, 65.41, 0, 49, 0, 58.27, 0, 55, 0, 65.41, 0, 73.42, 65.41, 58.27, 49];
  function startMusic() {
    if (musicTimer || !ctx) return;
    musicTimer = window.setInterval(() => {
      if (muted || !ctx) return;
      const freq = BASS[musicStep % BASS.length]; musicStep += 1;
      if (freq) tone(freq, 0.28, 'triangle', 0.12);
      if (musicStep % 4 === 1) tone(220 + (musicStep % 3) * 55, 0.12, 'sine', 0.05);
    }, 240);
  }
  return {
    ensure, isStarted() { return started; },
    setMuted(value) { muted = value; if (master) master.gain.value = value ? 0 : 0.5; },
    isMuted() { return muted; },
    setEngine(speedRatio, inCar) {
      if (!ctx) return;
      engineGain.gain.value = inCar ? 0.05 + speedRatio * 0.07 : 0;
      engineOsc.frequency.value = 50 + speedRatio * 130;
    },
    setSiren(on, time) {
      if (!ctx) return;
      sirenGain.gain.value = on ? 0.045 : 0;
      if (on) sirenOsc.frequency.value = 650 + Math.sin(time * 6) * 220;
    },
    shot() { noise(0.12, 0.35, 2600); tone(180, 0.08, 'square', 0.15, 60); },
    punch() { noise(0.08, 0.25, 700); },
    pickup() { tone(660, 0.1, 'sine', 0.2); window.setTimeout(() => tone(990, 0.14, 'sine', 0.2), 90); },
    cash() { tone(880, 0.1, 'sine', 0.18); window.setTimeout(() => tone(1174, 0.16, 'sine', 0.18), 90); },
    missionComplete() { [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => tone(f, 0.22, 'triangle', 0.22), i * 120)); },
    missionFailed() { [392, 330, 262].forEach((f, i) => window.setTimeout(() => tone(f, 0.25, 'sawtooth', 0.14), i * 140)); },
    sirenBlip() { tone(880, 0.12, 'sine', 0.15, 660); },
    busted() { tone(220, 0.5, 'sawtooth', 0.2, 110); },
  };
}
