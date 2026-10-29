"""Synthetic probe-contract tests; do not certify the native runtime."""
import os
import sys
import unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from session_context_probe import inspect_session


class Native(object):
    def __init__(self):
        self.uid = 1
        self.calls = []

    def getuser(self, slot):
        assert slot == 0
        return {'id': self.uid, 'pwdata': 'must never appear in output'}

    def getuserid(self, uid):
        return {'id': uid}

    def access(self, rule):
        self.calls.append(rule)
        return rule in ('^', 'u1', 'g2', 's10g2')


class ProbeTests(unittest.TestCase):
    def test_reports_only_current_context_without_switching_or_message_opens(self):
        native = Native()
        result = inspect_session(native, [(5, 's10g2', 'u2')])
        self.assertEqual(result['nativeSessionUserId'], 1)
        self.assertEqual(result['groups'][1]['currentContextMatches'], True)
        self.assertEqual(result['areas'][0]['readInCurrentContext'], False)
        self.assertNotIn('pwdata', repr(result))
        self.assertEqual(result['eligibilityCertified'], False)

    def test_denies_identity_lookup_mismatch(self):
        native = Native()
        native.getuserid = lambda uid: {'id': 2}
        self.assertRaises(ValueError, inspect_session, native, [])

    def test_denies_permissive_or_nonboolean_native_acs(self):
        native = Native()
        native.access = lambda rule: True
        self.assertRaises(ValueError, inspect_session, native, [])
        native.access = lambda rule: 1
        self.assertRaises(ValueError, inspect_session, native, [])

    def test_denies_context_identity_change(self):
        native = Native()
        original = native.access
        def changed(rule):
            value = original(rule)
            if rule == 'g2':
                native.uid = 2
            return value
        native.access = changed
        self.assertRaises(ValueError, inspect_session, native, [])


if __name__ == '__main__':
    unittest.main()
