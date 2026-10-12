# Accordion Chord Master

## 1. Izbira projekta

Za nadaljnje vaje je bil izbran projekt **Accordion Chord Master**. Gre za spletno
aplikacijo, namenjeno raziskovanju harmonije in ustvarjanju glasbenih sekvenc
za diatonično harmoniko.

Projekt je dovolj obsežen za nadaljnje delo, saj vsebuje več ločenih področij:

- Flask spletni strežnik,
- HTML predloge in CSS uporabniški vmesnik,
- JavaScript interakcije,
- predvajanje zvoka,
- sequencer za ustvarjanje glasbenih sekvenc,
- uporabniške račune,
- shranjevanje podatkov v SQLite bazo,
- uvoz in izvoz sekvenc.

Rešitev je bila razvita kot študentski projekt in se nadaljuje v okviru vaj.

## 2. Tehnologije in struktura projekta

### Uporabljene tehnologije

- Python,
- Flask,
- Flask-SQLAlchemy,
- SQLite,
- HTML in Jinja2 predloge,
- CSS,
- JavaScript,
- Tone.js,
- Web Audio API,
- Service Worker in PWA manifest.

### Glavni deli projekta

| Del                                  | Namen                                                         |
| ------------------------------------ | ------------------------------------------------------------- |
| `app.py`                             | Flask aplikacija, spletne rute, uporabniki in API za sekvence |
| `templates/`                         | HTML/Jinja2 predloge                                          |
| `static/css/`                        | skupni, responsive in funkcionalni CSS                        |
| `static/js/piano.js`                 | predvajanje akordov                                           |
| `static/js/sequencer-test.js`        | uporabniški vmesnik sequencerja                               |
| `static/js/sequencer-state.js`       | stanje, note in validacija sequencerja                        |
| `static/js/sequencer-history.js`     | Undo/Redo zgodovina                                           |
| `instance/accordion_chord_master.db` | lokalna SQLite baza                                           |
| `requirements.txt`                   | Python odvisnosti                                             |
| `README.md`                          | osnovna vzpostavitvena dokumentacija                          |

## 3. Vzpostavitev projekta

### Predpogoji

Za zagon projekta potrebujemo:

- Python 3.13 ali novejši,
- `pip`,
- spletni brskalnik,
- internetno povezavo za nalaganje Tone.js iz CDN-ja.

### Namestitev

V terminalu se pomaknemo v korensko mapo projekta:

```bash
cd Accordion-Chord-Master
```

Nato namestimo Python odvisnosti:

```bash
python -m pip install -r requirements.txt
```

### Zagon

Projekt zaženemo z ukazom:

```bash
python app.py
```

Po zagonu je aplikacija dostopna na:

```text
http://127.0.0.1:5000/
```

### Glavne strani

| URL              | Namen                          |
| ---------------- | ------------------------------ |
| `/`              | začetna stran in izbira orodja |
| `/chords`        | raziskovanje akordov           |
| `/sequence-test` | sequencer                      |
| `/login`         | prijava uporabnika             |
| `/register`      | registracija uporabnika        |

Ob prvem zagonu se lokalno ustvari SQLite baza:

```text
instance/accordion_chord_master.db
```

Za produkcijsko uporabo je treba nastaviti tudi okoljsko spremenljivko
`SECRET_KEY`. Privzeta vrednost v kodi je namenjena samo lokalnemu razvoju.

## 4. Ključne funkcionalnosti

Izbrana rešitev vsebuje več kot zahtevanih 8–10 funkcionalnosti.

### 4.1 Začetna stran in navigacija

1. Začetna stran z izbiro med akordi in sequencerjem.
2. Skupni sidebar na vseh glavnih straneh.
3. Sidebar se lahko skrije in ponovno prikaže.
4. Stanje sidebarja se shrani v brskalniku in se ohrani med prehodi med
   stranmi.
5. Responsive navigacija za manjše zaslone.

### 4.2 Raziskovanje akordov

6. Izbira uglasitve diatonične harmonike.
7. Prikaz dur akordov.
8. Prikaz mol akordov.
9. Prikaz tonike, dominante in subdominante.
10. Prikaz relativnih molov.
11. Predvajanje akordov s klikom.
12. Predvajanje akordov preko računalniške tipkovnice.
13. Dodajanje višje oktave z možnostjo `High`.

### 4.3 Sequencer

14. Dodajanje harmonikinih tonov v mrežo.
15. Urejanje tona v mreži.
16. Brisanje tona.
17. Premikanje tona po mreži.
18. Raztezanje tona čez več dob in taktov.
19. Podpora za takt 3/4.
20. Podpora za takt 4/4.
21. Dodajanje dodatnih taktov.
22. Navigacija po več straneh sequencerja.
23. Nastavitev BPM.
24. Predvajanje sekvence.
25. Ustavitev predvajanja.
26. Undo in Redo.
27. Vnos tonov preko tipkovnice QWERTZ.
28. Izvoz sekvence v `.acm` datoteko.
29. Uvoz sekvence iz `.acm` datoteke.

### 4.4 Uporabniški računi

30. Registracija novega uporabnika.
31. Prijava uporabnika.
32. Odjava uporabnika.
33. Hashiranje gesel pred shranjevanjem.
34. Prikaz prijavljenega uporabnika v sidebarju.
35. Omejitev dostopa do shranjenih sekvenc na prijavljenega uporabnika.

### 4.5 Shranjevanje sekvenc

36. Ročno shranjevanje sekvence z imenom.
37. Prikaz seznama uporabnikovih sekvenc.
38. Nalaganje shranjene sekvence.
39. Posodabljanje sekvence z enakim imenom.
40. Brisanje sekvence.

### 4.6 Mobilna in PWA podpora

41. Opozorilo pri uporabi v pokončnem načinu telefona.
42. Responsive prilagoditev uporabniškega vmesnika.
43. PWA manifest.
44. Service Worker.

## 5. Stanje testiranja in zagotavljanja kakovosti

V projektu trenutno še ni formalnega testnega ogrodja, kot sta `pytest` ali
Selenium.
