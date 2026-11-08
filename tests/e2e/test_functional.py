"""UI automation of the six reviewed cases from assignments 2 and 3.

Every test receives a fresh browser context and a separate server/database via
conftest.py. Assertions describe correct behaviour, including TC-04: a known
application defect must fail the test, rather than being marked xfail.
"""

from contextlib import contextmanager
from pathlib import Path
import re
import shutil
import warnings

import pytest
from playwright.sync_api import Page, expect


FIXTURES = Path(__file__).parent / "fixtures"
GUEST_MESSAGE = "Za shranjevanje sekvenc se prijavi."
UPLOAD_SUCCESS = "ACM datoteka uspešno uvožena."


class CaseProgress:
    def __init__(self, case_id, evidence_step):
        self.case_id = case_id
        self.evidence_step = evidence_step
        self.number = 0

    def step(self, number):
        self.number = number

    def observed(self, observation):
        self.evidence_step(self.case_id, self.number, observation)


def _visible_state(page):
    """Read only rendered DOM values; never change the app's internal model."""
    state = {"url": page.url}
    if page.locator("#status").count():
        state["status"] = page.locator("#status").inner_text()
        state.update(_sequence_snapshot(page))
    else:
        state["text"] = page.locator("body").inner_text()[:1800]
    return str(state)


@contextmanager
def _case(page, case_id, evidence_step, cleanup):
    """Preserve the failing UI before cleanup and retain the original failure."""
    progress = CaseProgress(case_id, evidence_step)
    failed = False
    try:
        yield progress
    except Exception:
        failed = True
        try:
            progress.observed("ODSTOPANJE: " + _visible_state(page))
        except Exception as evidence_error:
            warnings.warn(f"Could not capture pre-cleanup evidence: {evidence_error}")
        raise
    finally:
        try:
            if not page.is_closed():
                cleanup()
        except Exception as cleanup_error:
            if not failed:
                raise
            warnings.warn(f"UI cleanup failed; isolated fixture cleanup still runs: {cleanup_error}")


def _sidebar(page, expanded):
    toggle = page.locator("#app-sidebar .sidebar-toggle")
    expect(toggle).to_be_visible()
    desired = "true" if expanded else "false"
    if toggle.get_attribute("aria-expanded") != desired:
        toggle.click()
    expect(toggle).to_have_attribute("aria-expanded", desired)


def _assert_logged_in(page, username):
    _sidebar(page, True)
    account = page.get_by_role("region", name="Uporabniški račun", exact=True)
    expect(account.get_by_text(username, exact=True)).to_be_visible()
    expect(account.get_by_text("Prijavljen", exact=True)).to_be_visible()
    expect(account.get_by_role("button", name="Odjava", exact=True)).to_be_visible()


def _assert_guest(page, absent_username=None):
    _sidebar(page, True)
    account = page.get_by_role("region", name="Uporabniški račun", exact=True)
    expect(account.get_by_text("Gost", exact=True)).to_be_visible()
    expect(account.get_by_text("Prijava ali registracija", exact=True)).to_be_visible()
    expect(account.get_by_text("Prijavljen", exact=True)).to_have_count(0)
    if absent_username:
        expect(account.get_by_text(absent_username, exact=True)).to_have_count(0)


def _register(page, base_url, username, password):
    page.goto(base_url + "/register")
    page.get_by_label("Uporabniško ime", exact=True).fill(username)
    page.get_by_label("Geslo", exact=True).fill(password)
    page.get_by_role("button", name="Registracija", exact=True).click()
    expect(page).to_have_url(base_url + "/")
    _assert_logged_in(page, username)


def _logout_if_logged_in(page):
    if page.locator("#app-sidebar").count():
        _sidebar(page, True)
        logout = page.get_by_role("button", name="Odjava", exact=True)
        if logout.count():
            logout.click()
            _assert_guest(page)


