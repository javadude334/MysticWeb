#!/usr/bin/env python3
"""Require a successful response from the expected deployed revision."""
import argparse
import json
import sys
import time
import urllib.request

def healthy(url, revision):
    try:
        request = urllib.request.Request(url, headers={"Cache-Control": "no-cache"})
        with urllib.request.urlopen(request, timeout=2) as response:
            payload = json.load(response)
            return response.status == 200 and payload.get("status") == "ok" and payload.get("revision") == revision
    except (OSError, ValueError, AttributeError):
        return False

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("revision")
    parser.add_argument("--attempts", type=int, default=30)
    parser.add_argument("--delay", type=float, default=1)
    args = parser.parse_args()
    for attempt in range(args.attempts):
        if healthy(args.url, args.revision):
            return 0
        if attempt + 1 < args.attempts:
            time.sleep(args.delay)
    print(f"Health check did not confirm revision {args.revision}.", file=sys.stderr)
    return 1

if __name__ == "__main__":
    sys.exit(main())
