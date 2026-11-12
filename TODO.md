# TODO: Accordion Chord Master → DAW za slovensko domačo glasbo

## Kontekst (preberi najprej, Copilot)

- **Stack:** Python, Flask, Flask-SQLAlchemy, SQLite, Jinja2, vanilla JS, Tone.js (Web Audio), PWA (manifest + service worker). Deploy na Renderju.
- **Obstoječe:** `/chords` (akordi), `/sequence-test` (sequencer), uporabniški računi, shranjevanje sekvenc, izvoz/uvoz `.acm`, `static/js/sequencer-test.js`, `sequencer-state.js`, `sequencer-history.js`, `piano.js`.
- **Cilj:** iz sequencerja narediti DAW za slovensko domačo (narodnozabavno) glasbo. Več linij (harmonika, bariton kitara, bas kitara, kitara, **glasovi**), odseki v različnih durih, klaviatura, ki sproti obarva tone izbranega dura, struktura pesmi, besedilo, na koncu neobvezno AI.
- **Glasbena pravila (to je jedro projekta):**
  - Osnovni akordi so **I, IV, V** (tonika, subdominanta, dominanta) in **vi** (relativni mol). Mole dodajamo prek kroga kvint.
  - Glasbo hrani kot **stopnje lestvice** + dur, ne kot fiksna imena tonov.
  - **Uglasitev** harmonike (C-F-B, B-Es-As, A-D-G, H-E-A, Cis-Fis-H, Gis-Cis-Fis, D-G-C) so tri vrste na krogu kvint. Vsaka vrsta ima toniko, dominanto (kvinta više) in subdominanto (kvinta niže). Tri vrste pokrijejo okno **5 zaporednih akordov** (C-F-B → G, C, F, B, Es).
  - Položaj na krogu kvint: `fifthIndex = (pitchClass * 7) % 12`. Dominanta = +1, subdominanta = −1.
  - **Prijem akorda** na desni strani harmonike so 3 sosednji gumbi: dur = stopnje `[1,3,5]`, relativni mol = `[1,3,6]` (F A C → F A D = D mol v prvem obratu).
  - **Uglasitev je lastnost linije**, ne projekta. Dur odseka je absoluten (npr. B dur).
  - Smer meha (vlek/potisk) **ni** pomembna za model. Basna stran harmonike se zaenkrat ne modelira.
  - Dve harmoniki se ujemata, če si delita akorde (C-F-B + B-Es-As = 3 skupni akordi). Polton razlike (C-F-B + Cis-Fis-H) = 0 skupnih akordov = trči. Aplikacija samo **opozori**, ne prepreči.
  - Slovenska imena tonov: B = B (b), **H = B naravni**, Es, As, Des, Cis, Fis, Gis.
  - Toni izven lestvice so dovoljeni (npr. B→H, Fis→F za jazzi barvo), samo vizualno označeni.

---

## Faza 0: Priprava in čiščenje

- [ ] Preimenuj `/sequence-test` v `/sequencer` in `sequencer-test.js` v `sequencer.js`; stara pot naj preusmeri (301).
- [ ] Loči čisto logiko (brez DOM-a) v ES module: `theory.js`, `model.js`, `history.js`, `audio.js`, `ui/*.js`.
- [ ] Dodaj `.editorconfig`, Prettier in ESLint (JS) ter Ruff ali Black (Python).
- [ ] Dodaj Vitest ali Jest za JS in pytest za Flask; vsaj en test na modul.
- [ ] Dodaj GitHub Actions: lint + testi ob vsakem pushu.
- [ ] Nastavi `SECRET_KEY` prek okolja, odstrani razvojni fallback za produkcijo.
- [ ] Dodaj CSRF zaščito na vse POST/PUT/DELETE API-je (Flask-WTF ali lasten token).
- [ ] Reši trajno shrambo na Renderju (Postgres ali trajni disk), da shranjene sekvence ne izginejo ob deployu.
- [ ] Dodaj Flask-Migrate (Alembic) za migracije baze.
- [ ] Posodobi README in FAKS-POROCILO.md z novo arhitekturo.

