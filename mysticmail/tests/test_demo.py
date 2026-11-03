"""Standalone smoke test for the synthetic MysticMail demo."""
import pathlib
import subprocess
import sys
import unittest

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "mystic" / "mysticmail.mpy"

class DemoTest(unittest.TestCase):
    def test_quit(self):
        proc = subprocess.run([sys.executable, str(SCRIPT)], input="D\nQ\n", text=True, capture_output=True, timeout=10)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("Python:", proc.stdout)
        self.assertIn("Returning to Mystic.", proc.stdout)

    def test_sample_inbox(self):
        proc = subprocess.run([sys.executable, str(SCRIPT)], input="1\n1\n\nQ\n", text=True, capture_output=True, timeout=10)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("SAMPLE INBOX", proc.stdout)
        self.assertIn("Night Owl", proc.stdout)

if __name__ == "__main__":
    unittest.main()
