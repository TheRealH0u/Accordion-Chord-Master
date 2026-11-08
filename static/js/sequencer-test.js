(function () {
    "use strict";

    const model = window.SequenceModel;
    const history = new window.SequenceHistory(model.createState());
    const grid = document.getElementById("grid");
    const status = document.getElementById("status");
    const tonePopup = document.getElementById("tone-popup");
    const tonePopupTitle = document.getElementById("tone-popup-title");
    const tonePopupGrid = document.getElementById("tone-popup-grid");
    const tonePopupClose = document.getElementById("tone-popup-close");
    const tonePopupRemove = document.getElementById("tone-popup-remove");
    const pagePrev = document.getElementById("page-prev");
    const pageNext = document.getElementById("page-next");
    const pageLabel = document.getElementById("page-label");
    const addBarsButton = document.getElementById("add-bars");
    const barsPopup = document.getElementById("bars-popup");
    const barsPopupClose = document.getElementById("bars-popup-close");
    const barsCustomInput = document.getElementById("bars-custom");
    const barsCustomAdd = document.getElementById("bars-custom-add");
    const sequenceNameInput = document.getElementById("sequence-name");
    const savedSequences = document.getElementById("saved-sequences");
    const saveSequenceButton = document.getElementById("save-sequence");
    const loadSequenceButton = document.getElementById("load-sequence");
    const deleteSequenceButton = document.getElementById("delete-sequence");
    const tone = window.Tone;
    const synth = tone ? new tone.PolySynth(tone.Synth).toDestination() : null;
    const NOTE_TO_MIDI = {
        C: 48, Cis: 49, D: 50, Dis: 51, E: 52, F: 53, Fis: 54,
        G: 55, Gis: 56, A: 57, Ais: 58, B: 58, H: 59,
        Des: 49, Es: 51, As: 56, Ges: 54
    };
    let selectedStep = null;
    let playing = false;
    let resizeDraft = null;
    let pendingMove = null;
    let moveDraft = null;
    let activeStep = -1;
    let popupTargetStart = null;
    let suppressNextGridClick = false;
    let currentPage = 1;
    let navHoldTimer = null;
    const BARS_PER_PAGE = 4;

    function setStatus(message, error) {
        status.textContent = message;
        status.classList.toggle("error", Boolean(error));
    }

    function current() {
        return history.current;
    }

    function update(next) {
        history.apply(next);
        currentPage = Math.min(currentPage, totalPages(next));
        render();
    }

    function totalPages(state) {
        return Math.max(1, Math.ceil(state.bars / BARS_PER_PAGE));
    }

    function pageRange(state, page) {
        const beats = beatsPerBar(state.timeSignature);
        const pageStartBar = (page - 1) * BARS_PER_PAGE;
        const pageEndBar = Math.min(state.bars, pageStartBar + BARS_PER_PAGE);
        return {
            startBar: pageStartBar,
            endBar: pageEndBar,
            startStep: pageStartBar * beats,
            endStep: (pageEndBar * beats) - 1,
            stepCount: (pageEndBar - pageStartBar) * beats
        };
    }

    function goToPage(page) {
        const maxPage = totalPages(current());
        currentPage = Math.max(1, Math.min(maxPage, page));
        render();
    }

    function ensureStepVisible(step) {
        const beats = beatsPerBar(current().timeSignature);
        const barIndex = Math.floor(step / beats);
        const page = Math.floor(barIndex / BARS_PER_PAGE) + 1;
        if (page !== currentPage) {
            currentPage = page;
        }
    }

    function closeTonePopup() {
        popupTargetStart = null;
        tonePopup.classList.add("hidden");
        tonePopupGrid.replaceChildren();
    }

    function openBarsPopup() {
        barsPopup.classList.remove("hidden");
        barsCustomInput.value = "1";
        barsCustomInput.focus();
    }

    function closeBarsPopup() {
        barsPopup.classList.add("hidden");
    }

    function addBars(countValue) {
        const count = Math.max(1, Math.min(32, Number(countValue) || 1));
        const nextBars = current().bars + count;
        const next = model.setBars(current(), nextBars);
        update(next);
        goToPage(totalPages(next));
        closeBarsPopup();
        setStatus("Dodanih taktov: " + count + ".");
    }

    function popupPosition(clientX, clientY) {
        if (window.matchMedia("(orientation: landscape) and (max-height: 560px)").matches) {
            tonePopup.classList.add("compact-mobile");
            tonePopup.style.left = "";
            tonePopup.style.top = "";
            return;
        }
        tonePopup.classList.remove("compact-mobile");
        const margin = 12;
        const width = tonePopup.offsetWidth || 420;
        const height = tonePopup.offsetHeight || 340;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const x = Number.isFinite(clientX) ? clientX : viewportWidth / 2;
        const y = Number.isFinite(clientY) ? clientY : viewportHeight / 2;
        const left = Math.min(Math.max(margin, x + 10), viewportWidth - width - margin);
        const top = Math.min(Math.max(margin, y + 10), viewportHeight - height - margin);
        tonePopup.style.left = left + "px";
        tonePopup.style.top = top + "px";
    }

    function toneOptions(state) {
        const options = [];
        for (let row = 0; row < 3; row += 1) {
            for (let col = 0; col < 6; col += 1) {
                const idx = row * 6 + col;
                const key = model.KEY_LAYOUT[idx];
                const chord = model.resolveKey(state.tuning, key);
                options.push({ row, key, chord, type: chord.type });
            }
        }
        return options;
    }

    function openTonePopup(step, clientX, clientY) {
        const state = current();
        const existing = model.findNoteAt(state, step);
        const start = existing ? existing.start : step;
        popupTargetStart = start;
        selectedStep = start;

        tonePopupGrid.replaceChildren();
        toneOptions(state).forEach((item) => {
            const option = document.createElement("button");
            option.type = "button";
            option.className = "tone-option " + item.type;
            if (existing && existing.key === item.key) option.classList.add("active");
            option.dataset.key = item.key;
            option.innerHTML = "<strong>" + item.chord.name + "</strong><small>" + item.key.toUpperCase() + "</small>";
            option.addEventListener("click", function () {
                const note = model.findNoteAt(current(), popupTargetStart);
                const length = note ? note.length : 1;
                update(model.setStep(current(), popupTargetStart, item.key, length));
                setStatus("Ton posodobljen.");
                closeTonePopup();
            });
            tonePopupGrid.appendChild(option);
        });

        tonePopupTitle.textContent = existing ? ("Uredi ton na dobi " + (start + 1)) : ("Dodaj ton na dobo " + (start + 1));
        tonePopupRemove.classList.toggle("hidden", !existing);
        tonePopup.classList.remove("hidden");
        popupPosition(clientX, clientY);
        render();
    }

    function beatsPerBar(timeSignature) {
        return timeSignature === "3/4" ? 3 : 4;
    }

    function stepFromEventTarget(event) {
        const target = event.target.closest("[data-step]");
        if (!target) return null;
        const step = Number(target.dataset.step);
        return Number.isInteger(step) ? step : null;
    }

    function stepFromPointer(event) {
        const beats = grid.querySelectorAll(".beat");
        if (!beats.length) return null;
        const x = event.clientX;

        for (let i = 0; i < beats.length; i += 1) {
            const rect = beats[i].getBoundingClientRect();
            if (x >= rect.left && x <= rect.right) {
                const step = Number(beats[i].dataset.step);
                return Number.isInteger(step) ? step : null;
            }
        }

        const firstRect = beats[0].getBoundingClientRect();
        const lastRect = beats[beats.length - 1].getBoundingClientRect();
        if (x < firstRect.left) {
            const firstStep = Number(beats[0].dataset.step);
            return Number.isInteger(firstStep) ? firstStep : null;
        }
        if (x > lastRect.right) {
            const lastStep = Number(beats[beats.length - 1].dataset.step);
            return Number.isInteger(lastStep) ? lastStep : null;
        }
        return null;
    }

    function selectedNoteStart() {
        if (selectedStep === null) return null;
        const note = model.findNoteAt(current(), selectedStep);
        return note ? note.start : selectedStep;
    }

    function moveBounds(state, fromStart, length) {
        const others = state.notes.filter((item) => item.start !== fromStart);
        const leftNeighbor = others
            .filter((item) => item.start + item.length <= fromStart)
            .sort((a, b) => (b.start + b.length) - (a.start + a.length))[0];
        const rightNeighbor = others
            .filter((item) => item.start >= fromStart + length)
            .sort((a, b) => a.start - b.start)[0];

        const minStart = leftNeighbor ? leftNeighbor.start + leftNeighbor.length : 0;
        const maxStartByLength = state.stepCount - length;
        const maxStart = rightNeighbor ? Math.min(maxStartByLength, rightNeighbor.start - length) : maxStartByLength;
        return { minStart, maxStart };
    }

    function render() {
        const state = current();
        document.getElementById("bpm").value = state.bpm;
        document.getElementById("tuning").value = state.tuning;
        document.getElementById("time-signature").value = state.timeSignature;
        const maxPage = totalPages(state);
        if (currentPage > maxPage) currentPage = maxPage;
        const range = pageRange(state, currentPage);

        pageLabel.textContent = "Stran " + currentPage + " / " + maxPage;
        pagePrev.classList.remove("hidden");
        pagePrev.disabled = currentPage <= 1;
        pagePrev.setAttribute("aria-disabled", String(currentPage <= 1));
        const hasNextPage = currentPage < maxPage;
        pageNext.classList.toggle("hidden", !hasNextPage);
        if (addBarsButton) addBarsButton.classList.toggle("hidden", hasNextPage);

        //grid.style.setProperty("--step-count", Math.max(1, range.stepCount));
        grid.style.setProperty("--step-count", state.timeSignature.charAt(0)*4);
        grid.classList.toggle("resizing", Boolean(resizeDraft));
        grid.classList.toggle("moving", Boolean(moveDraft));
        grid.replaceChildren();
        const barSize = beatsPerBar(state.timeSignature);

        const targetStart = moveDraft ? moveDraft.targetStart : null;
        const targetEnd = moveDraft ? moveDraft.targetStart + moveDraft.length - 1 : null;

        for (let index = range.startStep; index <= range.endStep; index += 1) {
            const local = index - range.startStep;
            const beat = document.createElement("div");
            beat.className = "beat" + (selectedStep === index ? " selected" : "") + (index === activeStep ? " playing" : "") + (index % barSize === 0 ? " bar-start" : "");
            if (targetStart !== null && index >= targetStart && index <= targetEnd) {
                beat.classList.add("drop-target");
            }
            beat.dataset.step = index;
            beat.style.gridColumn = (local + 1) + " / span 1";
            beat.style.gridRow = "1";
            grid.appendChild(beat);
        }

        state.notes.forEach((note) => {
            const chord = model.resolveKey(state.tuning, note.key);
            const previewLength = resizeDraft && resizeDraft.start === note.start ? resizeDraft.length : note.length;
            const previewStart = moveDraft && moveDraft.start === note.start ? moveDraft.targetStart : note.start;
            const end = previewStart + previewLength - 1;
            if (end < range.startStep || previewStart > range.endStep) return;
            const drawStart = Math.max(previewStart, range.startStep);
            const drawEnd = Math.min(end, range.endStep);
            const drawLength = drawEnd - drawStart + 1;

            const noteEl = document.createElement("button");
            noteEl.type = "button";
            noteEl.className = "note " + chord.type;
            if (selectedStep !== null && selectedStep >= previewStart && selectedStep <= end) noteEl.classList.add("selected");
            if (activeStep >= note.start && activeStep <= end) noteEl.classList.add("playing");
            noteEl.dataset.step = previewStart;
            noteEl.dataset.noteStart = note.start;
            noteEl.style.gridColumn = ((drawStart - range.startStep) + 1) + " / span " + drawLength;
            noteEl.style.gridRow = "1";
            noteEl.setAttribute("aria-label", "Nota od " + (previewStart + 1) + " dolga " + previewLength + " dob");
            noteEl.innerHTML = "<strong>" + chord.name + "</strong><small>" + note.key.toUpperCase() + " · " + previewLength + "</small>";

            const resizeHandle = document.createElement("span");
            resizeHandle.className = "resize-handle";
            resizeHandle.title = "Povleci za dolžino note";
            resizeHandle.addEventListener("pointerdown", function (event) {
                event.preventDefault();
                event.stopPropagation();
                pendingMove = null;
                closeTonePopup();
                selectedStep = note.start;
                resizeDraft = { start: note.start, key: note.key, length: note.length };
                render();
            });
            noteEl.appendChild(resizeHandle);

            noteEl.addEventListener("pointerdown", function (event) {
                if (event.target.closest(".resize-handle")) return;
                event.preventDefault();
                event.stopPropagation();
                closeTonePopup();
                const anchor = stepFromPointer(event);
                const offset = anchor === null ? 0 : Math.max(0, Math.min(note.length - 1, anchor - note.start));
                pendingMove = {
                    start: note.start,
                    length: note.length,
                    targetStart: note.start,
                    startX: event.clientX,
                    startY: event.clientY,
                    offset: offset
                };
                selectedStep = note.start;
                render();
            });

            noteEl.addEventListener("click", function (event) {
                event.stopPropagation();
                if (moveDraft || pendingMove) return;
                openTonePopup(note.start, event.clientX, event.clientY);
            });

            grid.appendChild(noteEl);
        });
    }

    function assignFromKeyboard(key) {
        if (selectedStep === null) {
            setStatus("Najprej izberi korak.", true);
            return;
        }
        const note = model.findNoteAt(current(), selectedStep);
        const start = note ? note.start : selectedStep;
        const length = note ? note.length : 1;
        ensureStepVisible(start);
        update(model.setStep(current(), start, key, length));
        setStatus("Korak " + (start + 1) + " nastavljen.");
    }

    document.getElementById("bpm").addEventListener("change", function (event) {
        const next = { ...current(), bpm: model.clampBpm(event.target.value) };
        update(next);
    });
    document.getElementById("tuning").addEventListener("change", function (event) {
        update({ ...current(), tuning: event.target.value });
        setStatus("Uglasitev spremenjena; tipke v sekvenci so ohranile svoje pomene.");
    });
    document.getElementById("time-signature").addEventListener("change", function (event) {
        update(model.setTimeSignature(current(), event.target.value));
        selectedStep = null;
    });
    document.getElementById("undo").addEventListener("click", function () { history.undo(); render(); });
    document.getElementById("redo").addEventListener("click", function () { history.redo(); render(); });

    tonePopupClose.addEventListener("click", closeTonePopup);
    tonePopupRemove.addEventListener("click", function () {
        if (popupTargetStart === null) return;
        update(model.setStep(current(), popupTargetStart, null));
        closeTonePopup();
        setStatus("Ton odstranjen.");
    });

    if (addBarsButton) addBarsButton.addEventListener("click", openBarsPopup);
    if (barsPopupClose) barsPopupClose.addEventListener("click", closeBarsPopup);
    if (barsCustomAdd) {
        barsCustomAdd.addEventListener("click", function () {
            addBars(barsCustomInput ? barsCustomInput.value : 1);
        });
    }
    if (barsPopup) {
        barsPopup.querySelectorAll(".bars-preset").forEach(function (button) {
            button.addEventListener("click", function () {
                addBars(button.dataset.bars);
            });
        });
    }

    function startHoldNavigation(direction) {
        if ((direction < 0 && pagePrev.disabled) || (direction > 0 && pageNext.classList.contains("hidden"))) return;
        if (navHoldTimer) clearInterval(navHoldTimer);
        goToPage(currentPage + direction);
        navHoldTimer = setInterval(function () {
            const before = currentPage;
            goToPage(currentPage + direction);
            if (before === currentPage) {
                clearInterval(navHoldTimer);
                navHoldTimer = null;
            }
        }, 250);
    }

    function stopHoldNavigation() {
        if (navHoldTimer) {
            clearInterval(navHoldTimer);
            navHoldTimer = null;
        }
    }

    pagePrev.addEventListener("pointerdown", function () { startHoldNavigation(-1); });
    pageNext.addEventListener("pointerdown", function () { startHoldNavigation(1); });
    pagePrev.addEventListener("pointerup", stopHoldNavigation);
    pageNext.addEventListener("pointerup", stopHoldNavigation);
    pagePrev.addEventListener("pointercancel", stopHoldNavigation);
    pageNext.addEventListener("pointercancel", stopHoldNavigation);
    pagePrev.addEventListener("pointerleave", stopHoldNavigation);
    pageNext.addEventListener("pointerleave", stopHoldNavigation);

    grid.addEventListener("click", function (event) {
        if (suppressNextGridClick) {
            suppressNextGridClick = false;
            return;
        }
        const step = stepFromEventTarget(event);
        if (step === null) return;
        if (moveDraft || pendingMove || resizeDraft) return;
        ensureStepVisible(step);
        openTonePopup(step, event.clientX, event.clientY);
    });

    document.addEventListener("pointermove", function (event) {
        if (!resizeDraft && !moveDraft) return;
        const step = stepFromPointer(event);
        if (step === null) return;

        if (resizeDraft) {
            const note = current().notes.find((item) => item.start === resizeDraft.start);
            if (!note) return;
            const nextNote = current().notes
                .filter((item) => item.start > resizeDraft.start)
                .sort((a, b) => a.start - b.start)[0];
            const maxLength = nextNote ? nextNote.start - resizeDraft.start : current().stepCount - resizeDraft.start;
            const nextLength = Math.max(1, Math.min(maxLength, step - resizeDraft.start + 1));
            if (nextLength !== resizeDraft.length) {
                resizeDraft = { ...resizeDraft, length: nextLength };
                render();
            }
            return;
        }

        if (moveDraft) {
            const rawStart = step - moveDraft.offset;
            const bounds = moveBounds(current(), moveDraft.start, moveDraft.length);
            const nextStart = Math.max(bounds.minStart, Math.min(bounds.maxStart, rawStart));
            if (nextStart !== moveDraft.targetStart) {
                moveDraft = { ...moveDraft, targetStart: nextStart };
                render();
            }
        }
    });

    document.addEventListener("pointermove", function (event) {
        if (!pendingMove || moveDraft) return;
        if (Math.abs(event.clientX - pendingMove.startX) >= 4 || Math.abs(event.clientY - pendingMove.startY) >= 4) {
            moveDraft = {
                start: pendingMove.start,
                length: pendingMove.length,
                targetStart: pendingMove.targetStart,
                offset: pendingMove.offset
            };
            pendingMove = null;
            render();
        }
    });

    document.addEventListener("pointerup", function () {
        if (resizeDraft) {
            const next = model.setNoteLength(current(), resizeDraft.start, resizeDraft.length);
            resizeDraft = null;
            update(next);
            setStatus("Dolžina note posodobljena.");
            return;
        }
        if (moveDraft) {
            const movedStart = moveDraft.targetStart;
            const next = model.moveNote(current(), moveDraft.start, moveDraft.targetStart);
            moveDraft = null;
            ensureStepVisible(movedStart);
            update(next);
            setStatus("Nota premaknjena.");
            return;
        }
        if (pendingMove) {
            openTonePopup(pendingMove.start, pendingMove.startX, pendingMove.startY);
            pendingMove = null;
            suppressNextGridClick = true;
        }
    });

    document.addEventListener("pointerdown", function (event) {
        if (!tonePopup.classList.contains("hidden") && !event.target.closest("#tone-popup")) {
            closeTonePopup();
        }

        if (barsPopup && !barsPopup.classList.contains("hidden") && !event.target.closest("#bars-popup") && !event.target.closest("#add-bars")) {
            closeBarsPopup();
        }
    });

    window.addEventListener("resize", function () {
        if (!tonePopup.classList.contains("hidden")) {
            popupPosition(window.innerWidth / 2, window.innerHeight / 2);
        }
    });

    document.addEventListener("keydown", function (event) {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
            event.preventDefault();
            history.undo();
            render();
        } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
            event.preventDefault();
            history.redo();
            render();
        } else if (!event.ctrlKey && !event.metaKey && (event.key === "Delete" || event.key === "Backspace")) {
            const start = selectedNoteStart();
            if (start !== null) {
                update(model.setStep(current(), start, null));
                setStatus("Nota izbrisana.");
                closeTonePopup();
            }
        } else if (event.key === "Escape") {
            closeTonePopup();
            closeBarsPopup();
        } else if (!event.ctrlKey && !event.metaKey && model.KEY_LAYOUT.includes(event.key.toLowerCase())) {
            assignFromKeyboard(event.key.toLowerCase());
        }
    });

    function playStep(time) {
        const state = current();
        const index = Math.floor(tone.Transport.seconds / (60 / state.bpm)) % state.stepCount;
        activeStep = index;
        render();

        const note = state.notes.find((item) => item.start === index);
        if (note) {
            const chord = model.resolveKey(state.tuning, note.key);
            const rootName = chord.name.replace(/m$/, "");
            const rootMidi = NOTE_TO_MIDI[rootName];
            if (rootMidi !== undefined) {
                const intervals = chord.type === "major" ? [0, 4, 7, 12] : [0, 3, 7, 12];
                const notes = intervals.map((interval) => tone.Frequency(rootMidi + interval, "midi").toNote());
                const seconds = (60 / state.bpm) * note.length;
                synth.triggerAttackRelease(notes, seconds, time);
            }
        }
    }

    async function startPlayback() {
        if (playing) return;
        if (!tone || !synth) {
            setStatus("Tone.js se ni naložil. Preveri internetno povezavo in osveži stran.", true);
            return;
        }
        await tone.start();
        tone.Transport.stop();
        tone.Transport.cancel();
        tone.Transport.bpm.value = current().bpm;
        tone.Transport.scheduleRepeat(playStep, "4n");
        tone.Transport.start();
        playing = true;
        setStatus("Predvajanje ...");
    }

    function stopPlayback() {
        if (tone) {
            tone.Transport.stop();
            tone.Transport.cancel();
        }
        playing = false;
        activeStep = -1;
        render();
        setStatus("Ustavljeno.");
    }

    document.getElementById("play").addEventListener("click", startPlayback);
    document.getElementById("stop").addEventListener("click", stopPlayback);

    document.getElementById("export").addEventListener("click", function () {
        const blob = new Blob([model.serialize(current())], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "accordion-sequence.acm";
        link.click();
        URL.revokeObjectURL(link.href);
    });

    document.getElementById("import").addEventListener("change", async function (event) {
        const file = event.target.files[0];
        if (!file) return;
        try {
            update(model.deserialize(await file.text()));
            selectedStep = null;
            currentPage = 1;
            setStatus("ACM datoteka uspešno uvožena.");
        } catch (error) {
            setStatus(error.message, true);
        } finally {
            event.target.value = "";
        }
    });

    async function refreshSavedSequences() {
        const response = await fetch("/api/sequences");
        if (response.status === 401) {
            setStatus("Za shranjevanje sekvenc se prijavi.");
            return;
        }
        if (!response.ok) {
            throw new Error("Seznama shranjenih sekvenc ni bilo mogoče naložiti.");
        }
        const payload = await response.json();
        savedSequences.replaceChildren(new Option("Shranjene sekvence", ""));
        payload.sequences.forEach((sequence) => {
            savedSequences.appendChild(new Option(sequence.name, String(sequence.id)));
        });
    }

    saveSequenceButton.addEventListener("click", async function () {
        const name = sequenceNameInput.value.trim();
        if (!name) {
            setStatus("Vnesi ime sekvence.", true);
            sequenceNameInput.focus();
            return;
        }
        try {
            const response = await fetch("/api/sequences", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name, state: current() })
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Sekvence ni bilo mogoče shraniti.");
            await refreshSavedSequences();
            savedSequences.value = String(payload.id);
            setStatus("Sekvenca je shranjena.");
        } catch (error) {
            setStatus(error.message, true);
        }
    });

    loadSequenceButton.addEventListener("click", async function () {
        const id = savedSequences.value;
        if (!id) {
            setStatus("Izberi shranjeno sekvenco.", true);
            return;
        }
        try {
            const response = await fetch("/api/sequences/" + encodeURIComponent(id));
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Sekvence ni bilo mogoče naložiti.");
            update(model.deserialize(payload.state));
            sequenceNameInput.value = payload.name;
            selectedStep = null;
            currentPage = 1;
            setStatus("Sekvenca je naložena.");
        } catch (error) {
            setStatus(error.message, true);
        }
    });

    deleteSequenceButton.addEventListener("click", async function () {
        const id = savedSequences.value;
        if (!id) {
            setStatus("Izberi shranjeno sekvenco.", true);
            return;
        }
        try {
            const response = await fetch("/api/sequences/" + encodeURIComponent(id), { method: "DELETE" });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Sekvence ni bilo mogoče izbrisati.");
            sequenceNameInput.value = "";
            await refreshSavedSequences();
            setStatus("Sekvenca je izbrisana.");
        } catch (error) {
            setStatus(error.message, true);
        }
    });

    refreshSavedSequences().catch((error) => setStatus(error.message, true));
    render();
}());
