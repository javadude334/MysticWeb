"""Read-only A48 current-session feasibility probe, not an auth adapter.

Run ONLY inside a normally authenticated E:\\mystic native session. No passwords,
message opens, context changes, file writes, or network calls. Does not certify
current eligibility, arbitrary-user ACS, or browser login.
"""
from __future__ import print_function
import json
import os
import stat
import struct


PROBE_STAGE = 'START'

try:
    INTEGER_TYPES = (int, long)
except NameError:
    INTEGER_TYPES = (int,)

def positive_id(value):
    return type(value) in INTEGER_TYPES and 0 < value <= 0x7fffffff


def inspect_session(bbs, rules):
    """rules contains only operator-controlled catalog ACS, never user input."""
    global PROBE_STAGE
    PROBE_STAGE = 'CURRENT_USER'
    current = bbs.getuser(0)
    is_record = type(current) is dict
    has_id = is_record and 'id' in current
    id_value = current.get('id') if is_record else None
    id_kind = 'int' if type(id_value) is int else ('integer' if type(id_value) in INTEGER_TYPES else ('missing' if not has_id else 'non_integer'))
    bbs.writeln('IDENTITY_SHAPE: dictionary=' + str(is_record) + '; id_present=' + str(has_id) + '; id_type=' + id_kind + '; positive_in_range=' + str(positive_id(id_value)))
    if type(current) is not dict or not positive_id(current.get('id')):
        raise ValueError('Identity unavailable')
    uid = current['id']
    if uid not in (1, 2):
        raise ValueError('Disposable fixture session required')
    PROBE_STAGE = 'PERMANENT_ID_LOOKUP'
    explicit = bbs.getuserid(uid)
    if type(explicit) is not dict or explicit.get('id') != uid:
        raise ValueError('Identity lookup mismatch')
    PROBE_STAGE = 'ACS_CONTROLS'
    if bbs.access('^') is not True or bbs.access('%') is not False:
        raise ValueError('Native ACS unavailable')
    PROBE_STAGE = 'OWN_ID_ACS'
    if bbs.access('u' + str(uid)) is not True:
        raise ValueError('Session identity mismatch')
    other = 2 if uid == 1 else 1
    PROBE_STAGE = 'OTHER_ID_ACS'
    if bbs.access('u' + str(other)) is not False:
        raise ValueError('Identity separation unavailable')
    result = {'probe': 'CURRENT_SESSION_CONTEXT', 'nativeSessionUserId': uid,
              'productionIdentityAdapter': False, 'eligibilityCertified': False,
              'browserEnabled': False, 'groups': [], 'areas': []}
    PROBE_STAGE = 'GROUP_ACS'
    for group in (1, 2):
        value = bbs.access('g' + str(group))
        if type(value) is not bool:
            raise ValueError('Invalid ACS result')
        result['groups'].append({'groupId': group, 'currentContextMatches': value})
    PROBE_STAGE = 'AREA_ACS'
    for area, list_rule, read_rule in rules:
        row = {'areaId': area}
        for name, rule in [('listInCurrentContext', list_rule), ('readInCurrentContext', read_rule)]:
            value = bbs.access(rule)
            if type(value) is not bool:
                raise ValueError('Invalid ACS result')
            row[name] = value
        result['areas'].append(row)
    PROBE_STAGE = 'IDENTITY_RECHECK'
    after = bbs.getuser(0)
    if type(after) is not dict or after.get('id') != uid:
        raise ValueError('Session identity changed')
    return result


def sandbox_rules():
    root = os.path.abspath(r'E:\mystic')
    cwd = os.path.normcase(os.path.realpath(os.getcwd()))
    native_root = os.path.normcase(root)
    if cwd != native_root and not cwd.startswith(native_root + os.sep):
        raise ValueError('Sandbox working directory required')
    filename = os.path.join(root, 'data', 'mbases.dat')
    current = filename
    while True:
        info = os.lstat(current)
        if stat.S_ISLNK(info.st_mode) or getattr(info, 'st_file_attributes', 0) & 0x400:
            raise ValueError('Linked path')
        parent = os.path.dirname(current)
        if parent == current:
            break
        current = parent
    if os.name != 'nt' or os.path.normcase(os.path.realpath(filename)) != os.path.normcase(filename):
        raise ValueError('Sandbox required')
    with open(filename, 'rb') as source:
        before = os.fstat(source.fileno())
        if before.st_size < 768 or before.st_size > 512 * 768 or before.st_size % 768:
            raise ValueError('Unsupported catalog')
        data = source.read(before.st_size)
        after = os.fstat(source.fileno())
        if len(data) != before.st_size or before.st_size != after.st_size or before.st_mtime != after.st_mtime:
            raise ValueError('Catalog changed')
    rows = []
    seen = set()
    for offset in range(0, len(data), 768):
        area = struct.unpack_from('<H', data, offset)[0]
        if area not in (2, 5):
            continue
        if area in seen:
            raise ValueError('Ambiguous fixture')
        seen.add(area)
        record = bytearray(data[offset:offset + 768])
        if record[260] == 3 or struct.unpack_from('<I', data, offset + 577)[0] & 16:
            raise ValueError('Private fixture')
        rules = []
        for pos in (263, 294):
            length = record[pos]
            if length > 30:
                raise ValueError('Invalid ACS')
            value = data[offset + pos + 1:offset + pos + 1 + length]
            if any(byte < 32 or byte > 126 for byte in bytearray(value)):
                raise ValueError('Invalid ACS')
            rules.append(value.decode('ascii'))
        rows.append((area, rules[0], rules[1]))
    if seen != set((2, 5)):
        raise ValueError('Missing fixture')
    return data, rows


def main():
    global PROBE_STAGE
    import mystic_bbs as bbs
    try:
        PROBE_STAGE = 'SANDBOX_CATALOG'
        before, rules = sandbox_rules()
        result = inspect_session(bbs, rules)
        PROBE_STAGE = 'CATALOG_RECHECK'
        if sandbox_rules()[0] != before:
            raise ValueError('Catalog changed')
        bbs.writeln(json.dumps(result, sort_keys=True))
    except Exception as error:
        # Never print native dictionaries, exception messages or credential data.
        safe_reasons = ('Sandbox working directory required', 'Linked path', 'Sandbox required', 'Unsupported catalog', 'Catalog changed', 'Ambiguous fixture', 'Private fixture', 'Invalid ACS', 'Missing fixture', 'Identity unavailable', 'Disposable fixture session required', 'Identity lookup mismatch', 'Native ACS unavailable', 'Session identity mismatch', 'Identity separation unavailable', 'Invalid ACS result', 'Session identity changed')
        reason = str(error) if type(error) is ValueError and str(error) in safe_reasons else 'NATIVE_OR_RUNTIME_ERROR'
        bbs.writeln('CURRENT_SESSION_CONTEXT: UNAVAILABLE; BROWSER_LOGIN_DISABLED')
        bbs.writeln('FAILING_STAGE: ' + PROBE_STAGE)
        bbs.writeln('SAFE_REASON: ' + reason)

    bbs.writeln('Press a key to return to the menu.')
    bbs.getkey()


if __name__ == '__main__':
    main()
