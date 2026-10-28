import contextlib
import io
import json
import os
from pathlib import Path
import struct
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from a48_status_probe import summarize, compare, read_report, main, MAX_BYTES
from bridge_core import active


def record(uid, flags=0):
    secret = b'SECRET_PASSWORD_RECORD'
    return struct.pack('<II', uid, flags) + secret + bytes(1536 - 8 - len(secret))


class StatusProbeTests(unittest.TestCase):
    def test_masks_and_no_secret_output(self):
        report = summarize(record(73, 0x405) + record(42) + record(0))
        self.assertEqual([r['userId'] for r in report['accounts']], [42, 73])
        row = report['accounts'][1]
        self.assertTrue(all(row[k] is True for k in ('lockedOut', 'deleted', 'forcePasswordChange')))
        self.assertNotIn('SECRET', json.dumps(report))
        self.assertFalse(report['certified'])
        self.assertFalse(active(report['accounts'][0]))

    def test_invalid_layout_and_identity(self):
        for raw in (b'', b'x', record(1)[:-1], record(1) * 2,
                    record(0x80000000), bytes(MAX_BYTES + 1)):
            with self.assertRaises(ValueError):
                summarize(raw)

    def test_each_mask_is_independent(self):
        for flags, expected in [(1, (True, False, False)), (4, (False, True, False)),
                                (1024, (False, False, True)), (32, (False, False, False)),
                                (0x80000000, (False, False, False))]:
            row = summarize(record(42, flags))['accounts'][0]
            self.assertEqual(tuple(row[k] for k in ('lockedOut', 'deleted', 'forcePasswordChange')), expected)
            self.assertEqual(row['flags'], flags)

    def test_changed_read_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'users.dat'
            path.write_bytes(record(42))
            with path.open('rb') as real:
                class ChangingRead:
                    def __enter__(self):
                        return self
                    def __exit__(self, *args):
                        pass
                    def fileno(self):
                        return real.fileno()
                    def seek(self, offset):
                        real.seek(offset)
                    def read(self, size):
                        return record(42, 1) if real.tell() == 0 and getattr(self, 'read_once', False) else self.first(size)
                    def first(self, size):
                        self.read_once = True
                        return real.read(size)
                with patch.object(Path, 'open', return_value=ChangingRead()):
                    with self.assertRaises(ValueError):
                        read_report(path)

    def test_compare_tracks_ids_not_slots(self):
        before = summarize(record(73) + record(42, 1))
        after = summarize(record(42) + record(73, 0x400) + record(99))
        self.assertEqual(compare(before, after)['changes'], [
            dict(userId=42, beforeFlags=1, afterFlags=0, xorMask=1),
            dict(userId=73, beforeFlags=0, afterFlags=0x400, xorMask=0x400),
            dict(userId=99, beforeFlags=None, afterFlags=0, xorMask=None)])
        self.assertEqual(compare(before, summarize(record(42, 1) + record(73)))['changes'], [])

    def test_read_only_and_cli_redaction(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'users.dat'
            raw = record(42)
            path.write_bytes(raw)
            self.assertEqual(read_report(path), summarize(raw))
            self.assertEqual(path.read_bytes(), raw)
            output, error = io.StringIO(), io.StringIO()
            with patch.object(sys, 'argv', ['probe', 'capture', '--input', str(path / 'SECRET')]):
                with contextlib.redirect_stdout(output), contextlib.redirect_stderr(error):
                    self.assertEqual(main(), 1)
            self.assertEqual(output.getvalue(), '')
            self.assertNotIn('SECRET', error.getvalue())

    def test_reports_cannot_claim_certified_or_duplicate_ids(self):
        report = summarize(record(42))
        report['certified'] = True
        with self.assertRaises(ValueError):
            compare(report, report)
        report['certified'] = False
        report['accounts'] *= 2
        with self.assertRaises(ValueError):
            compare(report, report)


if __name__ == '__main__':
    unittest.main()
