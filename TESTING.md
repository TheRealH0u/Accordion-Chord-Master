# Avtomatizirano funkcionalno testiranje

Šest pregledanih primerov TC-01–TC-06 je avtomatiziranih s Pythonovim pytest in
Playwrightom. Testi upravljajo pravi Chromium ter preverjajo vidne rezultate
registracije, prijave, akordov, shranjevanja in uvoza. Aplikacija in njen API nista
nadomeščena z lažnimi odgovori.

## Namestitev in izvedba

V korenu projekta s Pythonom 3.13 ustvarite namensko okolje:

```powershell
python -m venv .venv-test
.\.venv-test\Scripts\python.exe -m pip install -r requirements.txt -r requirements-test.txt
.\.venv-test\Scripts\python.exe -m playwright install chromium
.\.venv-test\Scripts\python.exe -m pytest
```

Na Linuxu uporabite `.venv-test/bin/python`; za namestitev brskalnika in njegovih
sistemskih knjižnic uporabite `python -m playwright install --with-deps chromium`.
Če je nastavljen `PLAYWRIGHT_BROWSERS_PATH`, mora biti vrednost enaka pri
namestitvi in pri izvedbi.

Strežnika ni treba posebej zaganjati. Vsak test dobi svojo začasno SQLite bazo,
novo sejo brskalnika, nov ključ seje in svoj strežnik na prostih vratih
127.0.0.1. Baza je določena pred uvozom app.py. Po testu se lastni strežnik ustavi,
testna baza pa odstrani. Obstoječe instance/accordion_chord_master.db testi ne
uporabljajo. Testi potrebujejo omrežni dostop do knjižnice Tone.js, ki jo aplikacija
nalaga iz CDN; zvoka ti primeri ne preverjajo.

## Rezultati in ponovitev posameznega primera

```powershell
.\.venv-test\Scripts\python.exe -m pytest -k tc04
.\.venv-test\Scripts\python.exe -m playwright show-trace POT_DO_TRACE_ZIP
```

`pytest.ini` privzeto zapiše rezultate v `artifacts/functional/`:

- `report.html`: samostojno HTML poročilo s končnim posnetkom vsakega testa;
- `junit.xml`: strojno berljivi rezultati za CI;
- `execution.json`: izidi, dejanski opaženi koraki, okolje in stanje čiščenja;
- `evidence/`: posnetki po korakih, tudi pred čiščenjem ob odstopanju;
- `browser/`: brskalnikovi posnetki in sled neuspešnih testov.

Ponovni zagon prepiše poročila v isti mapi; za primerjavo najprej arhivirajte celotno
mapo. Za drug izhod lahko spremenite `pytest.ini` in ARTIFACTS v conftest.py.

Neuspešen test vrne izhodno kodo 1. TC-04 ohranja zahtevo po pravilni obnovi
sekvence; znana napaka aplikacije ni označena kot xfail ali preskočena. Preglejte
posnetek `TC-04-step-06.png`, ki nastane pred čiščenjem. Posnetek v mapi browser
lahko kaže že počiščeno stanje.

## Cevovod

`.github/workflows/functional-tests.yml` zažene iste teste ob push, pull_request
ali ročnem workflow_dispatch. Na Ubuntu namesti Python 3.13, aplikacijo, testne
odvisnosti in Chromium; nato izvede `python -m pytest`. Zadnji korak z `always()`
shrani vsa poročila in dokazila za 14 dni tudi ob napaki. Izhodna koda testov se
ne prikrije, zato neuspešni testi pomenijo neuspešen CI job.

Workflow je lokalno dodan projektu. Oddaljeno izvajanje je mogoče šele po objavi
potrebnih datotek v GitHub in ni dokazano samo z lokalnim zagonom. Pred objavo
vključite tudi vse potrebne obstoječe lokalne aplikacijske datoteke; testna baza,
virtualno okolje in dokazila niso del izvorne kode za objavo.

## Sledljivost in pregled

`tests/e2e/reviewed_cases.json` vsebuje pregledane definicije brez starih rezultatov.
Vsaka testna funkcija ima oznako `tc_id`, oštevilčene korake in konkretna preverjanja.
Funkciji `expect` in `expect_response` čakata na dejansko stanje; fiksnih pavz ni.
Sintetični računi se ustvarijo posebej za vsak test prek vmesnika. Podatke za
uvoz test prekopira v lastno začasno datoteko.

Skripte je ustvaril agent Codex; preverjene so bile s primerjavo z definicijami,
neodvisnim pregledom in dejanskim zagonom. To ne nadomesti vašega pregleda pred
oddajo na vajah.
