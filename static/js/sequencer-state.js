(function (root, factory) {
    if (typeof module === "object" && module.exports) {
        module.exports = factory();
    } else {
        root.SequenceModel = factory();
    }
}(typeof self !== "undefined" ? self : this, function () {
    "use strict";

    const KEY_LAYOUT = ["q", "w", "e", "r", "t", "z", "a", "s", "d", "f", "g", "h", "y", "x", "c", "v", "b", "n"];
    const TUNINGS = ["Gis-Cis-Fis", "A-D-G", "B-Es-As", "H-E-A", "C-F-B", "Cis-Fis-H", "D-G-C"];
    const RELATIONS = {
        C: ["G", "F"], F: ["C", "B"], B: ["F", "Es"], Es: ["B", "As"],
        As: ["Es", "Des"], Des: ["As", "Ges"], G: ["D", "C"], D: ["A", "G"],
        A: ["E", "D"], E: ["H", "A"], H: ["Fis", "E"], Fis: ["Cis", "H"],
        Cis: ["Gis", "Fis"], Gis: ["Dis", "Cis"], Dis: ["Ais", "Gis"], Ais: ["F", "Dis"]
    };
    const MINORS = {
        C: "Am", G: "Em", D: "Hm", A: "F#m", E: "C#m", H: "G#m",
        Fis: "D#m", Cis: "A#m", Gis: "Fm", Dis: "Bm", As: "Fm",
        Es: "Cm", B: "Gm", F: "Dm", Des: "Bm", Ges: "Ebm", Ais: "Gm"
    };

    function stepsFor(timeSignature) {
        return timeSignature === "3/4" ? 12 : 16;
    }

    function createState(options) {
        const settings = options || {};
        const timeSignature = settings.timeSignature === "3/4" ? "3/4" : "4/4";
        const count = stepsFor(timeSignature);
        const bars = Number.isInteger(settings.bars) ? Math.min(64, Math.max(1, settings.bars)) : 4;
        return {
            version: 2,
            tuning: TUNINGS.includes(settings.tuning) ? settings.tuning : "C-F-B",
            timeSignature: timeSignature,
            bars: bars,
            bpm: clampBpm(settings.bpm),
            stepCount: count * bars,
            notes: []
        };
    }

    function clampBars(value) {
        const bars = Number(value);
        return Number.isFinite(bars) ? Math.min(64, Math.max(1, Math.round(bars))) : 4;
    }

    function normalizeNotes(notes, stepCount) {
        if (!Array.isArray(notes)) return [];
        return notes
            .filter((note) => note && KEY_LAYOUT.includes(note.key) && Number.isInteger(note.start) && Number.isInteger(note.length))
            .map((note) => {
                const start = Math.max(0, Math.min(stepCount - 1, note.start));
                const maxLength = Math.max(1, stepCount - start);
                return { key: note.key, start: start, length: Math.max(1, Math.min(maxLength, note.length)) };
            })
            .sort((a, b) => a.start - b.start);
    }

    function findNoteAt(state, index) {
        if (!Number.isInteger(index) || index < 0 || index >= state.stepCount) return null;
        for (let i = 0; i < state.notes.length; i += 1) {
            const note = state.notes[i];
            const end = note.start + note.length - 1;
            if (index >= note.start && index <= end) return note;
        }
        return null;
    }

    function clampBpm(value) {
        const bpm = Number(value);
        return Number.isFinite(bpm) ? Math.min(300, Math.max(30, Math.round(bpm))) : 120;
    }

    function setTimeSignature(state, timeSignature) {
        const next = timeSignature === "3/4" ? "3/4" : "4/4";
        const stepCount = stepsFor(next) * (state.bars || 4);
        const notes = normalizeNotes(state.notes, stepCount)
            .filter((note) => note.start < stepCount)
            .map((note) => ({ ...note, length: Math.min(note.length, stepCount - note.start) }));
        return { ...state, timeSignature: next, stepCount, notes };
    }

    function setBars(state, barsValue) {
        const bars = clampBars(barsValue);
        const stepCount = stepsFor(state.timeSignature) * bars;
        const notes = normalizeNotes(state.notes, stepCount)
            .filter((note) => note.start < stepCount)
            .map((note) => ({ ...note, length: Math.min(note.length, stepCount - note.start) }));
        return { ...state, bars, stepCount, notes };
    }

    function setStep(state, index, key, length) {
        if (!Number.isInteger(index) || index < 0 || index >= state.stepCount) {
            throw new RangeError("Step index is out of range");
        }
        if (key !== null && !KEY_LAYOUT.includes(key)) {
            throw new TypeError("Unknown accordion key");
        }
        const active = findNoteAt(state, index);
        const start = active ? active.start : index;
        const defaultLength = active ? active.length : 1;
        const nextLength = Number.isInteger(length) ? length : defaultLength;
        if (key === null) {
            return { ...state, notes: state.notes.filter((note) => note.start !== start) };
        }

        const maxLength = maxLengthAtStart(state, start);
        const safeLength = Math.max(1, Math.min(maxLength, nextLength));
        const notes = state.notes
            .filter((note) => note.start !== start)
            .concat({ key, start: start, length: safeLength })
            .sort((a, b) => a.start - b.start);
        return { ...state, notes };
    }

    function maxLengthAtStart(state, start) {
        let maxEnd = state.stepCount;
        const next = state.notes
            .filter((note) => note.start > start)
            .sort((a, b) => a.start - b.start)[0];
        if (next) maxEnd = next.start;
        return Math.max(1, maxEnd - start);
    }

    function setNoteLength(state, start, length) {
        if (!Number.isInteger(start) || !Number.isInteger(length)) {
            throw new TypeError("Start and length must be integers");
        }
        const note = state.notes.find((item) => item.start === start);
        if (!note) return state;
        const maxLength = maxLengthAtStart(state, start);
        const safeLength = Math.max(1, Math.min(maxLength, length));
        const notes = state.notes
            .filter((item) => item.start !== start)
            .concat({ key: note.key, start: start, length: safeLength })
            .sort((a, b) => a.start - b.start);
        return { ...state, notes };
    }

    function moveNote(state, fromStart, toStart) {
        if (!Number.isInteger(fromStart) || !Number.isInteger(toStart)) {
            throw new TypeError("Start values must be integers");
        }
        const note = state.notes.find((item) => item.start === fromStart);
        if (!note) return state;

        const others = state.notes.filter((item) => item.start !== fromStart);
        const leftNeighbor = others
            .filter((item) => item.start + item.length <= fromStart)
            .sort((a, b) => (b.start + b.length) - (a.start + a.length))[0];
        const rightNeighbor = others
            .filter((item) => item.start >= fromStart + note.length)
            .sort((a, b) => a.start - b.start)[0];

        const minStart = leftNeighbor ? leftNeighbor.start + leftNeighbor.length : 0;
        const maxStartByLength = state.stepCount - note.length;
        const maxStart = rightNeighbor ? Math.min(maxStartByLength, rightNeighbor.start - note.length) : maxStartByLength;
        const safeStart = Math.max(minStart, Math.min(maxStart, toStart));

        const notes = others
            .concat({ key: note.key, start: safeStart, length: note.length })
            .sort((a, b) => a.start - b.start);
        return { ...state, notes };
    }

    function tuningRows(tuning) {
        const roots = tuning.split("-");
        return roots.map((root) => {
            const relation = RELATIONS[root] || ["?", "?"];
            return [root, relation[0], relation[1],
                MINORS[root] || "?", MINORS[relation[0]] || "?", MINORS[relation[1]] || "?"];
        });
    }

    function resolveKey(tuning, key) {
        const index = KEY_LAYOUT.indexOf(key);
        if (index < 0) return null;
        const row = Math.floor(index / 6);
        const chord = index % 6;
        const values = tuningRows(tuning)[row] || [];
        return { key, name: values[chord] || "?", type: chord < 3 ? "major" : "minor" };
    }

    function serialize(state) {
        return JSON.stringify(state, null, 2);
    }

    function validate(input) {
        if (!input || (input.version !== 1 && input.version !== 2) || !TUNINGS.includes(input.tuning)) {
            throw new Error("Neveljavna ACM datoteka: manjkajoča ali neveljavna verzija oziroma uglasitev.");
        }
        if (input.timeSignature !== "3/4" && input.timeSignature !== "4/4") {
            throw new Error("Neveljaven takt.");
        }
        if (!Number.isInteger(input.bpm) || input.bpm < 30 || input.bpm > 300) {
            throw new Error("BPM mora biti celo število med 30 in 300.");
        }
        if (input.version === 1) {
            if (!Array.isArray(input.steps) || input.steps.length !== stepsFor(input.timeSignature)) {
                throw new Error("Neveljavno število korakov.");
            }
            input.steps.forEach((key) => {
                if (key !== null && !KEY_LAYOUT.includes(key)) throw new Error("Datoteka vsebuje neveljavno tipko.");
            });
            return true;
        }
        if (!Number.isInteger(input.bars) || input.bars < 1 || input.bars > 64) {
            throw new Error("Število taktov mora biti med 1 in 64.");
        }
        const stepCount = stepsFor(input.timeSignature) * input.bars;
        if (!Number.isInteger(input.stepCount) || input.stepCount !== stepCount) {
            throw new Error("Neveljavno število korakov.");
        }
        if (!Array.isArray(input.notes)) {
            throw new Error("Manjkajo note.");
        }
        input.notes.forEach((note) => {
            if (!note || !KEY_LAYOUT.includes(note.key)) throw new Error("Datoteka vsebuje neveljavno tipko.");
            if (!Number.isInteger(note.start) || note.start < 0 || note.start >= stepCount) throw new Error("Neveljaven začetek note.");
            if (!Number.isInteger(note.length) || note.length < 1) throw new Error("Neveljavna dolžina note.");
            if (note.start + note.length - 1 >= stepCount) throw new Error("Nota presega dolžino sekvence.");
        });
        return true;
    }

    function deserialize(text) {
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (error) {
            throw new Error("ACM datoteka ni veljaven JSON.");
        }
        validate(parsed);
        if (parsed.version === 1) {
            const legacy = createState({ tuning: parsed.tuning, timeSignature: parsed.timeSignature, bpm: parsed.bpm, bars: 4 });
            const notes = [];
            parsed.steps.forEach((key, index) => {
                if (key !== null) notes.push({ key: key, start: index, length: 1 });
            });
            return { ...legacy, notes };
        }
        return {
            version: 2,
            tuning: parsed.tuning,
            timeSignature: parsed.timeSignature,
            bars: parsed.bars,
            bpm: parsed.bpm,
            stepCount: parsed.stepCount,
            notes: normalizeNotes(parsed.notes, parsed.stepCount)
        };
    }

    return {
        KEY_LAYOUT, TUNINGS, createState, setStep, setTimeSignature, setBars,
        setNoteLength, moveNote, findNoteAt, resolveKey, serialize, validate, deserialize,
        clampBpm, clampBars, stepsFor
    };
}));
