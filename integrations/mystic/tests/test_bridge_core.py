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
    def test_inactive_account_never_reaches_password_engine(self):
        for key in ['exists', 'deleted', 'locked', 'expired', 'passwordChangeRequired']:
            driver = Driver()
            driver.state[key] = key != 'exists'
            self.assertEqual(handle(self.request(), 'vm', driver), {'error': 'Access unavailable'})
            self.assertEqual(driver.calls, [])

    def test_identity_or_account_change_during_password_check_denies(self):
        for change in ['mapping', 'deleted', 'locked', 'expired', 'passwordChangeRequired']:
            driver = Driver()
            def verify(uid, password):
                if change == 'mapping':
                    driver.resolve = lambda name: 43
                else:
                    driver.state[change] = True
                return True
            driver.verify_password = verify
            self.assertEqual(handle(self.request(), 'vm', driver), {'error': 'Access unavailable'})

    def test_two_users_passwords_are_bound_to_resolved_permanent_id(self):
        driver = Driver()
        driver.resolve = lambda name: {'Alpha': 42, 'Beta': 73}.get(name)
        def verify(uid, password):
            driver.calls.append((uid, 'password-check'))
            return {42: 'alpha-synthetic', 73: 'beta-synthetic'}.get(uid) == password
        driver.verify_password = verify
        dispatcher = BridgeDispatcher('vm', driver)
        cases = [('Alpha', 'alpha-synthetic', 42), ('Beta', 'beta-synthetic', 73),
                 ('Alpha', 'beta-synthetic', None), ('Beta', 'alpha-synthetic', None),
                 ('Missing', 'alpha-synthetic', None), ('Beta', 'beta-synthetic', 73)]
        for index, (name, password, expected) in enumerate(cases):
            reply = dispatcher.dispatch(self.request(username=name, password=password,
                                                    nonce=chr(65 + index) * 43))
            if expected is None:
                self.assertEqual(reply, {'error': 'Access unavailable'})
            else:
                self.assertEqual(reply['userId'], expected)
                self.assertIs(reply['passwordVerified'], True)
            self.assertNotIn(password, json.dumps(reply))
        self.assertEqual(driver.calls, [(42, 'password-check'), (73, 'password-check'),
                                       (42, 'password-check'), (73, 'password-check'),
                                       (73, 'password-check')])
    def test_authorization_catalog_and_denial(self):
        raw = self.request('authorize', areaId=1, catalogRevision='a' * 64)
        driver = Driver()
        self.assertTrue(handle(raw, 'vm', driver)['permissions']['read'])
        driver.allowed = False
        self.assertIn('error', handle(raw, 'vm', driver))
        driver.allowed = True
        driver.revision = 'b' * 64
        self.assertIn('error', handle(raw, 'vm', driver))

    def test_requested_user_acs_each_gate_and_revocation(self):
        driver = Driver()
        permissions = dict(list=True, read=True, group=True, context=True,
                           kind='echo', private=False, personal=False)
        calls = []
        def authorize(uid, area):
            calls.append((uid, area))
            # Synthetic requested-user evaluation, never a native ACS claim.
            return driver.revision, dict(permissions) if uid == 73 else dict(permissions, read=False)
        driver.authorize = authorize
        def request(uid):
            return self.request('authorize', userId=uid, areaId=9, catalogRevision=driver.revision)
        for uid in [42, 73, 42, 73]:
            reply = handle(request(uid), 'vm', driver)
            self.assertEqual('error' in reply, uid == 42)
        self.assertEqual(calls, [(42, 9), (73, 9), (42, 9), (73, 9)])
        for key in ['list', 'read', 'group', 'context']:
            for invalid in [False, None, 1, 'true']:
                permissions[key] = invalid
                self.assertIn('error', handle(request(73), 'vm', driver))
            permissions[key] = True
        def revoke(uid, area):
            driver.state['locked'] = True
            return driver.revision, permissions
        driver.authorize = revoke
        self.assertIn('error', handle(request(73), 'vm', driver))
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
