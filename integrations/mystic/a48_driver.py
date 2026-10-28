"""Read-only A48 adapter. No password algorithm or implicit native context.

Trusted bindings supply a coherent users.dat snapshot, handle decoder, password
verifier and current account/ACS policy. None is inferred from unknown flags.
Compatible with Python 2.7 for embedding; bridge_server requires modern Python.
"""
import struct


class A48Driver(object):
    RECORD_SIZE = 1536
    MAX_BYTES = 16 * 1024 * 1024

    def __init__(self, snapshot, decode_handle, verifier=None, policy=None):
        self.snapshot = snapshot
        self.decode_handle = decode_handle
        self.verifier = verifier
        self.policy = policy

    def _records(self):
        data = self.snapshot()
        if (type(data) is not bytes or not data or len(data) > self.MAX_BYTES or
                len(data) % self.RECORD_SIZE):
            raise ValueError('Account unavailable')
        records = {}
        for offset in range(0, len(data), self.RECORD_SIZE):
            record = data[offset:offset + self.RECORD_SIZE]
            uid = struct.unpack_from('<I', record, 0)[0]
            # Zero is an unused slot, never an identity. Other invalid or
            # duplicate permanent IDs invalidate the whole snapshot.
            if uid == 0:
                continue
            if uid > 0x7fffffff or uid in records:
                raise ValueError('Account unavailable')
            records[uid] = record
        return records

    def resolve(self, name):
        # The binding owns native encoding, shortstring width and name matching.
        # No guessed Unicode/case/alias normalization is used for identity.
        matches = [uid for uid, record in self._records().items()
                   if self.decode_handle(record[109:]) == name]
        return matches[0] if len(matches) == 1 else None

    def verify_password(self, uid, candidate):
        if self.verifier is None:
            return False
        record = self._records().get(uid)
        if record is None:
            return False
        # verify(uid, opaque_101_bytes, candidate) must return the literal True.
        # In-session CheckPW/isuserpw is not automatically such a verifier.
        result = self.verifier.verify(uid, record[8:109], candidate)
        # Changes to password, flags, identity or any other field during the
        # call deny; account checks also run before/after in bridge_core.
        return result is True and self._records().get(uid) == record

    def account(self, uid):
        record = self._records().get(uid)
        if record is None or self.policy is None:
            return None
        flags = struct.unpack_from('<I', record, 4)[0]
        # Policy must interpret all relevant account fields, not just flags.
        return self.policy.account(uid, flags, record)

    def authorize(self, uid, area):
        if self.policy is None or uid not in self._records():
            raise ValueError('Access unavailable')
        return self.policy.authorize(uid, area)