## Faza 1: Podatkovni model

- [ ] Definiraj JSON shemo projekta:
  - `Project { id, name, bpm, timeSignature, sections[], tracks[], lyrics, version }`
  - `Section { id, startBar, lengthBars, keyRoot, mode, label }`
  - `Track { id, name, type: "instrument" | "voice", instrument, tuning?, voiceLabel?, volume, pan, mute, solo, notes[] }`
  - `Note { id, degree, octave, accidental?, startBeat, durationBeats, syllable? }`
- [ ] Note hrani kot **stopnje + dur odseka**; absolutni ton se izračuna šele pri predvajanju in izrisu.
- [ ] Dodaj polje `version` v `.acm` in napiši migracijo iz obstoječega formata v v2.
- [ ] Napiši validacijo projekta (razponi, tipi, največja velikost, neznane vrednosti).
- [ ] Napiši testne projekte (prazen, 1 linija, več linij, več odsekov).
- [ ] Prepiši Undo/Redo na **ukaze** nad modelom (dodaj noto, premakni noto, spremeni dur odseka, dodaj linijo, spremeni uglasitev …) namesto na stanje DOM-a.

## Faza 2: Glasbena teorija (`theory.js`, čista logika + testi)

- [ ] `fifthIndex(pc)` in obratna funkcija za pretvorbo med tonom in položajem na krogu.
- [ ] `keyInfo(root, mode)` → `{ I, IV, V, vi, scalePitches, chordGrips }`.
- [ ] `chordGrip(keyRoot, "I" | "IV" | "V" | "vi")` → tone prijema (`[1,3,5]` ali `[1,3,6]`) vključno z obratom.
- [ ] `tuningRows(tuningName)` → tri vrste uglasitve.
- [ ] `tuningWindow(tuningName)` → 5 dosegljivih akordov.
- [ ] `canPlayKey(tuning, keyRoot)` → ali linija harmonike ta dur lahko igra.
- [ ] `sharedChords(tuningA, tuningB)` → število skupnih akordov, ocena ujemanja.
- [ ] `degreeToPitch(degree, keyRoot, mode, octave)` in obratno.
- [ ] Slovenska imena tonov (B/H, Es, As, Des, Cis, Fis, Gis) za prikaz in uvoz.
- [ ] Razvrstitev tona: `chordTone` | `scaleTone` | `outsideScale` glede na izbrani dur.
- [ ] Testi za vseh 7 uglasitev in vseh 12 tonalitet.

## Faza 3: Postavitev zaslona

- [ ] Zgornja vrstica: izbira trenutnega odseka (levo) in **izbira uglasitve** (desno).
- [ ] **Trak z odseki** nad linijami: klik izbere odsek, majhen meni za spremembo dura odseka.
- [ ] Linije pod trakom: levo ime, tip, inštrument, mute/solo, desno taktovska mreža.
- [ ] Gumb "Dodaj linijo" (izbira: harmonika, bariton kitara, bas kitara, kitara, glas).
- [ ] Piano tile spodaj, vezan na izbran odsek in izbrano linijo.
- [ ] Zoom (horizontalni in vertikalni) in drsenje po časovnici.
- [ ] Responsive postavitev in landscape opozorilo (ohrani obstoječe).
- [ ] Svetla/temna tema.

## Faza 4: Piano roll in highlight

- [ ] Izris mreže not na `<canvas>` ali SVG (ne na posameznih `div`-ih).
- [ ] Obarvaj vrstice po vlogi tona: akordni ton (I, IV, V, vi) / ton lestvice / izven lestvice.
- [ ] Piano tile obarvaj enako glede na izbran odsek.
- [ ] Prikaži oba prijema (`[1,3,5]` in `[1,3,6]`) z različnima barvama.
- [ ] Izven lestvice: prigušeno, a še vedno klikljivo (označi kot "barvanje").
- [ ] Dodajanje not z miško: klik, vlečenje za dolžino, premik, brisanje, multi-select.
- [ ] Vnos prek računalniške tipkovnice (QWERTZ) kot do zdaj.
- [ ] Kvantizacija (1/4, 1/8, 1/16, trioli) in magnet na mrežo.
- [ ] Izbira prikaza: imena tonov (slovenska) / stopnje (1, 3, 5) / oboje.
- [ ] Za linije harmonike: prikaži samo akorde, dosegljive na izbrani uglasitvi.

