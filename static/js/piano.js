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
    polyphony: 64,
    onload: () => {
        sampler.members.forEach(source => {
            source.loop = true;
        });
    }
}).toDestination();

async function startChord(name, type, kb) {
    if (activeSamplers[kb] || !sampler.loaded) return; 

    activeSamplers[kb] = "loading"; 

    await Tone.start();

    let rootName = name.replace('m', ''); 
    const translationMap = {
        'F#': 'Fis', 'C#': 'Cis', 'G#': 'Gis', 'D#': 'Dis', 'A#': 'Ais',
        'F#m': 'Fis', 'C#m': 'Cis', 'G#m': 'Gis', 'D#m': 'Dis', 'A#m': 'Ais'
    };
    
    let lookupKey = translationMap[name] || rootName;
    let midiBase = noteToMidi[lookupKey];

    if (!midiBase) {
        delete activeSamplers[kb];
        return;
    }

    const octElem = document.getElementById('oct-' + kb);
    const isHigh = octElem ? octElem.checked : false;
    const rootMidi = isHigh ? midiBase + 12 : midiBase;
    
    const intervals = type === 'major' ? [0, 4, 7, 12] : [0, 3, 7, 12];
    
    const midiNotes = intervals.map(interval => 
        Tone.Frequency(rootMidi + interval, "midi").toNote()
    );

    midiNotes.forEach((note, index) => {
        sampler.triggerAttack(note, Tone.now() + (index * 0.001));
    });

    activeSamplers[kb] = midiNotes; 
    
    const keyElem = document.getElementById('key-' + kb);
    if (keyElem) keyElem.classList.add('active');
}

function stopChord(kb) {
    const notes = activeSamplers[kb];
    if (notes && notes !== "loading") {
        sampler.triggerRelease(notes);
        delete activeSamplers[kb];
        
        const keyElem = document.getElementById('key-' + kb);
        if (keyElem) keyElem.classList.remove('active');
    } else if (notes === "loading") {
        setTimeout(() => stopChord(kb), 50);
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