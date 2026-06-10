#!/usr/bin/env python3
"""
PreToolUse hook — validates branch names before git checkout -b commands.
Enforces: feat/, fix/, chore/, docs/, refactor/ prefixes.
"""

import json
import re
import sys

VALID_PREFIXES = ["feat/", "fix/", "chore/", "docs/", "refactor/"]
EXEMPT_BRANCHES = ["master", "main", "HEAD"]


def main():
    try:
        hook_input = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    tool_name = hook_input.get("tool_name", "")
    tool_input = hook_input.get("tool_input", {})

    if tool_name != "Bash":
        sys.exit(0)

    command = tool_input.get("command", "")

    # Only check git checkout -b commands
    if "git checkout -b" not in command and "git switch -c" not in command:
        sys.exit(0)

    # Extract branch name
    match = re.search(r"git checkout -b ([^\s]+)", command)
    if not match:
        match = re.search(r"git switch -c ([^\s]+)", command)
    if not match:
        sys.exit(0)

    branch_name = match.group(1)

    # Exempt protected branches
    if branch_name in EXEMPT_BRANCHES:
        sys.exit(0)

    # Check prefix
    if any(branch_name.startswith(prefix) for prefix in VALID_PREFIXES):
        sys.exit(0)

    # Block invalid branch name
    print(json.dumps({
        "decision": "block",
        "reason": (
            f"Invalid branch name: '{branch_name}'\n"
            f"Branch must start with one of: {', '.join(VALID_PREFIXES)}\n"
            f"Examples:\n"
            f"  feat/poster-generation\n"
            f"  fix/brand-context-inject\n"
            f"  chore/update-dependencies\n"
            f"  docs/api-routes\n"
            f"  refactor/brief-intake-flow"
        )
    }))
    sys.exit(0)


if __name__ == "__main__":
    main()