## Faza 5: Linije in inštrumenti

- [ ] Linija **harmonika**: akordni prijemi (`I`, `IV`, `V`, `vi`) kot osnovni vnos; uglasitev na liniji.
- [ ] Opozorilo, če izbrani dur ni dosegljiv na uglasitvi linije; linija se zatemni.
- [ ] Linija **bas kitara**: samodejno predlagan koren akorda; ročno urejanje.
- [ ] Linija **bariton kitara** in **kitara**: ritmični vzorci (npr. polka "um-pa") in ročni vnos.
- [ ] Neobvezno: klaviatura/klavir, bobni, klarinet, trobenta.
- [ ] Vzorci zvokov za vsak inštrument (najdi proste vzorce ali posnami); naloži lenobno ob prvi uporabi.
- [ ] `Tone.Sampler` na linijo, povezan na svoj `Tone.Channel`.
- [ ] Kazalnik ujemanja (`sharedChords`) med uglasitvami harmonik v projektu; **samo opozorilo** pri 0 skupnih akordih.
- [ ] Predloga uglasitve za spremljavo ("za C-F-B je dobra B-Es-As").

## Faza 6: Glasovi (vokal)

- [ ] Nov tip linije `voice`.
- [ ] Oznaka glasu je nastavljiva (privzeto **M** in **A**, prost vnos); neobvezno tipi: moški, ženski, tenor, bariton, bas, alt, sopran.
- [ ] Vsaka linija glasu ima ime pevca ali skupine, barvo in mute/solo.
- [ ] Razpon glasu (najnižji in najvišji ton) na liniji in **opozorilo za note izven razpona**.
- [ ] Pri vsaki noti glasu možnost zloga besedila (`syllable`); melizme in podaljški z `-` ali `_`.
- [ ] Prikaz imen tonov na notah glasov, da pevec ve, kaj poje.
- [ ] Pregled "kdo poje kaj" po odsekih (M, A, oba, unison, terca) kot majhna matrika pod časovnico.
- [ ] Samodejna sekunda/terca/seksta nad ali pod melodijo znotraj lestvice (pravilo, brez AI), kot predlog.
- [ ] Predvajanje glasu: preprosta sinteza ali vzorec "la"/"o"; jasno označi kot skico.
- [ ] Opozorilo pri transpoziciji dura, če glas pade izven razpona.
- [ ] Izvoz posamezne linije glasu (besedilo + akordi) za pevca.

## Faza 7: Struktura pesmi

- [ ] Sekcije pesmi: uvod, kitica, refren, vmesna igra, zaključek (preimenovanje, barve).
- [ ] Kopiranje, ponavljanje in prerazporejanje sekcij (drag & drop).
- [ ] "Ponovi 2×" in oznake ponovitev.
- [ ] Menjava dura znotraj pesmi (modulacija) kot poseben dogodek na traku odsekov.
- [ ] Menjava uglasitve sredi pesmi kot poseben dogodek (harmonikaš zamenja inštrument).
- [ ] Prikaz celotne pesmi v pregledu (overview) z vsemi sekcijami.
- [ ] Spremembe takta (3/4 ↔ 4/4) in tempa znotraj pesmi.

## Faza 8: Besedilo

- [ ] Polje za besedilo, razdeljeno na sekcije pesmi.
- [ ] Ročna povezava zlogov z notami glasov.
- [ ] Samodejna delitev besedila na zloge (slovenska pravila) kot predlog.
- [ ] Prikaz besedila pod notami glasu.
- [ ] Iskanje in zamenjava v besedilu.
- [ ] Izvoz besedila z akordi (akordni list).