def _open_sequence(page, base_url, guest, reload=False):
    # The initial asynchronous list request must finish before asserting a later
    # status message, otherwise it can overwrite that message after the action.
    with page.expect_response(
        lambda response: response.request.method == "GET"
        and response.url == base_url + "/api/sequences"
    ) as response_info:
        if reload:
            page.reload()
        else:
            page.goto(base_url + "/sequence-test")
    response = response_info.value
    response.body()  # Wait for the response body without leaving a page-close waiter.
    assert response.status == (401 if guest else 200)
    expect(page.get_by_role("heading", name="Sequencer", exact=True)).to_be_visible()
    expect(page.locator("#grid .beat").first).to_be_visible()
    if guest:
        expect(page.locator("#status")).to_have_text(GUEST_MESSAGE)
    else:
        # Rendering the list options is checked by the individual save/load steps.
        expect(page.get_by_role("combobox", name="Shranjene sekvence", exact=True)).to_be_visible()


def _assert_settings(page, tuning="C-F-B", signature="4/4", bpm="120"):
    expect(page.get_by_role("combobox", name="Uglasitev", exact=True)).to_have_value(tuning)
    expect(page.get_by_role("combobox", name="Takt", exact=True)).to_have_value(signature)
    expect(page.get_by_role("spinbutton", name="BPM", exact=True)).to_have_value(bpm)


def _assert_notes(page, notes):
    """Each tuple is (zero-based grid start, chord, keyboard label, length)."""
    expect(page.locator("#grid button.note")).to_have_count(len(notes))
    for start, chord, key, length in notes:
        note = page.locator(f'#grid button.note[data-note-start="{start}"]')
        expect(note).to_be_visible()
        expect(note).to_have_attribute("data-step", str(start))
        expect(note.locator("strong")).to_have_text(chord)
        expect(note.locator("small")).to_have_text(f"{key} · {length}")
        # Assert the actual UI attribute, while test prose calls positions steps.
        expect(note).to_have_attribute("aria-label", f"Nota od {start + 1} dolga {length} dob")


def _add_note(page, start, name):
    page.locator(f'#grid .beat[data-step="{start}"]').click()
    dialog = page.get_by_role("dialog", name="Izbor tona", exact=True)
    expect(dialog).to_be_visible()
    dialog.get_by_role("button", name=name, exact=True).click()
    expect(dialog).to_be_hidden()
    expect(page.locator("#status")).to_have_text("Ton posodobljen.")


def _sequence_snapshot(page):
    return {
        "tuning": page.get_by_role("combobox", name="Uglasitev", exact=True).input_value(),
        "signature": page.get_by_role("combobox", name="Takt", exact=True).input_value(),
        "bpm": page.get_by_role("spinbutton", name="BPM", exact=True).input_value(),
        "name": page.get_by_placeholder("Ime sekvence", exact=True).input_value(),
        "notes": [
            (note.get_attribute("data-note-start"), note.inner_text(), note.get_attribute("aria-label"))
            for note in page.locator("#grid button.note").all()
        ],
    }


def _choose_import(page, path):
    with page.expect_file_chooser() as chooser:
        page.get_by_text("Uvozi .acm", exact=True).click()
    chooser.value.set_files(str(path))


def _reset_guest_sequence(page, base_url, fixture):
    try:
        if page.url == base_url + "/sequence-test":
            _open_sequence(page, base_url, guest=True, reload=True)
            _assert_settings(page)
            _assert_notes(page, [])
    finally:
        # Only the disposable per-test copy is removed; tracked fixtures remain.
        fixture.unlink(missing_ok=True)


def _cleanup_saved_sequence(page):
    if page.locator("#saved-sequences").count():
        saved = page.get_by_role("combobox", name="Shranjene sekvence", exact=True)
        option = saved.locator("option", has_text=re.compile(r"^TC04_Obnova$"))
        if option.count():
            _sidebar(page, False)
            saved.select_option(label="TC04_Obnova")
            page.get_by_role("button", name="Izbriši", exact=True).click()
            expect(page.locator("#status")).to_have_text("Sekvenca je izbrisana.")
            expect(option).to_have_count(0)
    _logout_if_logged_in(page)


def _chord_text(role, chord, key):
    return re.compile(r"^\s*" + re.escape(role) + r"\s+" + re.escape(chord) + r"\s+" + key + r"\s*$")


