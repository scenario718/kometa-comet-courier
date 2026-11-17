// audio.js — tiny WebAudio-synthesized sound effects. No audio files: every
// sound is an oscillator or noise burst shaped by a gain envelope, so the game
// stays fully offline and asset-free. The context wakes on the first user
// gesture (unlock), as browsers require.

export function createAudio() {
  let context = null;
  let muted = false;

  function unlock() {
    if (!context) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (AudioCtor) context = new AudioCtor();
    }
    if (context && context.state === 'suspended') context.resume();
  }

  function tone({ freq, end = null, type = 'sine', at = 0, dur = 0.18, vol = 0.16 }) {
    if (!context || muted) return;
    const start = context.currentTime + at;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (end) osc.frequency.exponentialRampToValueAtTime(end, start + dur);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(vol, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(context.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  function noiseBurst({ at = 0, dur = 0.25, vol = 0.2 }) {
    if (!context || muted) return;
    const start = context.currentTime + at;
    const length = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start(start);
  }

  const sounds = {
    launch() { tone({ freq: 300, end: 880, type: 'triangle', dur: 0.22, vol: 0.14 }); },
    graze() { tone({ freq: 1240, end: 1560, type: 'sine', dur: 0.12, vol: 0.1 }); },
    delivered() {
      tone({ freq: 660, type: 'sine', dur: 0.14, vol: 0.14 });
      tone({ freq: 880, type: 'sine', at: 0.09, dur: 0.16, vol: 0.14 });
      tone({ freq: 1320, type: 'sine', at: 0.18, dur: 0.24, vol: 0.12 });
    },
    crash() { noiseBurst({ dur: 0.3, vol: 0.22 }); tone({ freq: 160, end: 50, type: 'square', dur: 0.3, vol: 0.1 }); },
    lost() { tone({ freq: 520, end: 90, type: 'sawtooth', dur: 0.5, vol: 0.07 }); },
    'level-clear'() {
      [523, 659, 784, 1046].forEach((freq, i) => tone({ freq, type: 'triangle', at: i * 0.09, dur: 0.2, vol: 0.13 }));
    },
    'game-over'() {
      [392, 330, 262, 196].forEach((freq, i) => tone({ freq, type: 'triangle', at: i * 0.13, dur: 0.24, vol: 0.12 }));
    },
    start() { tone({ freq: 440, end: 660, type: 'triangle', dur: 0.12, vol: 0.1 }); },
  };

  return {
    unlock,
    play(name) {
      if (sounds[name]) sounds[name]();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
