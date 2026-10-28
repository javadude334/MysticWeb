import os
import struct
import sys
import unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from a48_driver import A48Driver
from bridge_core import handle
import test_bridge_core as fixtures


def record(uid, name=b'Test User', flags=0):
    data = bytearray(1536)
    struct.pack_into('<II', data, 0, uid, flags)
    data[8:109] = b'X' * 101
    data[109:109 + len(name)] = name
    return bytes(data)


def decode(raw):
    # Synthetic codec ONLY. Production must supply verified native decoding.
    return raw.split(b'\0', 1)[0].decode('ascii')


class A48Tests(unittest.TestCase):
    def test_documented_denial_flags_override_permissive_policy(self):
        calls = []
        class Policy(fixtures.Driver):
            def account(self, *args):
                calls.append('account')
                return self.state
            def authorize(self, *args):
                calls.append('authorize')
                return super().authorize(*args)
        class Verifier:
            def verify(self, *args):
                calls.append('password')
                return True
        requests = fixtures.BridgeTests()
        for flags in [1, 4, 1024, 1029]:
            driver = A48Driver(lambda: record(42, flags=flags), decode, Verifier(), Policy())
            self.assertFalse(driver.verify_password(42, 'synthetic'))
            self.assertIsNone(driver.account(42))
            with self.assertRaises(ValueError):
                driver.authorize(42, 1)
            for raw in [requests.request(), requests.request('account'),
                        requests.request('authorize', areaId=1, catalogRevision='a' * 64)]:
                self.assertEqual(handle(raw, 'vm', driver), {'error': 'Access unavailable'})
        self.assertEqual(calls, [])

    def test_clear_flags_do_not_supply_account_policy(self):
        for flags in [0, 0x20, 0x200, 0x80000000]:
            driver = A48Driver(lambda: record(42, flags=flags), decode)
            self.assertIsNone(driver.account(42))
            self.assertIn('error', handle(fixtures.BridgeTests().request(), 'vm', driver))

    def test_account_and_acs_record_changes_deny(self):
        for change in [record(42, flags=1), record(42, name=b'Changed'), record(43)]:
            state = [record(42)]
            class Policy(fixtures.Driver):
                def account(self, *args):
                    state[0] = change
                    return self.state
                def authorize(self, *args):
                    state[0] = change
                    return super().authorize(*args)
            driver = A48Driver(lambda: state[0], decode, policy=Policy())
            self.assertIsNone(driver.account(42))
            state[0] = record(42)
            with self.assertRaises(ValueError):
                driver.authorize(42, 1)

    def test_layout_and_permanent_id_not_slot(self):
        calls = []
        class Verifier:
            def verify(self, uid, opaque, candidate):
                calls.append((uid, opaque, candidate))
                return True
        driver = A48Driver(lambda: record(42), decode, Verifier(), fixtures.Driver())
        self.assertEqual(driver.resolve('Test User'), 42)
        self.assertIsNone(driver.resolve('test user'))
        self.assertIsNone(driver.resolve('missing'))
        self.assertTrue(driver.verify_password(42, 'synthetic'))
        self.assertEqual(calls, [(42, b'X' * 101, 'synthetic')])
        self.assertFalse(driver.verify_password(1, 'synthetic'))

    def test_missing_dependencies_and_ambiguous_accounts_deny(self):
        driver = A48Driver(lambda: record(42), decode)
        self.assertFalse(driver.verify_password(42, 'synthetic'))
        self.assertIsNone(driver.account(42))
        with self.assertRaises(ValueError):
            driver.authorize(42, 1)
        for data in [b'', record(42)[:-1], record(42) * 2, record(0xffffffff)]:
            with self.assertRaises(ValueError):
                A48Driver(lambda: data, decode).resolve('Test User')
        self.assertIsNone(A48Driver(lambda: record(42) + record(43), decode).resolve('Test User'))
        self.assertIsNone(A48Driver(lambda: record(0), decode).resolve('Test User'))

    def test_changes_during_verification_and_truthy_result_deny(self):
        state = [record(42)]
        class Verifier:
            def verify(self, *args):
                state[0] = record(42, flags=1)
                return True
        driver = A48Driver(lambda: state[0], decode, Verifier())
        self.assertFalse(driver.verify_password(42, 'synthetic'))
        driver.verifier.verify = lambda *args: 1
        self.assertFalse(driver.verify_password(42, 'synthetic'))

    def test_adapter_through_dispatcher(self):
        class Policy(fixtures.Driver):
            def account(self, uid, flags, raw):
                return super().account(uid)
        class Verifier:
            def verify(self, uid, opaque, password):
                return uid == 42 and password == 'synthetic'
        driver = A48Driver(lambda: record(42), decode, Verifier(), Policy())
        raw = fixtures.BridgeTests().request()
        self.assertTrue(handle(raw, 'vm', driver)['passwordVerified'])
        driver.verifier = None
        self.assertIn('error', handle(raw, 'vm', driver))
