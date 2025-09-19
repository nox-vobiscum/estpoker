
#!/usr/bin/env bash
set -euo pipefail

BASE="${1:-https://ep-api.noxvobiscum.at}"   # 1st arg: base URL
CODE="${2:-alpha123}"                        # 2nd arg: room code
PASS="${3:-s3cret!}"                         # 3rd arg: password to set/check
CLEANUP="${CLEANUP:-false}"                  # set CLEANUP=true to delete at the end

HDR_CT='Content-Type: application/json'
ok=0; fail=0

request() { # request METHOD URL [curl-args...]; echos "HTTP|/tmp/body"
  local method="$1" url="$2"; shift 2
  local body; body="$(mktemp)"
  local code; code="$(curl -sS -o "$body" -w "%{http_code}" -X "$method" "$url" "$@")"
  echo "$code|$body"
}

assert_http() { # expected actual
  [[ "$2" == "$1" ]] && { echo "✓ HTTP $1"; ((ok++)); } || { echo "✗ HTTP expected $1 got $2"; ((fail++)); }
}
assert_contains() { # needle file
  if grep -q "$1" "$2"; then echo "  ✓ contains: $1"; ((ok++)); else echo "  ✗ missing: $1"; cat "$2"; ((fail++)); fi
}

echo "== Upsert =="
IFS='|' read -r code body < <(request PUT "$BASE/api/rooms/$CODE" -H "$HDR_CT" \
  --data "{\"title\":\"Alpha\",\"owner\":\"Host\",\"sequenceId\":\"fib.scrum\",\"autoRevealEnabled\":true,\"allowSpecials\":true,\"topicVisible\":false}")
assert_http 200 "$code"
assert_contains "\"code\":\"$CODE\"" "$body"

echo "== Exists =="
IFS='|' read -r code body < <(request GET "$BASE/api/rooms/$CODE/exists")
assert_http 200 "$code"
assert_contains "\"exists\":true" "$body"

echo "== Get =="
IFS='|' read -r code body < <(request GET "$BASE/api/rooms/$CODE")
assert_http 200 "$code"
assert_contains "\"title\":\"Alpha\"" "$body"

echo "== Set password =="
IFS='|' read -r code body < <(request POST "$BASE/api/rooms/$CODE/set-password" -H "$HDR_CT" \
  --data "{\"password\":\"$PASS\"}")
assert_http 204 "$code"

echo "== Check password (correct) =="
IFS='|' read -r code body < <(request POST "$BASE/api/rooms/$CODE/password/check" -H "$HDR_CT" \
  --data "{\"password\":\"$PASS\"}")
assert_http 200 "$code"
assert_contains "\"ok\":true" "$body"

echo "== Check password (wrong) =="
IFS='|' read -r code body < <(request POST "$BASE/api/rooms/$CODE/password/check" -H "$HDR_CT" \
  --data "{\"password\":\"WRONG\"}")
assert_http 200 "$code"
assert_contains "\"ok\":false" "$body"

if [[ "$CLEANUP" == "true" ]]; then
  echo "== Delete =="
  IFS='|' read -r code body < <(request DELETE "$BASE/api/rooms/$CODE")
  assert_http 204 "$code"
fi

echo
echo "Result: $ok ok, $fail failed"
exit $(( fail > 0 ? 1 : 0 ))
