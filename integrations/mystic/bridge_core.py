"""Python 2.7-compatible BBS-side dispatcher. No sockets, files or logs.

An authenticated, encrypted transport must call handle with a trusted runtime
driver. No driver is shipped: arbitrary-user context/account semantics are not
verified on A48. Absence or ambiguity returns only a generic denial.
"""
import json
import re
import threading
import time

try:
    text_type = unicode
    integer_types = (int, long)
except NameError:
    text_type = str
    integer_types = (int,)


def exact(value, names):
    return type(value) is dict and set(value) == set(names)


def number(value, maximum):
    return type(value) in integer_types and 1 <= value <= maximum


def active(account):
    return (exact(account, ['exists', 'deleted', 'locked', 'expired',
                            'passwordChangeRequired']) and
            account['exists'] is True and
            all(account[key] is False for key in account if key != 'exists'))


class BridgeDispatcher(object):
    """One dispatcher per native runtime, behind the authenticated transport.

    Reject concurrent native context use and repeated nonces. The cache holds
    nonces only, never credentials. Restart does not make a response acceptable
    to a fresh web request because NativeAccess generates a fresh nonce.
    """
    def __init__(self, instance, driver=None, clock=time.time):
        self.instance = instance
        self.driver = driver
        self.clock = clock
        self.lock = threading.Lock()
        self.nonces = {}
        self.last_time = 0

    def dispatch(self, raw):
        denied = {'error': 'Access unavailable'}
        if not self.lock.acquire(False):
            return denied
        try:
            if not isinstance(raw, (bytes, text_type)) or len(raw) > 4096:
                return denied
            now = self.clock()
            if not (0 <= self.last_time <= now < 1e12):
                return denied
            self.last_time = now
            self.nonces = dict((n, expiry) for n, expiry in self.nonces.items() if expiry > now)
            request = json.loads(raw)
            nonce = request.get('nonce')
            if (not isinstance(nonce, text_type) or
                    re.match(r'^[A-Za-z0-9_-]{43}\Z', nonce) is None or
                    nonce in self.nonces or len(self.nonces) >= 4096):
                return denied
            self.nonces[nonce] = now + 60
            return handle(raw, self.instance, self.driver)
        except Exception:
            return denied
        finally:
            self.lock.release()


def handle(raw, instance, driver=None):
    """driver must serialize native context and independently verify catalog.

    resolve(username) returns a permanent ID; verify_password(id, password)
    invokes native checking of THAT record, never a current/operator user.
    account(id) returns verified normalized current state. authorize(id, area)
    returns (independently computed revision, exact normalized permissions).
    Unknown field/flag/context semantics must raise, never default to active.
    """
    denied = {'error': 'Access unavailable'}
    try:
        if driver is None or not isinstance(raw, (bytes, text_type)) or len(raw) > 4096:
            return denied
        def unique(pairs):
            result = {}
            for key, value in pairs:
                if key in result:
                    raise ValueError()
                result[key] = value
            return result
        request = json.loads(raw, object_pairs_hook=unique)
        op = request.get('operation')
        extra = {'authenticate': ['username', 'password'], 'account': ['userId'],
                 'authorize': ['userId', 'areaId', 'catalogRevision']}.get(op)
        if extra is None or not exact(request, ['version', 'nonce', 'instance', 'operation'] + extra):
            return denied
        if (type(request['version']) not in integer_types or request['version'] != 1 or
                request['instance'] != instance or
                not isinstance(request['nonce'], text_type) or
                re.match(r'^[A-Za-z0-9_-]{43}\Z', request['nonce']) is None):
            return denied
        if op == 'authenticate':
            for key, maximum in [('username', 120), ('password', 256)]:
                value = request[key]
                if (not isinstance(value, text_type) or not value or
                        len(value.encode('utf-8')) > maximum or
                        any(ord(c) < 32 or ord(c) == 127 for c in value)):
                    return denied
            uid = driver.resolve(request['username'])
            if not number(uid, 0x7fffffff):
                return denied
            if driver.verify_password(uid, request['password']) is not True:
                return denied
            request['password'] = None
        else:
            uid = request['userId']
        if not number(uid, 0x7fffffff):
            return denied
        account = driver.account(uid)
        if not active(account):
            return denied
        reply = dict((key, request[key]) for key in ['version', 'nonce', 'instance', 'operation'])
        reply.update(userId=uid, account=account)
        if op == 'authenticate':
            reply['passwordVerified'] = True
        if op == 'authorize':
            if (not number(request['areaId'], 65535) or
                    not isinstance(request['catalogRevision'], text_type) or
                    re.match(r'^[a-f0-9]{64}\Z', request['catalogRevision']) is None):
                return denied
            revision, permissions = driver.authorize(uid, request['areaId'])
            if revision != request['catalogRevision'] or not exact(permissions,
                    ['list', 'read', 'group', 'context', 'kind', 'private', 'personal']):
                return denied
            if (any(permissions[key] is not True for key in ['list', 'read', 'group', 'context']) or
                    permissions['kind'] != 'echo' or permissions['private'] is not False or
                    permissions['personal'] is not False):
                return denied
            # Recheck after context/ACS evaluation; driver must restore context
            # and serialize the entire operation in its native runtime.
            if not active(driver.account(uid)):
                return denied
            reply.update(areaId=request['areaId'], catalogRevision=revision, permissions=permissions)
        return reply
    except Exception:
        return denied
