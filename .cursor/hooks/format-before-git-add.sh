#!/usr/bin/env bash
# Format source files before `git add` so the staged copy is clean.
set -euo pipefail

input=$(cat)
command=$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("command") or "")')

if ! printf '%s' "$command" | python3 -c 'import re,sys; raise SystemExit(0 if re.search(r"(^|[\s;|&])git\s+add\b", sys.stdin.read()) else 1)'; then
  printf '%s\n' '{"permission":"allow"}'
  exit 0
fi

mapfile -t targets < <(
  COMMAND="$command" python3 - <<'PY'
import os, shlex

cmd = os.environ.get("COMMAND", "")
try:
    parts = shlex.split(cmd)
except ValueError:
    parts = cmd.split()

while parts and "=" in parts[0] and not parts[0].startswith("-"):
    parts = parts[1:]

try:
    git_idx = next(i for i, p in enumerate(parts) if p == "git" or p.endswith("/git"))
except StopIteration:
    raise SystemExit(0)

args = parts[git_idx + 1 :]
if not args or args[0] != "add":
    raise SystemExit(0)

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

# Broad adds: format app sources (not shell globs — those never expand here)
if not paths or any(p in {".", "-A", "--all", "-u", "--update"} for p in paths):
    print("src")
    print("scripts")
else:
    for p in paths:
        print(p)
PY
)

if [[ ${#targets[@]} -eq 0 ]]; then
  printf '%s\n' '{"permission":"allow"}'
  exit 0
fi

eslint_bin="./node_modules/.bin/eslint"
if [[ ! -x "$eslint_bin" ]]; then
  printf '%s\n' '{"permission":"deny","user_message":"eslint is missing. Run npm install, then retry git add.","agent_message":"format-before-git-add: ./node_modules/.bin/eslint not found."}'
  exit 2
fi

files=()
for t in "${targets[@]}"; do
  if [[ -d "$t" ]]; then
    while IFS= read -r -d '' f; do
      files+=("$f")
    done < <(find "$t" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.mjs' -o -name '*.cjs' \) -print0 2>/dev/null || true)
  elif [[ -f "$t" ]]; then
    case "$t" in
      *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs) files+=("$t") ;;
    esac
  fi
done

if [[ ${#files[@]} -gt 0 ]]; then
  mapfile -t files < <(printf '%s\n' "${files[@]}" | awk 'NF && !seen[$0]++')
fi

formatted=0
if [[ ${#files[@]} -gt 0 ]]; then
  # Apply auto-fixes; remaining lint errors should not block staging.
  set +e
  "$eslint_bin" --fix --no-error-on-unmatched-pattern "${files[@]}" >/tmp/ozbargain-eslint-fix.log 2>&1
  set -e
  formatted=${#files[@]}
fi

msg="Formatted ${formatted} file(s) with eslint --fix before git add."
python3 -c 'import json,sys; print(json.dumps({"permission":"allow","user_message":sys.argv[1],"agent_message":sys.argv[1]}))' "$msg"
exit 0
