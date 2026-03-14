#!/usr/bin/env bash
set -euo pipefail
API_URL=${API_URL:-}
if [ -z "${API_URL}" ]; then
  CANDIDATES=("http://192.168.15.8:3002" "http://localhost:3002" "http://127.0.0.1:3002" "http://0.0.0.0:3002")
  for c in "${CANDIDATES[@]}"; do
    if curl -s -o /dev/null -m 2 -w "%{http_code}" "$c/" | grep -E '^[23|45]' >/dev/null 2>&1; then
      API_URL=$c
      break
    fi
  done
  API_URL=${API_URL:-http://192.168.15.8:3002}
fi
COOKIE_JAR=/tmp/keepup_integration_cookies
rm -f "$COOKIE_JAR"
USER_SUFFIX=$(date +%s)
NAME="Integration Tester"
USERNAME="int_user_${USER_SUFFIX}"
EMAIL="${USERNAME}@example.local"
PASSWORD="TestPass123!"

echo "API_URL=$API_URL"
echo "Registering user: $USERNAME ($EMAIL)"
REGISTER_RESPONSE=$(printf '%s' "{\"name\":\"$NAME\",\"username\":\"$USERNAME\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | \
  curl -sS -w "\n%{http_code}" -c "$COOKIE_JAR" -X POST -H 'Content-Type: application/json' -d @- "$API_URL/api/auth/register")

HTTP=$(printf '%s' "$REGISTER_RESPONSE" | tail -n1)
BODY=$(printf '%s' "$REGISTER_RESPONSE" | sed '$d')

echo "Register HTTP: $HTTP"
echo "Register body: $BODY"

if [ "$HTTP" != "200" ]; then
  echo "Registration failed" >&2
  exit 1
fi

echo "Logging in (to refresh session cookie)"
LOGIN_RESPONSE=$(printf '%s' "{\"email\":\"$EMAIL\",\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" | \
  curl -sS -w "\n%{http_code}" -c "$COOKIE_JAR" -X POST -H 'Content-Type: application/json' -d @- "$API_URL/api/auth/login")

HTTP=$(printf '%s' "$LOGIN_RESPONSE" | tail -n1)
BODY=$(printf '%s' "$LOGIN_RESPONSE" | sed '$d')

echo "Login HTTP: $HTTP"
echo "Login body: $BODY"

if [ "$HTTP" != "200" ]; then
  echo "Login failed" >&2
  exit 1
fi

echo "Verifying session with cookie jar"
CHECK_RESPONSE=$(curl -sS -w "\n%{http_code}" -b "$COOKIE_JAR" "$API_URL/api/auth/check")
HTTP=$(printf '%s' "$CHECK_RESPONSE" | tail -n1)
BODY=$(printf '%s' "$CHECK_RESPONSE" | sed '$d')

echo "Check HTTP: $HTTP"
echo "Check body: $BODY"

if [ "$HTTP" != "200" ]; then
  echo "Session check failed" >&2
  exit 1
fi

echo "Integration test succeeded. Cookie jar: $COOKIE_JAR"
exit 0