@pytest.mark.tc_id("TC-01")
def test_tc01_registration_minimum_lengths(page: Page, base_url, evidence_step):
    """TC-01: username length 3, password length 8, automatic sign-in."""
    with _case(page, "TC-01", evidence_step, lambda: _logout_if_logged_in(page)) as result:
        result.step(1)
        page.goto(base_url + "/register")
        expect(page.get_by_role("heading", name="Registracija", exact=True)).to_be_visible()
        expect(page.get_by_label("Uporabniško ime", exact=True)).to_be_visible()
        expect(page.get_by_label("Geslo", exact=True)).to_be_visible()
        expect(page.get_by_role("button", name="Registracija", exact=True)).to_be_visible()
        result.observed("Prikazan obrazec Registracija z obema poljema in gumbom.")

        result.step(2)
        username = page.get_by_label("Uporabniško ime", exact=True)
        password = page.get_by_label("Geslo", exact=True)
        username.fill("q01")
        password.fill("Test!234")
        expect(username).to_have_value("q01")
        expect(password).to_have_value("Test!234")
        expect(password).to_have_attribute("type", "password")
        result.observed("Vnesena q01 (3 znaki) in Test!234 (8 znakov); geslo je zakrito.")

        result.step(3)
        page.get_by_role("button", name="Registracija", exact=True).click()
        expect(page).to_have_url(base_url + "/")
        _assert_logged_in(page, "q01")
        expect(page.locator(".auth-error")).to_have_count(0)
        result.observed("Prehod na /; q01, Prijavljen, Odjava; brez zavrnitve registracije.")


@pytest.mark.tc_id("TC-02")
def test_tc02_wrong_password(page: Page, base_url, evidence_step):
    """TC-02: separate UI-created account, logout, invalid password rejected."""
    with _case(page, "TC-02", evidence_step, lambda: _logout_if_logged_in(page)) as result:
        # Independent precondition; never reuse q01 or the outcome of TC-01.
        _register(page, base_url, "qa_login_tc02", "QaLogin!2026")
        page.get_by_role("button", name="Odjava", exact=True).click()
        _assert_guest(page, "qa_login_tc02")

        result.step(1)
        page.goto(base_url + "/login")
        expect(page.get_by_role("heading", name="Prijava", exact=True)).to_be_visible()
        expect(page.get_by_label("Uporabniško ime", exact=True)).to_be_visible()
        expect(page.get_by_label("Geslo", exact=True)).to_be_visible()
        expect(page.get_by_role("button", name="Prijava", exact=True)).to_be_visible()
        result.observed("Prikazan obrazec Prijava z obema poljema in gumbom.")

        result.step(2)
        page.get_by_label("Uporabniško ime", exact=True).fill("qa_login_tc02")
        page.get_by_label("Geslo", exact=True).fill("Napacno!2026")
        page.get_by_role("button", name="Prijava", exact=True).click()
        expect(page).to_have_url(base_url + "/login")
        expect(page.locator(".auth-error")).to_have_text("Napačno uporabniško ime ali geslo.")
        result.observed("Ostal /login; Napačno uporabniško ime ali geslo.")

        result.step(3)
        page.goto(base_url + "/")
        _assert_guest(page, "qa_login_tc02")
        result.observed("Gost in Prijava ali registracija; qa_login_tc02 in Prijavljen nista prikazana.")


