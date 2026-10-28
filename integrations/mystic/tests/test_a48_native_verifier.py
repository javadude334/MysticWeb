"""Synthetic native API contract checks, not A48 runtime certification."""
import os
import sys
import unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from a48_native_verifier import NativeRecordVerifier
from a48_driver import A48Driver
from bridge_core import handle
from test_a48_driver import record, decode
import test_bridge_core as fixtures
import json


class Native:
    def __init__(self):
        self.current = 42
        self.records = {
            42: {'id': 42, 'pwdata': b'A' * 101},
            73: {'id': 73, 'pwdata': b'B' * 101}}
        self.calls = []

    def getuser(self, slot):
        assert slot == 0
        return self.records[self.current]

    def getuserid(self, uid):
        return self.records.get(uid)

    def isuserpw(self, data, candidate):
        self.calls.append(data)
        return {b'A' * 101: 'synthetic-A', b'B' * 101: 'synthetic-B'}[data] == candidate


def verifier(native):
    # These fields/representation are SYNTHETIC, not assertions about A48.
    return NativeRecordVerifier(native, lambda r: r['id'],
                                lambda uid, opaque, r: r['pwdata'] == opaque)


def synthetic_driver(native):
    a, b = bytearray(record(42, b'A')), bytearray(record(73, b'B'))
    a[8:109], b[8:109] = b'A' * 101, b'B' * 101
    class Policy(fixtures.Driver):
        def account(self, uid, flags, raw):
            return super().account(uid)
    return A48Driver(lambda: bytes(a + b), decode, verifier(native), Policy())


class NativeVerifierTests(unittest.TestCase):
    def test_selected_b_not_current_a_through_adapter_dispatcher(self):
        native = Native()
        driver = synthetic_driver(native)
        req = json.loads(fixtures.BridgeTests().request())
        req.update(username='B', password='synthetic-B')
        reply = handle(json.dumps(req), 'vm', driver)
        self.assertEqual(reply['userId'], 73)
        self.assertIs(reply['passwordVerified'], True)
        req['password'] = 'synthetic-A'
        self.assertIn('error', handle(json.dumps(req), 'vm', driver))
        self.assertEqual(native.calls, [b'B' * 101, b'B' * 101])
        self.assertEqual(native.current, 42)

    def test_missing_swapped_and_unbound_records_never_check_password(self):
        for replacement in [None, {}, {'id': 42, 'pwdata': b'B' * 101},
                            {'id': 73, 'pwdata': b'A' * 101}]:
            native = Native()
            native.records[73] = replacement
            self.assertFalse(verifier(native).verify(73, b'B' * 101, 'synthetic-B'))
            self.assertEqual(native.calls, [])

    def test_truthy_callbacks_exceptions_and_mutations_deny(self):
        native = Native()
        v = verifier(native)
        v.matches_record = lambda *args: 1
        self.assertFalse(v.verify(73, b'B' * 101, 'synthetic-B'))
        self.assertEqual(native.calls, [])
        for mutation in ['password', 'identity', 'session', 'truthy', 'exception']:
            native = Native()
            def check(data, candidate):
                if mutation == 'password': native.records[73]['pwdata'] = b'C' * 101
                if mutation == 'identity': native.records[73]['id'] = 42
                if mutation == 'session': native.current = 73
                if mutation == 'truthy': return 1
                if mutation == 'exception': raise RuntimeError('suppressed')
                return True
            native.isuserpw = check
            self.assertFalse(verifier(native).verify(73, b'B' * 101, 'synthetic-B'))
