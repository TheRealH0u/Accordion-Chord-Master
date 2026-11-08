"""Real-browser test infrastructure; the application and its API are not mocked."""
from datetime import datetime, timezone
import base64
from importlib import metadata, util
import json
import os
from pathlib import Path
import platform
import sys
import threading
import uuid
from zoneinfo import ZoneInfo

import pytest
import pytest_html
from playwright.sync_api import expect
from werkzeug.serving import make_server

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / 'artifacts' / 'functional'
RESULTS = {}
STARTED = None


def now():
    return datetime.now(timezone.utc).astimezone(ZoneInfo('Europe/Ljubljana')).isoformat(timespec='seconds')


def case_id(node):
    mark = node.get_closest_marker('tc_id')
    return str(mark.args[0]) if mark else node.name


def record(node):
    return RESULTS.setdefault(node.nodeid, {'id': case_id(node), 'nodeid': node.nodeid,
        'steps': [], 'phases': {}, 'started_at': now(), 'cleanup': {}})


def pytest_sessionstart(session):
    global STARTED
    STARTED = now()
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    expect.set_options(timeout=10000)


@pytest.fixture(scope='session')
def browser_context_args():
    return {'viewport': {'width': 1440, 'height': 1000},
            'locale': 'sl-SI', 'service_workers': 'block'}


@pytest.fixture
def base_url(tmp_path, monkeypatch, request):
    """Fresh module, SQLite, secret, server and OS-assigned port for every case."""
    db_path = tmp_path / 'functional.sqlite'
    monkeypatch.setenv('DATABASE_URL', 'sqlite:///' + db_path.as_posix())
    monkeypatch.setenv('SECRET_KEY', 'disposable-test-' + uuid.uuid4().hex)
    module_name = 'acm_e2e_' + uuid.uuid4().hex
    spec = util.spec_from_file_location(module_name, ROOT / 'app.py')
    module = util.module_from_spec(spec)
    sys.modules[module_name] = module
    server = thread = None
    details = record(request.node)
    try:
        spec.loader.exec_module(module)
        module.app.config.update(TESTING=True)
        server = make_server('127.0.0.1', 0, module.app, threaded=True)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        url = f'http://127.0.0.1:{server.server_port}'
        details.update(url=url, database=str(db_path), database_url_set_before_import=True)
        yield url
    finally:
        if server:
            server.shutdown()
            server.server_close()
        if thread:
            thread.join(timeout=10)
        if hasattr(module, 'db'):
            with module.app.app_context():
                module.db.session.remove()
                module.db.drop_all()
                module.db.engine.dispose()
        if db_path.exists():
            db_path.unlink()
        sys.modules.pop(module_name, None)
        details['cleanup'].update(server_stopped=not bool(thread and thread.is_alive()),
                                  test_database_removed=not db_path.exists())


@pytest.fixture
def evidence_step(page, request):
    """Capture a real observed milestone, including deviations before UI cleanup."""
    out = ARTIFACTS / 'evidence'
    out.mkdir(parents=True, exist_ok=True)
    details = record(request.node)
    details['browser_version'] = page.context.browser.version
    page.set_default_timeout(10000)
    page.set_default_navigation_timeout(30000)

    def save(tc_id, step, observation):
        assert tc_id == case_id(request.node), 'Wrong traceability ID'
        filename = f'{tc_id}-step-{step:02d}.png'
        page.screenshot(path=str(out / filename), full_page=True)
        details['steps'].append({'step': step, 'observed': observation,
            'time': now(), 'screenshot': 'evidence/' + filename})
    return save


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    details = record(item)
    details['phases'][report.when] = {'outcome': report.outcome, 'duration': report.duration}
    if report.failed:
        details['failure'] = str(report.longrepr)
        details['failed_phase'] = report.when
    if report.when == 'call':
        details['status'] = report.outcome
        details['finished_at'] = now()
        if details['steps']:
            last_image = ARTIFACTS / details['steps'][-1]['screenshot']
            encoded = base64.b64encode(last_image.read_bytes()).decode('ascii')
            report.extras = [*getattr(report, 'extras', []),
                pytest_html.extras.image(encoded, mime_type='image/png', extension='png')]
    if report.when in ('setup', 'teardown') and report.failed:
        details['status'] = 'error'


def pytest_html_report_title(report):
    report.title = 'Accordion Chord Master – avtomatizirani funkcionalni testi'


def pytest_sessionfinish(session, exitstatus):
    versions = {}
    for package in ['Flask', 'Flask-SQLAlchemy', 'SQLAlchemy', 'Werkzeug', 'pytest',
                    'pytest-playwright', 'playwright', 'pytest-html', 'tzdata']:
        versions[package] = metadata.version(package)
    is_github = os.environ.get('GITHUB_ACTIONS') == 'true'
    payload = {'started_at': STARTED, 'finished_at': now(), 'timezone': 'Europe/Ljubljana',
        'exit_code': int(exitstatus), 'python': sys.version, 'os': platform.platform(),
        'versions': versions, 'cases': list(RESULTS.values()),
        'execution': 'GitHub Actions' if is_github else 'Local pytest + Playwright Chromium',
        'github_run_url': (f"{os.environ.get('GITHUB_SERVER_URL', 'https://github.com')}/"
                           f"{os.environ.get('GITHUB_REPOSITORY', '')}/actions/runs/"
                           f"{os.environ.get('GITHUB_RUN_ID', '')}") if is_github else None}
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    (ARTIFACTS / 'execution.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
