"""Deployment behavior tests; no root, GitHub connection, or production service."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer

DEPLOY = Path(__file__).resolve().parents[1]

def load_module(name):
    spec = importlib.util.spec_from_file_location(name, DEPLOY / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

selector = load_module("select_release")
healthcheck = load_module("healthcheck")
OLD, NEW = "a" * 40, "b" * 40

class SelectionTests(unittest.TestCase):
    def choose(self, runs, sha=NEW):
        def fetch(url):
            return {"workflow_runs": runs} if "/runs?" in url else {"sha": sha}
        return selector.choose_sha(fetch, "javadude334/MysticWeb", "main", "frontend.yml")

    def run_data(self, **changes):
        return dict({
            "id": 1, "head_sha": NEW, "head_branch": "main", "event": "push",
            "head_repository": {"full_name": "javadude334/MysticWeb"},
            "status": "completed", "conclusion": "success",
        }, **changes)

    def test_exact_main_push_success(self):
        self.assertEqual(self.choose([self.run_data()]), NEW)

    def test_no_run_or_pending_or_failure_stays_on_current_release(self):
        for runs in [[], [self.run_data(status="in_progress")], [self.run_data(conclusion="failure")]]:
            with self.subTest(runs=runs):
                self.assertIsNone(self.choose(runs))

    def test_pr_other_repository_branch_and_commit_do_not_authorize_deploy(self):
        for changes in [
            {"event": "pull_request"}, {"head_branch": "feature/test"},
            {"head_sha": OLD}, {"head_repository": {"full_name": "fork/MysticWeb"}},
        ]:
            with self.subTest(changes=changes):
                self.assertIsNone(self.choose([self.run_data(**changes)]))

    def test_newest_run_failure_does_not_fall_back_to_an_older_success(self):
        self.assertIsNone(self.choose([self.run_data(), self.run_data(id=2, conclusion="failure")]))

    def test_invalid_sha_is_rejected(self):
        with self.assertRaises(ValueError):
            self.choose([], sha="../bad")

class HealthTests(unittest.TestCase):
    def test_http_status_payload_and_revision_are_all_required(self):
        class Handler(BaseHTTPRequestHandler):
            response_status = 200
            payload = {"status": "ok", "revision": NEW}
            def do_GET(self):
                self.send_response(self.response_status)
                self.end_headers()
                self.wfile.write(json.dumps(self.payload).encode())
            def log_message(self, *args):
                pass
        server = HTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            url = f"http://127.0.0.1:{server.server_port}/api/health"
            self.assertTrue(healthcheck.healthy(url, NEW))
            self.assertFalse(healthcheck.healthy(url, OLD))
            Handler.payload = {"status": "error", "revision": NEW}
            self.assertFalse(healthcheck.healthy(url, NEW))
            Handler.payload = {"status": "ok", "revision": NEW}
            Handler.response_status = 503
            self.assertFalse(healthcheck.healthy(url, NEW))
        finally:
            server.shutdown()
            server.server_close()
            thread.join()
        self.assertFalse(healthcheck.healthy(url, NEW))

class ActivationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.releases = self.root / "releases"
        self.releases.mkdir()
        self.scripts = self.root / "scripts"
        self.scripts.mkdir()
        shutil.copy(DEPLOY / "deploy.sh", self.scripts)
        self.bin = self.root / "bin"
        self.bin.mkdir()
        (self.scripts / "select_release.py").write_text("import os; print(os.environ.get('TEST_SHA', ''))\n")
        (self.scripts / "healthcheck.py").write_text(
            "import os, sys\n"
            "sys.exit(1 if sys.argv[2] == os.environ.get('TEST_BAD_HEALTH') else 0)\n"
        )
        self.executable("git", """#!/usr/bin/env bash
set -eu
dir="$2"; shift 2
if [[ "$1" = rev-parse ]]; then printf '%s\\n' "$TEST_SHA"; fi
""")
        self.executable("npm", """#!/usr/bin/env bash
set -eu
printf '%s\\n' "$*" >> "$DEPLOY_ROOT/npm.log"
if [[ "${TEST_BUILD_FAIL:-}" = 1 && "$*" = "run build" ]]; then exit 1; fi
if [[ "$*" = "run build" ]]; then mkdir -p .next; echo build > .next/BUILD_ID; fi
""")
        self.executable("sudo", """#!/usr/bin/env bash
