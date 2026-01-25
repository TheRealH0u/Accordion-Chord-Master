const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const activeOscillators = {};

const notes = {
  C: 130.81,
  Cis: 138.59,
  D: 146.83,
  Dis: 155.56,
  E: 164.81,
  F: 174.61,
  Fis: 185.0,
  G: 196.0,
  Gis: 207.65,
  A: 220.0,
  Ais: 233.08,
  B: 233.08,
  H: 246.94,
  Des: 138.59,
  As: 207.65,
  Es: 155.56,
  Ges: 92.5,
  Am: 110.0,
  Dm: 146.83,
  Em: 164.81,
  Hm: 123.47,
  "F#m": 185.0,
  "C#m": 138.59,
  "G#m": 207.65,
  "D#m": 155.56,
  Fm: 174.61,
  Bbm: 116.54,
  Gm: 98.0,
  Ebm: 77.78,
};

// Nastavitve za "lep" zvok
const ATTACK_TIME = 0.1; // Sekunde do polne glasnosti
const RELEASE_TIME = 0.3; // Sekunde, da zvok izzveni
const MAX_GAIN = 0.12; // Maksimalna glasnost

function startChord(name, type, kb) {
  if (activeOscillators[kb]) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  let rootName = name.replace("m", "").replace("#", "is");
  if (name.includes("#")) {
    const map = { "F#m": "Fis", "C#m": "Cis", "G#m": "Gis", "D#m": "Dis" };
    rootName = map[name] || rootName;
  }

  let baseFreq = notes[rootName] || notes[name];
  if (!baseFreq) return;

  const isHigh = document.getElementById("oct-" + kb).checked;
  const rootFreq = isHigh ? baseFreq * 2 : baseFreq;
  const waveType = document.getElementById("waveType").value;
  const intervals = type === "major" ? [1, 1.25, 1.5, 2] : [1, 1.2, 1.5, 2];
  const nodes = [];

  intervals.forEach((interval) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = waveType;
    osc.frequency.setValueAtTime(rootFreq * interval, audioCtx.currentTime);

    // Začetek na 0 (prepreči BUM)
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    // Attack faza: postopno povečanje glasnosti
    gain.gain.linearRampToValueAtTime(
      MAX_GAIN,
      audioCtx.currentTime + ATTACK_TIME,
    );

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    nodes.push({ osc, gain });
  });

  activeOscillators[kb] = nodes;
  document.getElementById("key-" + kb).classList.add("active");
}

function stopChord(kb) {
  if (activeOscillators[kb]) {
    const now = audioCtx.currentTime;
    activeOscillators[kb].forEach((node) => {
      // Prepreči takojšnjo prekinitev
      node.gain.gain.cancelScheduledValues(now);
      // Release faza: zvok lepo izzveni do ničle
      node.gain.gain.setValueAtTime(node.gain.gain.value, now);
      node.gain.gain.exponentialRampToValueAtTime(0.0001, now + RELEASE_TIME);

      // Ugasni oscilator šele, ko se Release konča
      setTimeout(
        () => {
          node.osc.stop();
          node.osc.disconnect();
          node.gain.disconnect();
        },
        RELEASE_TIME * 1000 + 50,
      );
    });
    delete activeOscillators[kb];
    document.getElementById("key-" + kb).classList.remove("active");
  }
}

// Ostali listenerji ostanejo isti...
const pressedKeys = new Set();
window.addEventListener("keydown", (e) => {
  if (!document.getElementById("kbToggle").checked) return;
  const key = e.key.toLowerCase();
  if (pressedKeys.has(key)) return;
  const btn = document.getElementById("key-" + key);
  if (btn) {
    pressedKeys.add(key);
    btn.onmousedown();
  }
});

window.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  pressedKeys.delete(key);
  stopChord(key);
});
