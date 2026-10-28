"""Offline A48 flag diagnostics; never an authentication/account policy.

Only permanent IDs and non-secret flag words leave memory. No record dumps,
password inspection, hashes, writes to Mystic, or native session changes.
"""
import argparse
import json
import os
from pathlib import Path
import struct
import sys

RECORD_SIZE = 1536
MAX_BYTES = 16 * 1024 * 1024
MASKS = {'lockedOut': 0x1, 'deleted': 0x4, 'forcePasswordChange': 0x400}


def summarize(data):
    if type(data) is not bytes or not data or len(data) > MAX_BYTES or len(data) % RECORD_SIZE:
        raise ValueError('Invalid snapshot')
    rows = {}
    for offset in range(0, len(data), RECORD_SIZE):
        uid, flags = struct.unpack_from('<II', data, offset)
        if uid == 0:
            continue
        if uid > 0x7fffffff or uid in rows:
            raise ValueError('Invalid identity')
        rows[uid] = dict(userId=uid, flags=flags,
                         **{name: bool(flags & mask) for name, mask in MASKS.items()})
    return {'version': 1, 'certified': False, 'accounts': [rows[uid] for uid in sorted(rows)]}


def read_report(path):
    """Best-effort stable read, NOT a coherent live database loader.

    Stop all sandbox writers before use. Two matching reads cannot rule out
    concurrent writes that change and revert or occur after the final read.
    """
    path = Path(path).resolve(strict=True)
    # Reject production even when reached through a junction/symlink.
    production = Path('D:/mystic').resolve()
    if path == production or production in path.parents:
        raise ValueError('Production path excluded')
    with path.open('rb') as source:
        before = os.fstat(source.fileno())
        if not 0 < before.st_size <= MAX_BYTES:
            raise ValueError('Invalid size')
        first = source.read(MAX_BYTES + 1)
        source.seek(0)
        second = source.read(MAX_BYTES + 1)
        after = os.fstat(source.fileno())
        current = path.stat()
        if (first != second or len(first) != before.st_size or
                (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) !=
                (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns) or
                (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns) !=
                (current.st_dev, current.st_ino, current.st_size, current.st_mtime_ns)):
            raise ValueError('Unstable input')
    return summarize(first)


def compare(before, after):
    def index(report):
        if type(report) is not dict or report.get('version') != 1 or report.get('certified') is not False:
            raise ValueError('Invalid report')
        rows = {}
        for row in report['accounts']:
            uid, flags = row['userId'], row['flags']
            if (type(uid) is not int or not 0 < uid <= 0x7fffffff or uid in rows or
                    type(flags) is not int or not 0 <= flags <= 0xffffffff):
                raise ValueError('Invalid report')
            rows[uid] = flags
        return rows
    left, right = index(before), index(after)
    return {'version': 1, 'certified': False, 'changes': [
        {'userId': uid, 'beforeFlags': left.get(uid), 'afterFlags': right.get(uid),
         'xorMask': left[uid] ^ right[uid] if uid in left and uid in right else None}
        for uid in sorted(set(left) | set(right)) if left.get(uid) != right.get(uid)]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    capture = commands.add_parser('capture')
    capture.add_argument('--input', required=True, help='Quiescent sandbox users.dat or offline copy')
    diff = commands.add_parser('compare')
    diff.add_argument('before')
    diff.add_argument('after')
    args = parser.parse_args()
    try:
        if args.command == 'capture':
            result = read_report(args.input)
        else:
            reports = []
            for name in (args.before, args.after):
                with open(name, 'r', encoding='utf-8-sig') as source:
                    raw = source.read(MAX_BYTES + 1)
                if len(raw) > MAX_BYTES:
                    raise ValueError('Invalid report')
                reports.append(json.loads(raw))
            result = compare(*reports)
        print(json.dumps(result, sort_keys=True))
        return 0
    except Exception:
        print('Diagnostic unavailable; no account status certified.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
