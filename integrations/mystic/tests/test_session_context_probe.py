"""Synthetic probe-contract tests; do not certify the native runtime."""
import os
import sys
import unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from session_context_probe import inspect_session, positive_id, main
import types

try:
    native_integer = long
except NameError:
    native_integer = int


class Native(object):
    def __init__(self):
        self.uid = 1
        self.calls = []
        self.output = []

    def writeln(self, value):
        self.output.append(value)

    def getuser(self, slot):
        assert slot == 0
        return {'id': self.uid, 'pwdata': 'must never appear in output'}

    def getuserid(self, uid):
        return {'id': uid}

    def access(self, rule):
        self.calls.append(rule)
        return rule in ('^', 'u1', 'g2', 's10g2')


class ProbeTests(unittest.TestCase):
    def test_native_python2_integer_identity_and_invalid_types(self):
        native = Native()
        native.uid = native_integer(1)
        self.assertEqual(inspect_session(native, [])['nativeSessionUserId'], 1)
        for value in (True, False, 0, -1, 2147483648, '1', 1.0, None):
            self.assertFalse(positive_id(value))
        self.assertTrue(positive_id(native_integer(2147483647)))

    def test_main_waits_for_key_after_safe_failure_without_record_dump(self):
        import session_context_probe as probe
        fake = types.ModuleType('mystic_bbs')
        output = []
        fake.writeln = output.append
        fake.getuser = lambda slot: {'pwdata': 'SECRET', 'id': 'invalid'}
        fake.getkey = lambda: output.append('KEY_WAIT')
        previous_module = sys.modules.get('mystic_bbs')
        previous_rules = probe.sandbox_rules
        sys.modules['mystic_bbs'] = fake
        probe.sandbox_rules = lambda: (b'catalog', [])
        try:
            main()
        finally:
            probe.sandbox_rules = previous_rules
            if previous_module is None:
                del sys.modules['mystic_bbs']
            else:
                sys.modules['mystic_bbs'] = previous_module
        self.assertIn('FAILING_STAGE: CURRENT_USER', output)
        self.assertIn('SAFE_REASON: Identity unavailable', output)
        self.assertEqual(output[-1], 'KEY_WAIT')
        self.assertNotIn('SECRET', repr(output))

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
