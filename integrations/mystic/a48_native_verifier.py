"""Candidate A48 embedded-Python verifier; NOT a certified runtime binding.

Uses documented getuserid/isuserpw, never substitutes the signed-in user.
The installation must supply verified identity extraction and a comparison of
native pwdata to the adapter's opaque record. No storage encoding is assumed.
No account-state, ACS, network channel or runtime launcher is provided here.
"""
from bridge_core import number


class NativeRecordVerifier(object):
    def __init__(self, bbs, identity, matches_record):
        self.bbs = bbs
        self.identity = identity
        self.matches_record = matches_record

    def _selected(self, uid, opaque):
        record = self.bbs.getuserid(uid)
        if type(record) is not dict or 'pwdata' not in record:
            raise ValueError('Account unavailable')
        actual = self.identity(record)
        if (not number(actual, 0x7fffffff) or actual != uid or
                self.matches_record(uid, opaque, record) is not True):
            raise ValueError('Account unavailable')
        return record

    def verify(self, uid, opaque, candidate):
        try:
            if (not number(uid, 0x7fffffff) or type(opaque) is not bytes or
                    len(opaque) != 101):
                return False
            # Capture only the session identity, never use its password data.
            current = self.identity(self.bbs.getuser(0))
            if not number(current, 0x7fffffff):
                return False
            selected = self._selected(uid, opaque)
            result = self.bbs.isuserpw(selected['pwdata'], candidate)
            # Both records must still bind to the same snapshot; the adapter
            # additionally rechecks the complete raw record after this call.
            self._selected(uid, opaque)
            after = self.identity(self.bbs.getuser(0))
            return (result is True and number(after, 0x7fffffff) and
                    after == current)
        except Exception:
            return False