@pytest.mark.tc_id("TC-03")
def test_tc03_all_chords_for_adg(page: Page, base_url, evidence_step):
    """TC-03: exact labels, ordering, roles, and all eighteen A-D-G chords."""
    def cleanup():
        if page.url == base_url + "/chords":
            page.get_by_role("combobox", name="Uglasitev", exact=True).select_option(label="C-F-B")
            expect(page.get_by_role("combobox", name="Uglasitev", exact=True)).to_have_value("C-F-B")

    with _case(page, "TC-03", evidence_step, cleanup) as result:
        result.step(1)
        page.goto(base_url + "/chords")
        _sidebar(page, False)
        tuning = page.get_by_role("combobox", name="Uglasitev", exact=True)
        expect(tuning).to_have_value("C-F-B")
        expect(page.locator(".row-label")).to_have_text(["C", "F", "B"])
        first = page.locator(".row").nth(0)
        expect(first.locator(".btn-major")).to_have_text([
            _chord_text("Tonic", "C", "Q"), _chord_text("Dom", "G", "W"), _chord_text("Sub", "F", "E")
        ])
        expect(first.locator(".btn-minor")).to_have_text([
            _chord_text("m-Tonic", "Am", "R"), _chord_text("m-Dom", "Em", "T"), _chord_text("m-Sub", "Dm", "Z")
        ])
        result.observed("C-F-B; vrste C/F/B; prva vrsta C/G/F in Am/Em/Dm.")

        result.step(2)
        tuning.select_option(label="A-D-G")
        expect(tuning).to_have_value("A-D-G")
        expect(page.locator(".row-label")).to_have_text(["A", "D", "G"])
        result.observed("Izbrana A-D-G; oznake vrst A/D/G.")

        result.step(3)
        for index, (chords, keys) in enumerate([
            (("A", "E", "D"), ("Q", "W", "E")),
            (("D", "A", "G"), ("A", "S", "D")),
            (("G", "D", "C"), ("Y", "X", "C")),
        ]):
            expect(page.locator(".row").nth(index).locator(".btn-major")).to_have_text([
                _chord_text(role, chord, key) for role, chord, key in zip(("Tonic", "Dom", "Sub"), chords, keys)
            ])
        result.observed("Dur A/E/D, D/A/G, G/D/C; vse vloge Tonic/Dom/Sub ustrezajo.")

        result.step(4)
        for index, (chords, keys) in enumerate([
            (("F#m", "C#m", "Hm"), ("R", "T", "Z")),
            (("Hm", "F#m", "Em"), ("F", "G", "H")),
            (("Em", "Hm", "Am"), ("V", "B", "N")),
        ]):
            expect(page.locator(".row").nth(index).locator(".btn-minor")).to_have_text([
                _chord_text(role, chord, key) for role, chord, key in zip(("m-Tonic", "m-Dom", "m-Sub"), chords, keys)
            ])
        expect(page.locator(".row button").filter(has_text="?")).to_have_count(0)
        result.observed("Mol F#m/C#m/Hm, Hm/F#m/Em, Em/Hm/Am; m-Tonic/m-Dom/m-Sub; brez ?.")


@pytest.mark.tc_id("TC-04")
def test_tc04_save_refresh_and_load(page: Page, base_url, evidence_step):
    """TC-04: persistence must restore the entire sequence after an empty reload."""
    with _case(page, "TC-04", evidence_step, lambda: _cleanup_saved_sequence(page)) as result:
        _register(page, base_url, "qa_save_tc04", "QaSave!2026")

        result.step(1)
        _open_sequence(page, base_url, guest=False)
        _assert_logged_in(page, "qa_save_tc04")
        _sidebar(page, False)
        _assert_settings(page)
        _assert_notes(page, [])
        saved = page.get_by_role("combobox", name="Shranjene sekvence", exact=True)
        expect(saved.locator("option", has_text=re.compile(r"^TC04_Obnova$"))).to_have_count(0)
        result.observed("Prazna mreža; C-F-B, 4/4, 120; qa_save_tc04; sekvence TC04_Obnova še ni.")

        result.step(2)
        name = page.get_by_placeholder("Ime sekvence", exact=True)
        name.fill("TC04_Obnova")  # Must precede notes because of global keyboard handlers.
        page.get_by_role("combobox", name="Uglasitev", exact=True).select_option(label="A-D-G")
        page.get_by_role("combobox", name="Takt", exact=True).select_option(label="3/4")
        bpm = page.get_by_role("spinbutton", name="BPM", exact=True)
        bpm.press("ControlOrMeta+A")
        bpm.press_sequentially("90")
        bpm.press("Tab")
        expect(name).to_have_value("TC04_Obnova")
        _assert_settings(page, "A-D-G", "3/4", "90")
        _assert_notes(page, [])
        result.observed("Ime TC04_Obnova; A-D-G, 3/4, BPM 90; mreža še prazna.")

        result.step(3)
        _add_note(page, 0, "A Q")
        _add_note(page, 1, "E W")
        _assert_notes(page, [(0, "A", "Q", 1), (1, "E", "W", 1)])
        _assert_settings(page, "A-D-G", "3/4", "90")
        result.observed("Samo A(Q) na prvem in E(W) na drugem polju, dolžini 1; Ton posodobljen.")

        result.step(4)
        page.get_by_role("button", name="Shrani", exact=True).click()
        expect(page.locator("#status")).to_have_text("Sekvenca je shranjena.")
        expect(saved.locator("option:checked")).to_have_text("TC04_Obnova")
        result.observed("Sekvenca je shranjena.; na seznamu je izbrana TC04_Obnova.")

        result.step(5)
        _open_sequence(page, base_url, guest=False, reload=True)
        _assert_notes(page, [])
        _assert_settings(page)
        expect(saved.locator("option", has_text=re.compile(r"^TC04_Obnova$"))).to_have_count(1)
        result.observed("Po osvežitvi prazna mreža in C-F-B, 4/4, 120; TC04_Obnova ostane na seznamu.")

        result.step(6)
        saved.select_option(label="TC04_Obnova")
        page.get_by_role("button", name="Naloži", exact=True).click()
        expect(page.locator("#status")).to_have_text("Sekvenca je naložena.")
        expect(name).to_have_value("TC04_Obnova")
        _assert_settings(page, "A-D-G", "3/4", "90")
        _assert_notes(page, [(0, "A", "Q", 1), (1, "E", "W", 1)])
        result.observed("Sekvenca je naložena.; TC04_Obnova, A-D-G, 3/4, 90 in oba tona so obnovljeni.")


