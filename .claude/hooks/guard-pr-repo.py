#!/usr/bin/env python3
"""PreToolUse guard: block `gh pr create/merge` that doesn't pin our fork.

brief-studio is a GitHub fork of mouadhhhallem/postforge-ai. `gh` defaults a
PR's base to the upstream parent, so an unpinned `gh pr create` can open a PR
against PostForge by mistake. This blocks create/merge unless the command pins
--repo (or -R) hibatullahmindquest/brief-studio.
"""
import sys
import re
import json

FORK = "hibatullahmindquest/brief-studio"

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)  # can't parse → not our concern

cmd = ((data.get("tool_input") or {}).get("command")) or ""

# Strip quoted spans (commit messages, grep patterns, echo text, PR bodies)
# so we only inspect the ACTUAL shell command — not text that merely mentions
# "gh pr create". This is what prevents false blocks on `git commit -m "..."`,
# `grep "...gh pr..."`, heredoc PR bodies, etc.
unquoted = re.sub(r"'[^']*'", " ", cmd)
unquoted = re.sub(r'"[^"]*"', " ", unquoted)

# Guard a real `gh pr create/merge` invocation: gh at a command position
# (start, or after && ; ||) in the unquoted command.
if re.search(r"(^|&&|;|\|\|)\s*gh\s+pr\s+(create|merge)\b", unquoted):
    # Pinned check runs on the original (the value may be quoted).
    pinned = re.search(r"(--repo|-R)\s+['\"]?" + re.escape(FORK), cmd)
    if not pinned:
        sys.stderr.write(
            "BLOCKED: brief-studio is a FORK of postforge-ai.\n"
            "`gh pr create/merge` must pin the fork or it may target the upstream repo:\n"
            f"  gh pr create --repo {FORK} --base master ...\n"
            f"  gh pr merge <n> --repo {FORK} --merge\n"
        )
        sys.exit(2)  # exit 2 → block the tool call

sys.exit(0)
