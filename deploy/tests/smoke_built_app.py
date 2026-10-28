#!/usr/bin/env python3
"""Exercise the built app on temporary loopback ports; no production changes."""
import html
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[2]

def request(port, route, host=None):
    headers = {"Host": host} if host else {}
    with urllib.request.urlopen(
        urllib.request.Request(f"http://127.0.0.1:{port}{route}", headers=headers), timeout=3
    ) as response:
        return response.headers, response.read().decode()

def run_revision(revision, check_pages):
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    with tempfile.TemporaryFile(mode="w+") as log:
        process = subprocess.Popen(
            ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", str(port)],
            cwd=ROOT, env=dict(os.environ, MYSTICWEB_REVISION=revision),
            stdout=log, stderr=subprocess.STDOUT,
        )
        try:
            for _ in range(40):
                if process.poll() is not None:
                    raise RuntimeError("Preview process stopped before becoming healthy")
                try:
                    headers, body = request(port, "/api/health")
                    if json.loads(body) == {"status": "ok", "revision": revision}:
                        assert "no-store" in headers.get("Cache-Control", "")
                        break
                except OSError:
                    pass
                time.sleep(0.5)
            else:
                raise RuntimeError("Runtime health did not report the expected revision")
            if check_pages:
                for host in ["davesbbs.com", "www.davesbbs.com"]:
                    _, body = request(port, "/", host)
                    assert "Dave's BBS" in html.unescape(body)
                    assert 'href="telnet://davesbbs.com"' in body
                    assert 'href="/login"' in body
                    assert 'href="/connect"' in body
                _, guide = request(port, "/connect")
                assert "Connection help" in guide and "Copy BBS address" in guide
                assert 'href="telnet://davesbbs.com"' in guide
                assert "<form" not in guide and "<input" not in guide
                assert "does not report live BBS availability" in guide
                _, login = request(port, "/login")
                assert "COMING SOON" in login
                assert "<input" not in login and "<form" not in login
                assert 'href="/connect"' in login
                _, dashboard = request(port, "/dashboard")
                assert "DISCONNECTED" in dashboard
                assert 'href="/dashboard"' in dashboard
            print(f"Built-app smoke passed for runtime revision {revision}.")
        except BaseException:
            log.seek(0)
            print(log.read(), file=sys.stderr)
            raise
        finally:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()

if __name__ == "__main__":
    if not (ROOT / ".next/BUILD_ID").is_file():
        raise SystemExit("Run npm run build first.")
    # Same build, different runtime values: revision must never be baked into output.
    run_revision("a" * 40, check_pages=True)
    run_revision("b" * 40, check_pages=False)