set -eu
printf '%s\\n' "$*" >> "$DEPLOY_ROOT/systemctl.log"
[[ "$1" = -n && "$2" = /usr/bin/systemctl && "$4" = mysticweb.service ]]
[[ "$3" = restart || "$3" = stop ]]
if [[ "${TEST_RESTART_FAIL:-}" = 1 && "$3" = restart && "$(readlink "$DEPLOY_ROOT/current")" = "releases/$TEST_SHA" ]]; then exit 1; fi
""")
        self.env = dict(os.environ, DEPLOY_ROOT=str(self.root), TEST_SHA=NEW)
        self.env["PATH"] = str(self.bin) + os.pathsep + os.environ["PATH"]

    def tearDown(self):
        self.temp.cleanup()

    def executable(self, name, content):
        path = self.bin / name
        path.write_text(content)
        path.chmod(0o755)

    def old_release(self):
        (self.releases / OLD).mkdir()
        (self.root / "current").symlink_to("releases/" + OLD)

    def run_deploy(self, **changes):
        return subprocess.run(
            ["bash", str(self.scripts / "deploy.sh")],
            env=dict(self.env, **changes), capture_output=True, text=True, timeout=15,
        )

    def test_healthy_activation_replaces_pointer_and_restarts_only_named_service(self):
        self.old_release()
        result = self.run_deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(os.readlink(self.root / "current"), "releases/" + NEW)
        self.assertEqual((self.releases / NEW / ".release-sha").read_text().strip(), NEW)
        self.assertIn("restart mysticweb.service", (self.root / "systemctl.log").read_text())

    def test_failed_build_preserves_running_release_and_does_not_restart(self):
        self.old_release()
        result = self.run_deploy(TEST_BUILD_FAIL="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(os.readlink(self.root / "current"), "releases/" + OLD)
        self.assertFalse((self.root / "systemctl.log").exists())
        self.assertEqual(list(self.releases.glob(".build-*")), [])

    def test_unhealthy_activation_rolls_back_and_restarts_previous_release(self):
        self.old_release()
        result = self.run_deploy(TEST_BAD_HEALTH=NEW)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(os.readlink(self.root / "current"), "releases/" + OLD)
        self.assertEqual((self.root / "systemctl.log").read_text().count("restart"), 2)

    def test_failed_restart_restores_previous_release(self):
        self.old_release()
        result = self.run_deploy(TEST_RESTART_FAIL="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(os.readlink(self.root / "current"), "releases/" + OLD)
        self.assertEqual((self.root / "systemctl.log").read_text().count("restart"), 2)

    def test_failed_first_activation_stops_service_and_removes_pointer(self):
        result = self.run_deploy(TEST_BAD_HEALTH=NEW)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.root / "current").exists())
        self.assertIn("stop mysticweb.service", (self.root / "systemctl.log").read_text())

    def test_pending_ci_does_not_build_or_restart(self):
        self.old_release()
        result = self.run_deploy(TEST_SHA="")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(os.readlink(self.root / "current"), "releases/" + OLD)
        self.assertFalse((self.root / "npm.log").exists())

    def test_same_healthy_revision_does_not_rebuild(self):
        self.old_release()
        result = self.run_deploy(TEST_SHA=OLD)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse((self.root / "npm.log").exists())
        self.assertFalse((self.root / "systemctl.log").exists())

    def test_same_unhealthy_revision_attempts_restart_and_reports_failure(self):
        self.old_release()
        result = self.run_deploy(TEST_SHA=OLD, TEST_BAD_HEALTH=OLD)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("restart", (self.root / "systemctl.log").read_text())

    def test_unexpected_current_path_is_preserved(self):
        (self.root / "current").mkdir()
        result = self.run_deploy()
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue((self.root / "current").is_dir())

    def test_existing_failed_release_requires_manual_review(self):
        self.old_release()
        (self.releases / NEW).mkdir()
        result = self.run_deploy()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(os.readlink(self.root / "current"), "releases/" + OLD)

    def test_concurrent_deployment_skips_without_changes(self):
        import fcntl
        with (self.root / "deploy.lock").open("w") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            result = self.run_deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse((self.root / "npm.log").exists())

if __name__ == "__main__":
    unittest.main()
