#!/usr/bin/env python3
"""Read-only Mystic 1.12 A48 method-2 password verifier.

Usage: python mystic_native_password_verify.py USERS.DAT USER_ID
Password is requested interactively. Never commit native user files.
"""
import argparse
import getpass
import hashlib
import hmac
from pathlib import Path

RECORD_SIZE = 1536

def verify(data: bytes, user_id: int, password: str) -> bool:
    if len(data) % RECORD_SIZE:
        raise ValueError("Unexpected users.dat length")
    for pos in range(0, len(data), RECORD_SIZE):
        record = data[pos:pos + RECORD_SIZE]
        if int.from_bytes(record[0:4], "little") != user_id:
            continue
        if record[8] != 2:
            raise ValueError("Unsupported password method")
        iterations = int.from_bytes(record[9:13], "little")
        if not 1 <= iterations <= 10_000_000:
            raise ValueError("Invalid iteration count")
        prehash = hashlib.sha512(password.encode("utf-8")).digest()
        derived = hashlib.pbkdf2_hmac("sha512", prehash, record[13:45], iterations, 64)
        return hmac.compare_digest(derived, record[45:109])
    return False

if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("users_dat", type=Path)
    p.add_argument("user_id", type=int)
    a = p.parse_args()
    try:
        matched = verify(a.users_dat.read_bytes(), a.user_id, getpass.getpass("Password: "))
    except ValueError as e:
        p.exit(2, f"Unsupported record: {e}\n")
    print("MATCH" if matched else "NO MATCH")
    raise SystemExit(0 if matched else 1)
