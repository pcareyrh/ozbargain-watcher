#!/usr/bin/env bash
# Block git add/commit/push when staged (or about-to-stage) content looks like secrets.
set -euo pipefail

input=$(cat)
command=$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("command") or "")')

if ! printf '%s' "$command" | python3 -c 'import re,sys; raise SystemExit(0 if re.search(r"(^|[\s;|&])git\s+(commit|push|add)\b", sys.stdin.read()) else 1)'; then
  printf '%s\n' '{"permission":"allow"}'
  exit 0
fi

# Prefer scanning the index for commit/push; for git add, scan working-tree paths being added.
findings=$(
  COMMAND="$command" python3 - <<'PY'
import os, re, subprocess, shlex, sys

command = os.environ.get("COMMAND", "")

PATTERNS = [
    ("private-key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----")),
    ("aws-access-key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("github-token", re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}\b")),
    ("github-pat", re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}\b")),
    ("stripe-live-key", re.compile(r"\bsk_live_[A-Za-z0-9]{16,}\b")),
    ("slack-token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b")),
    ("google-api-key", re.compile(r"\bAIza[0-9A-Za-z\-_]{35}\b")),
    ("jwt", re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b")),
    ("vercel-token", re.compile(r"\bvercel_[A-Za-z0-9_]{20,}\b", re.I)),
    ("generic-secret-assign", re.compile(
        r"(?i)\b(?:api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token|password|private[_-]?key)\b\s*[=:]\s*['\"][^'\"]{8,}['\"]"
    )),
]

SENSITIVE_PATH = re.compile(
    r"(?:^|/)\.env(?:\..+)?$|(?:^|/)(?:credentials|secrets?)\.(?:json|ya?ml|toml)$|(?:^|/)id_rsa(?:\.pub)?$",
    re.I,
)
ALLOW_PATH = re.compile(r"(?:^|/)\.env\.example$|(?:^|/)[^/]*example[^/]*$", re.I)

findings = []


def add_finding(path, rule, detail=""):
    msg = f"{path}: {rule}"
    if detail:
        msg += f" ({detail})"
    if msg not in findings:
        findings.append(msg)


def scan_text(path, text):
    # Skip obvious lockfiles / binaries noise
    if path.endswith((".lock", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip")):
        return
    for name, rx in PATTERNS:
        if rx.search(text):
            add_finding(path, name)


def staged_names():
    try:
        out = subprocess.check_output(
            ["git", "diff", "--cached", "--name-only", "-z"],
            stderr=subprocess.DEVNULL,
        )
    except subprocess.CalledProcessError:
        return []
    return [p for p in out.decode("utf-8", "replace").split("\0") if p]


def staged_patch():
    try:
        return subprocess.check_output(
            ["git", "diff", "--cached", "--unified=0"],
            stderr=subprocess.DEVNULL,
        ).decode("utf-8", "replace")
    except subprocess.CalledProcessError:
        return ""


def parse_git_add_paths(cmd: str):
    try:
        parts = shlex.split(cmd)
    except ValueError:
        parts = cmd.split()
    while parts and "=" in parts[0] and not parts[0].startswith("-"):
        parts = parts[1:]
    try:
        git_idx = next(i for i, p in enumerate(parts) if p == "git" or p.endswith("/git"))
    except StopIteration:
        return []
    args = parts[git_idx + 1 :]
    if not args or args[0] != "add":
        return []
    paths = []
    i = 1
    while i < len(args):
        a = args[i]
        if a == "--":
            paths.extend(args[i + 1 :])
            break
        if a.startswith("-"):
            if a in {"-e", "--edit", "--pathspec-from-file"} and i + 1 < len(args):
                i += 2
                continue
            i += 1
            continue
        paths.append(a)
        i += 1
    return paths


is_add = bool(re.search(r"(^|[\s;|&])git\s+add\b", command))
is_commit_or_push = bool(re.search(r"(^|[\s;|&])git\s+(commit|push)\b", command))

# Path-based checks
paths = staged_names() if is_commit_or_push or not is_add else parse_git_add_paths(command)
if is_add and not paths:
    # git add -A / . → check common secret filenames in the working tree status
    try:
        status = subprocess.check_output(
            ["git", "status", "--porcelain", "-z"],
            stderr=subprocess.DEVNULL,
        ).decode("utf-8", "replace")
        entries = [e for e in status.split("\0") if e]
        for e in entries:
            # porcelain -z: XY PATH or XY ORIG\0PATH for renames; keep simple
            path = e[3:] if len(e) > 3 else e
            if path:
                paths.append(path)
    except subprocess.CalledProcessError:
        pass

for path in paths:
    if ALLOW_PATH.search(path):
        continue
    if SENSITIVE_PATH.search(path):
        add_finding(path, "sensitive-filename")

# Content checks
if is_commit_or_push or (is_add and staged_names()):
    patch = staged_patch()
    current = None
    body = []
    for line in patch.splitlines():
        if line.startswith("+++ b/"):
            if current and body:
                scan_text(current, "\n".join(body))
            current = line[6:]
            body = []
        elif line.startswith("+") and not line.startswith("+++"):
            body.append(line[1:])
    if current and body:
        scan_text(current, "\n".join(body))
elif is_add:
    for path in paths:
        if ALLOW_PATH.search(path) or not os.path.isfile(path):
            continue
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read(200_000)
        except OSError:
            continue
        scan_text(path, text)

if findings:
    summary = "; ".join(findings[:8])
    if len(findings) > 8:
        summary += f"; …and {len(findings) - 8} more"
    print(summary)
    sys.exit(1)
sys.exit(0)
PY
) || true

if [[ -n "${findings}" ]]; then
  python3 -c 'import json,sys; s=sys.argv[1]; print(json.dumps({"permission":"deny","user_message":"Secret scan blocked this git command: "+s,"agent_message":"secret-scan denied: "+s}))' "$findings"
  exit 2
fi

printf '%s\n' '{"permission":"allow"}'
exit 0
