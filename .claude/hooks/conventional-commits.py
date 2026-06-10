#!/usr/bin/env python3
"""
PreToolUse hook — validates commit messages follow conventional commits format.
Enforces: type(scope): description
Valid types: feat, fix, chore, docs, refactor, style, test, perf
"""

import json
import re
import sys

VALID_TYPES = ["feat", "fix", "chore", "docs", "refactor", "style", "test", "perf"]

# Matches: type(scope): description  OR  type: description
COMMIT_PATTERN = re.compile(
    r'^(' + '|'.join(VALID_TYPES) + r')(\([a-z0-9\-]+\))?: .{10,}'
)


def extract_commit_message(command: str) -> str | None:
    """Extract commit message from git commit -m "..." command."""
    # Match -m "..." or -m '...'
    match = re.search(r'git commit[^"\']*-m\s+["\']([^"\']+)["\']', command)
    if match:
        return match.group(1)

    # Match heredoc style (basic)
    match = re.search(r'git commit[^"\']*-m\s+"\$\(cat <<[\'"]?EOF[\'"]?\n(.*?)\nEOF', command, re.DOTALL)
    if match:
        return match.group(1).strip()

    return None


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

    if "git commit" not in command:
        sys.exit(0)

    # Allow --amend without message change
    if "--amend" in command and "-m" not in command:
        sys.exit(0)

    message = extract_commit_message(command)
    if not message:
        sys.exit(0)

    # Check first line only
    first_line = message.strip().split("\n")[0]

    if COMMIT_PATTERN.match(first_line):
        sys.exit(0)

    # Block invalid commit message
    print(json.dumps({
        "decision": "block",
        "reason": (
            f"Invalid commit message: '{first_line}'\n\n"
            f"Must follow conventional commits format:\n"
            f"  type(scope): description  (min 10 chars in description)\n\n"
            f"Valid types: {', '.join(VALID_TYPES)}\n\n"
            f"Examples:\n"
            f"  feat(studio): add poster generation with brand context injection\n"
            f"  fix(brief): validate required fields before triggering generation\n"
            f"  chore(db): add FeatureRun feedback field migration\n"
            f"  docs(claude): update WORKFLOW.md with new route definitions\n"
            f"  refactor(auth): extract session validation into middleware helper"
        )
    }))
    sys.exit(0)


if __name__ == "__main__":
    main()
