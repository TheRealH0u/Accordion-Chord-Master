const activeSamplers = {};
const pressedKeys = new Set();

const noteToMidi = {
    'C': 48, 'Cis': 49, 'D': 50, 'Dis': 51, 'E': 52, 'F': 53,
    'Fis': 54, 'G': 55, 'Gis': 56, 'A': 57, 'Ais': 58, 'B': 58,
    'H': 59, 'Des': 49, 'As': 56, 'Es': 51, 'Ges': 42,
    'Am': 45, 'Dm': 50, 'Em': 52, 'Hm': 47, 'F#m': 54, 'C#m': 49,
    'G#m': 56, 'D#m': 51, 'Fm': 53, 'Bbm': 46, 'Gm': 43, 'Ebm': 39
};

const sampler = new Tone.Sampler({
    urls: {
        21: "1.mp3",
        32: "12.mp3",
        44: "24.mp3",
        60: "40.mp3",
        72: "52.mp3",
        84: "64.mp3",
        108: "88.mp3"
    },
    baseUrl: "/static/samples/",
    onload: () => {
        sampler.members.forEach(source => {
            source.loop = true;
        });
    }
}).toDestination();

async function startChord(name, type, kb) {
    if (activeSamplers[kb]) return;
    await Tone.start();

    let rootName = name.replace('m', '').replace('#', 'is');
    if (name.includes('#')) {
        const map = { 'F#m': 'Fis', 'C#m': 'Cis', 'G#m': 'Gis', 'D#m': 'Dis' };
        rootName = map[name] || rootName;
    }

    let midiBase = noteToMidi[rootName] || noteToMidi[name];
    if (!midiBase) return;

    const isHigh = document.getElementById('oct-' + kb).checked;
    const rootMidi = isHigh ? midiBase + 12 : midiBase;
    const intervals = type === 'major' ? [0, 4, 7, 12] : [0, 3, 7, 12];
    const midiNotes = intervals.map(interval => Tone.Frequency(rootMidi + interval, "midi").toNote());

    sampler.triggerAttack(midiNotes);
    activeSamplers[kb] = midiNotes;
    document.getElementById('key-' + kb).classList.add('active');
}

function stopChord(kb) {
    if (activeSamplers[kb]) {
        sampler.triggerRelease(activeSamplers[kb]);
        delete activeSamplers[kb];
        document.getElementById('key-' + kb).classList.remove('active');
    }
}

window.addEventListener('keydown', (e) => {
    if (!document.getElementById('kbToggle').checked) return;
    const key = e.key.toLowerCase();
    if (pressedKeys.has(key)) return;
    const btn = document.getElementById('key-' + key);
    if (btn) {
        pressedKeys.add(key);
        btn.onmousedown();
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    pressedKeys.delete(key);
    stopChord(key);
});