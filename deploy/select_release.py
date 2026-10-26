#!/usr/bin/env python3
"""Select only the current branch head with a successful push CI run."""
import json
import os
import re
import sys
import urllib.parse
import urllib.request

SHA = re.compile(r"[0-9a-f]{40}")

def choose_sha(fetch, repository, branch, workflow):
    base = f"https://api.github.com/repos/{repository}"
    head = fetch(f"{base}/commits/{urllib.parse.quote(branch, safe='')}")
    sha = head["sha"]
    if not SHA.fullmatch(sha):
        raise ValueError("GitHub returned an invalid commit SHA")
    query = urllib.parse.urlencode({
        "branch": branch, "event": "push", "head_sha": sha, "per_page": 100,
    })
    runs = fetch(f"{base}/actions/workflows/{urllib.parse.quote(workflow, safe='')}/runs?{query}")["workflow_runs"]
    matches = [
        run for run in runs
        if run.get("head_sha") == sha
        and run.get("head_branch") == branch
        and run.get("event") == "push"
        and run.get("head_repository", {}).get("full_name") == repository
    ]
    if not matches:
        return None
    latest = max(matches, key=lambda run: run["id"])
    if latest.get("status") != "completed" or latest.get("conclusion") != "success":
        return None
    return sha

def fetch_json(url):
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "MysticWeb-deployer",
    }
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)

def main():
    try:
        sha = choose_sha(
            fetch_json,
            os.environ.get("REPOSITORY", "javadude334/MysticWeb"),
            os.environ.get("BRANCH", "main"),
            os.environ.get("WORKFLOW", "frontend.yml"),
        )
        if sha:
            print(sha)
        else:
            print("Current main head is awaiting successful push checks; keeping the current release.", file=sys.stderr)
        return 0
    except Exception as error:
        # Do not print request headers or tokens.
        print(f"Release selection failed ({type(error).__name__}); keeping the current release.", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
