/**
 * Zero-asset procedural Web Audio synthesizer.
 * Lazy-initialized strictly on user interaction to comply with browser autoplay policies.
 */
export function createAudioEngine() {
  let ctx = null;
  let muted = false;

  function ensureContext() {
    if (muted) return null;
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  /**
   * Warm Genshin-inspired pentatonic chime chord + gentle filtered wind swell.
   */
  function playPortalOpen() {
    const audio = ensureContext();
    if (!audio) return;

    const now = audio.currentTime;
    const notes = [261.63, 392.0, 523.25, 587.33, 659.25, 880.0]; // C4 G4 C5 D5 E5 A5

    notes.forEach((freq, idx) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.085);

      const t0 = now + idx * 0.085;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.045 / (1 + idx * 0.12), t0 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4);

      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(t0);
      osc.stop(t0 + 2.5);
    });

    // Soft filtered air swell during portal fly-through
    const bufferSize = Math.floor(audio.sampleRate * 2.2);
    const noiseBuffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.04 * white) / 1.04;
      lastOut = data[i];
      data[i] *= 2.2;
    }

    const noise = audio.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(320, now + 0.3);
    filter.frequency.exponentialRampToValueAtTime(920, now + 1.4);
    filter.frequency.exponentialRampToValueAtTime(280, now + 2.3);
    filter.Q.value = 1.4;

    const noiseGain = audio.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now + 0.2);
    noiseGain.gain.linearRampToValueAtTime(0.05, now + 1.0);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.35);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(audio.destination);
    noise.start(now + 0.2);
    noise.stop(now + 2.4);
  }

  function playLandmarkSelect() {
    const audio = ensureContext();
    if (!audio) return;

    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(783.99, now); // G5
    osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.14); // C6

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  function setMuted(next) {
    muted = Boolean(next);
    return muted;
  }

  function isMuted() {
    return muted;
  }

  return {
    playPortalOpen,
    playLandmarkSelect,
    setMuted,
    isMuted,
  };
}
