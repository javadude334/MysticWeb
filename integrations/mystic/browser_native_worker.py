# -*- coding: ascii -*-
"""Sandbox-only, read-only Mystic session worker (Python 2.7 compatible).

This worker is intentionally NOT a certified browser authentication adapter.
It must only be invoked after Mystic's own SSH password authentication, from
the E:\\mystic sandbox, with a dedicated sandbox-only post-login hook.

Protocol framing and nonce handling are implemented here. Account status and
authorization are DENIED until their native semantics are verified. Never
report passwordVerified=True based solely on reaching this Python program.
"""
from __future__ import print_function
import json
import os
import re

PREFIX = 'MYSTICWEB/1 '
NONCE = re.compile(r'^[A-Za-z0-9_-]{43}$')
INSTANCE = 'mystic-sandbox'
MAX_LINE = 4096
try:
    TEXT_TYPES = (str, unicode)
except NameError:
    TEXT_TYPES = (str,)


def emit(bbs, value):
    bbs.writeln(PREFIX + json.dumps(value, separators=(',', ':'),
                                    sort_keys=True))


def read_request(bbs):
    """Bounded input via Mystic terminal API; no Python stdio dependency.

    Mystic getkey echo/line semantics still require sandbox runtime testing.
    The caller's SSH request timeout is the external deadline.
    """
    characters = []
    while len(characters) <= MAX_LINE:
        key = bbs.getkey()
        if type(key) not in TEXT_TYPES or len(key) != 1:
            return None
        if key in ('\r', '\n'):
            return ''.join(characters) if characters else None
        if ord(key) < 32 or ord(key) > 126:
            return None
        characters.append(key)
    return None


def sandbox_only():
    # This is a safety boundary, not a substitute for an OS sandbox.
    root = os.path.normcase(os.path.abspath('E:\\mystic'))
    cwd = os.path.normcase(os.path.realpath(os.getcwd()))
    if os.name != 'nt' or (cwd != root and not cwd.startswith(root + os.sep)):
        raise ValueError('Sandbox only')


def current_user(bbs):
    current = bbs.getuser(0)
    if type(current) is not dict:
        raise ValueError('Missing current native user')
    value = current.get('id')
    if type(value) not in (int, long) or value < 1 or value > 0x7fffffff:
        raise ValueError('Invalid native user')
    if value not in (1, 2):
        raise ValueError('Fixture user required')
    lookup = bbs.getuserid(value)
    if type(lookup) is not dict or lookup.get('id') != value:
        raise ValueError('Native identity mismatch')
    if bbs.access('u' + str(value)) is not True:
        raise ValueError('Native session mismatch')
    return value


def handle(line, bbs):
    try:
        request = json.loads(line)
        if type(request) is not dict:
            return None
        operation = request.get('operation')
        required = {
            'authenticate': set(['version', 'nonce', 'operation', 'instance']),
            'account': set(['version', 'nonce', 'operation', 'instance', 'userId']),
            'authorize': set(['version', 'nonce', 'operation', 'instance',
                              'userId', 'areaId', 'catalogRevision'])
        }
        if operation not in required or set(request) != required[operation]:
            return None
        nonce = request.get('nonce')
        if type(nonce) not in TEXT_TYPES or not NONCE.match(nonce):
            return None
        if type(request.get('version')) is not int or request['version'] != 1:
            return None
        if request.get('instance') != INSTANCE:
            return None
        if operation != 'authenticate':
            user_id = request.get('userId')
            if type(user_id) is not int or user_id < 1 or user_id > 0x7fffffff:
                return None
        if operation == 'authorize':
            area_id = request.get('areaId')
            revision = request.get('catalogRevision')
            if (type(area_id) is not int or not 1 <= area_id <= 65535 or
                    type(revision) not in TEXT_TYPES or
                    not re.match(r'^[a-f0-9]{64}$', revision)):
                return None
        uid = current_user(bbs)
        if operation != 'authenticate' and request['userId'] != uid:
            return None
        # Never turn an authenticated SSH shell into an eligibility assertion.
        # Explicit denial cannot pass validatedNativeReply().
        return dict(version=1, nonce=nonce, operation=request['operation'],
                    instance=INSTANCE, userId=uid,
                    account=dict(exists=False, deleted=False, locked=False,
                                 expired=False, passwordChangeRequired=False))
    except Exception:
        return None


def main():
    import mystic_bbs as bbs
    sandbox_only()
    current_user(bbs)
    bbs.writeln('MYSTICWEB/1 READY')
    # One request per session; caller opens a fresh authenticated SSH session.
    line = read_request(bbs)
    if line is None:
        return
    reply = handle(line, bbs)
    if reply is not None:
        emit(bbs, reply)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        # No exception details, user records, paths, or credentials on the wire.
        pass