@pytest.mark.tc_id("TC-05")
def test_tc05_invalid_import_preserves_sequence(page: Page, base_url, tmp_path, evidence_step):
    """TC-05: BPM 29 rejected without changing the existing C note or settings."""
    fixture = tmp_path / "TC05_bpm29.acm"
    shutil.copyfile(FIXTURES / fixture.name, fixture)
    with _case(page, "TC-05", evidence_step, lambda: _reset_guest_sequence(page, base_url, fixture)) as result:
        result.step(1)
        _open_sequence(page, base_url, guest=True)
        _sidebar(page, False)
        _assert_settings(page)
        _assert_notes(page, [])
        result.observed("Prazna mreža; C-F-B, 4/4, BPM 120.")

        result.step(2)
        _add_note(page, 0, "C Q")
        _assert_notes(page, [(0, "C", "Q", 1)])
        _assert_settings(page)
        before = _sequence_snapshot(page)
        result.observed("Samo C(Q) na prvem polju, dolžina 1; C-F-B, 4/4, 120; stanje zabeleženo.")

        result.step(3)
        _choose_import(page, fixture)
        expect(page.locator("#status")).to_have_text("BPM mora biti celo število med 30 in 300.")
        expect(page.get_by_text(UPLOAD_SUCCESS, exact=True)).to_have_count(0)
        result.observed("BPM mora biti celo število med 30 in 300.; uspešen uvoz ni prikazan.")

        result.step(4)
        _assert_notes(page, [(0, "C", "Q", 1)])
        _assert_settings(page)
        assert _sequence_snapshot(page) == before
        result.observed("Predhodno stanje ohranjeno: samo C(Q), prvo polje, dolžina 1; C-F-B, 4/4, 120.")


@pytest.mark.tc_id("TC-06")
def test_tc06_valid_import_at_minimum_bpm(page: Page, base_url, tmp_path, evidence_step):
    """TC-06: independent valid fixture at BPM 30 imports all expected data."""
    fixture = tmp_path / "TC06_veljavna.acm"
    shutil.copyfile(FIXTURES / fixture.name, fixture)
    with _case(page, "TC-06", evidence_step, lambda: _reset_guest_sequence(page, base_url, fixture)) as result:
        result.step(1)
        _open_sequence(page, base_url, guest=True)
        _sidebar(page, False)
        _assert_notes(page, [])
        _assert_settings(page)
        expect(page.locator("#status")).to_have_text(GUEST_MESSAGE)
        result.observed("Prazna mreža; C-F-B, 4/4, 120; Za shranjevanje sekvenc se prijavi.")

        result.step(2)
        _choose_import(page, fixture)
        expect(page.locator("#status")).to_have_text(UPLOAD_SUCCESS)
        result.observed(UPLOAD_SUCCESS)

        result.step(3)
        _assert_settings(page, "A-D-G", "3/4", "30")
        result.observed("Uglasitev A-D-G, Takt 3/4, BPM 30.")

        result.step(4)
        _assert_notes(page, [(0, "A", "Q", 1), (1, "E", "W", 1)])
        result.observed("Samo A(Q) na prvem in E(W) na drugem polju; dolžini 1; ostala polja prazna.")
