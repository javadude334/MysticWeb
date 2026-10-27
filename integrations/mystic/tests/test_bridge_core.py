import json
import os
import sys
import unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from bridge_core import handle, BridgeDispatcher

class Driver(object):
    def __init__(self):
        self.state = dict(exists=True, deleted=False, locked=False, expired=False, passwordChangeRequired=False)
        self.allowed = True
        self.revision = 'a' * 64
        self.calls = []
    def resolve(self, name):
        return 42 if name == 'Test User' else None
    def verify_password(self, uid, password):
        self.calls.append((uid, 'password-check'))
        return uid == 42 and password == 'synthetic'
    def account(self, uid):
        return self.state
    def authorize(self, uid, area):
        self.calls.append((uid, area))
        return self.revision, dict(list=self.allowed, read=self.allowed, group=True, context=True,
                                   kind='echo', private=False, personal=False)

class BridgeTests(unittest.TestCase):
    def test_dispatcher_replay_concurrency_and_clock_rollback(self):
        dispatcher = BridgeDispatcher('vm', Driver(), lambda: 100)
        raw = self.request()
        self.assertTrue(dispatcher.dispatch(raw)['passwordVerified'])
        self.assertIn('error', dispatcher.dispatch(raw))
        dispatcher.lock.acquire()
        try:
            self.assertIn('error', dispatcher.dispatch(raw))
        finally:
            dispatcher.lock.release()
        dispatcher.clock = lambda: 99
        self.assertIn('error', dispatcher.dispatch(raw))

    def test_dispatcher_nonce_capacity_and_missing_driver_deny(self):
        dispatcher = BridgeDispatcher('vm', Driver(), lambda: 100)
        dispatcher.nonces = dict((str(i), 200) for i in range(4096))
        self.assertIn('error', dispatcher.dispatch(self.request()))
        self.assertIn('error', BridgeDispatcher('vm').dispatch(self.request()))

    def request(self, operation='authenticate', **extra):
        data = dict(version=1, nonce='N' * 43, instance='vm', operation=operation)
        data.update(dict(username='Test User', password='synthetic') if operation == 'authenticate' else dict(userId=42))
        data.update(extra)
        return json.dumps(data)
    def test_no_driver_and_bad_password(self):
        self.assertEqual(handle(self.request(), 'vm'), {'error': 'Access unavailable'})
        self.assertIn('error', handle(self.request(password='wrong'), 'vm', Driver()))
    def test_exact_native_user_and_minimal_response(self):
        driver = Driver()
        reply = handle(self.request(), 'vm', driver)
        self.assertIs(reply['passwordVerified'], True)
        self.assertEqual(reply['userId'], 42)
        self.assertEqual(driver.calls, [(42, 'password-check')])
        self.assertNotIn('synthetic', json.dumps(reply))
        self.assertNotIn('username', reply)
    def test_invalid_account_states(self):
        for key in ['deleted', 'locked', 'expired', 'passwordChangeRequired']:
            driver = Driver()
            driver.state[key] = True
            self.assertIn('error', handle(self.request(), 'vm', driver))
        driver = Driver()
        driver.state.pop('locked')
        self.assertIn('error', handle(self.request(), 'vm', driver))
    def test_authorization_catalog_and_denial(self):
        raw = self.request('authorize', areaId=1, catalogRevision='a' * 64)
        driver = Driver()
        self.assertTrue(handle(raw, 'vm', driver)['permissions']['read'])
        driver.allowed = False
        self.assertIn('error', handle(raw, 'vm', driver))
        driver.allowed = True
        driver.revision = 'b' * 64
        self.assertIn('error', handle(raw, 'vm', driver))
    def test_malformed_requests_and_errors_are_redacted(self):
        driver = Driver()
        for raw in ['{', self.request(userId=42), self.request(version=True),
                    self.request(nonce='N' * 43 + '\n'), self.request(password='x\x00y'),
                    self.request(instance='other'), '{"operation":"account","operation":"authenticate"}',
                    self.request('authorize', areaId='../secret', catalogRevision='a' * 64)]:
            self.assertEqual(handle(raw, 'vm', driver), {'error': 'Access unavailable'})
        def fail(_):
            raise RuntimeError('sensitive native record')
        driver.resolve = fail
        self.assertEqual(handle(self.request(), 'vm', driver), {'error': 'Access unavailable'})

if __name__ == '__main__':
    unittest.main()