## Faza 9: Predvajanje in mešalna miza

- [ ] Predvajanje prek `Tone.Transport` (ura, BPM, loop) namesto lastnih časovnikov.
- [ ] `Tone.start()` šele po uporabnikovem kliku.
- [ ] Sprememba BPM med predvajanjem brez zrušitve.
- [ ] Čakanje na nalaganje vzorcev, indikator napredka.
- [ ] Mešalna miza: volumen, pan, mute, solo na linijo; master volumen.
- [ ] Metronom (vklop/izklop, štetje pred začetkom).
- [ ] Loop izbranega območja ali odseka.
- [ ] Kazalec predvajanja in samodejno drsenje.
- [ ] Neobvezno: reverb in osnovni učinki na master.

## Faza 10: Shranjevanje, uvoz in izvoz

- [ ] Shranjevanje projekta na strežnik (obstoječi API prilagoditi novemu modelu).
- [ ] Samodejno shranjevanje (autosave) z indikatorjem.
- [ ] Seznam projektov, preimenovanje, podvajanje, brisanje.
- [ ] Uvoz `.acm` v1 (migracija) in v2.
- [ ] Izvoz **MIDI** (po linijah).
- [ ] Izvoz **WAV/MP3** (offline render prek `Tone.Offline`).
- [ ] Izvoz **akordnega lista** (PDF ali tiskljiv HTML) z besedilom.
- [ ] Neobvezno: izvoz notnega zapisa (MusicXML).
- [ ] Deljenje projekta prek povezave (samo za branje).
- [ ] Strogo validiraj vsak uvoz.

## Faza 11: Pomoč pri pisanju (pravila, brez AI)

- [ ] Predlog naslednjega akorda glede na trenutni (I → IV, V, vi …).
- [ ] Predlog pivot akorda pri modulaciji (iz C v F prek C ali F).
- [ ] Opozorilo, ko melodija ostaja daleč od lestvice ali ni v tonu akorda ob močnih dobah.
- [ ] Predlog "barvanja" (B→H, Fis→F) kot izbirni nasvet.
- [ ] Predloge pogostih zaporedij za polko, valček in poskočnico.

## Faza 12: AI (neobvezno, na koncu)

- [ ] Odloči, ali sploh dodati AI; najprej poskrbi, da je faza 11 končana.
- [ ] Namig pri pisanju: "tu bi lahko šel na vi".
- [ ] Pomoč pri besedilu (rime, metrum, slovenščina); preveri kakovost izbranega modela.
- [ ] Iz besedila in glasbe predlagaj strukturo pesmi.
- [ ] Vse AI predloge prikaži kot **predloge**, ki jih uporabnik sprejme ali zavrne.
- [ ] Omejitve porabe, obravnava napak in jasno obvestilo, da je to AI.

## Faza 13: Kakovost, PWA in mobilno

- [ ] Zmogljivost pri 8+ linijah in več sto notah (canvas, virtualizacija).
- [ ] Dostopnost: tipkovnica, kontrast, oznake ARIA.
- [ ] Service Worker: predpomnjenje vzorcev in delo brez povezave.
- [ ] Prilagoditev za tablico in telefon (landscape).
- [ ] Obravnava napak pri nalaganju zvoka in shranjevanju.
- [ ] Testi E2E (Playwright) za ključne tokove: nova pesem, dodaj noto, predvajaj, shrani, uvozi.
- [ ] Varnost: rate limiting za prijavo, preverjanje lastništva nad projekti.

---

## Odprta vprašanja

- [ ] Za koga je orodje: samo zase in ansambel ali za širšo publiko?
- [ ] Kje dobiti ali posneti vzorce za harmoniko, bariton in bas?
- [ ] Ali podpreti basno stran harmonike pozneje?
- [ ] Kako predstaviti "težke prijeme" (fizična težavnost) kot oznako, če sploh?
