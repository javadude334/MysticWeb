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
import sys

PREFIX = 'MYSTICWEB/1 '
NONCE = re.compile(r'^[A-Za-z0-9_-]{43}$')
INSTANCE = 'mystic-sandbox'
MAX_LINE = 4096


def emit(value):
    sys.stdout.write(PREFIX + json.dumps(value, separators=(',', ':'),
                                         sort_keys=True) + '\r\n')
    sys.stdout.flush()


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
        if type(request) is not dict or set(request) not in (
                set(['version', 'nonce', 'operation', 'instance']),
                set(['version', 'nonce', 'operation', 'instance', 'userId']),
                set(['version', 'nonce', 'operation', 'instance',
                     'userId', 'areaId', 'catalogRevision'])):
            return None
        nonce = request.get('nonce')
        if type(nonce) is not str or not NONCE.match(nonce):
            return None
        if request.get('version') != 1 or request.get('instance') != INSTANCE:
            return None
        if request.get('operation') not in ('authenticate', 'account', 'authorize'):
            return None
        uid = current_user(bbs)
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
    sys.stdout.write('MYSTICWEB/1 READY\r\n')
    sys.stdout.flush()
    # One request per session; caller opens a fresh authenticated SSH session.
    line = sys.stdin.readline(MAX_LINE + 1)
    if not line or len(line) > MAX_LINE or not line.endswith('\n'):
        return
    reply = handle(line, bbs)
    if reply is not None:
        emit(reply)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        # No exception details, user records, paths, or credentials on the wire.
        pass
