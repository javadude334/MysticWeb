"""Parse templates using installed Ubuntu tools without touching active config."""
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import unittest

DEPLOY = Path(__file__).resolve().parents[1]

class TemplateTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which("nginx"), "nginx is not installed on this test host")
    def test_nginx_template_parses_without_active_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            site = root / "site.conf"
            content = (DEPLOY / "nginx.conf").read_text().replace("__DOMAIN__", "davesbbs.com")
            self.assertIn("server_name davesbbs.com www.davesbbs.com;", content)
            self.assertIn("listen 80;", content)
            self.assertIn("listen [::]:80;", content)
            with socket.socket() as listener:
                listener.bind(("127.0.0.1", 0))
                port = listener.getsockname()[1]
            content = content.replace("listen 80;", f"listen 127.0.0.1:{port};")
            content = content.replace("listen [::]:80;", f"listen [::1]:{port};")
            site.write_text(content)
            config = root / "nginx.conf"
            config.write_text(
                f"pid {root}/nginx.pid;\nerror_log stderr;\nevents {{}}\n"
                f"http {{ access_log off; include {site}; }}\n"
            )
            result = subprocess.run(
                ["nginx", "-t", "-e", "stderr", "-c", str(config), "-p", str(root)],
                capture_output=True, text=True, timeout=15,
            )
            self.assertEqual(result.returncode, 0, result.stderr)

    @unittest.skipUnless(shutil.which("systemd-analyze"), "systemd-analyze is not installed")
    def test_units_parse_with_test_executables_and_environment(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            environment = root / "deploy.env"
            environment.write_text("REPOSITORY=javadude334/MysticWeb\n")
            for name in ["mysticweb.service", "mysticweb-deploy.service", "mysticweb-deploy.timer"]:
                content = (DEPLOY / name).read_text()
                content = content.replace("/usr/local/lib/mysticweb/start.sh", "/usr/bin/true")
                content = content.replace("/usr/local/lib/mysticweb/deploy.sh", "/usr/bin/true")
                content = content.replace("/etc/mysticweb/deploy.env", str(environment))
                content = content.replace("/srv/mysticweb", str(root))
                (root / name).write_text(content)
            result = subprocess.run(
                ["systemd-analyze", "verify", "--man=no", *[str(path) for path in root.glob("*.service")], str(root / "mysticweb-deploy.timer")],
                capture_output=True, text=True, timeout=20,
            )
            self.assertEqual(result.returncode, 0, result.stderr)

if __name__ == "__main__":
    unittest.main()

