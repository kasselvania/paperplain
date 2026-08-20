#!/bin/zsh

set -u

PROJECT_DIR=${0:A:h}
PORT=4173
URL="http://127.0.0.1:${PORT}"
WORK_DIR="${PROJECT_DIR}/work"
PID_FILE="${WORK_DIR}/paperplain-server.pid"
SERVER_PID=""

pause_on_error() {
  if [[ -t 0 ]]; then
    printf "\nPress Return to close this window."
    read -r
  fi
}

fail() {
  printf "\nPaperplain could not start: %s\n" "$1" >&2
  pause_on_error
  exit 1
}

cleanup() {
  if [[ -n "${SERVER_PID}" ]] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill -TERM "${SERVER_PID}" 2>/dev/null
    wait "${SERVER_PID}" 2>/dev/null
  fi
  /bin/rm -f "${PID_FILE}"
}

trap cleanup EXIT INT TERM HUP

printf '\033]0;Paperplain local demo\007'
printf "Paperplain local demo\n"
printf '%s\n' '---------------------'

cd "${PROJECT_DIR}" || fail "the project folder is unavailable."

NODE_BIN=$(command -v node) || fail "Node.js 22.13 or newer is required."
command -v java >/dev/null 2>&1 || fail "Java 11 or newer is required."

if [[ ! -f "${PROJECT_DIR}/node_modules/@opendataloader/pdf/package.json" ]]; then
  fail "dependencies are missing. Run 'npm install' in this folder once."
fi

/bin/mkdir -p "${WORK_DIR}" || fail "the local work folder could not be created."

printf "Starting a localhost-only service at %s\n" "${URL}"
"${NODE_BIN}" server.mjs &
SERVER_PID=$!
printf "%s\n" "${SERVER_PID}" > "${PID_FILE}"

for attempt in {1..50}; do
  if ! kill -0 "${SERVER_PID}" 2>/dev/null; then
    wait "${SERVER_PID}"
    fail "the Node service exited before it became ready."
  fi

  if /usr/bin/curl --fail --silent --show-error --max-time 1 \
    "${URL}/api/samples" >/dev/null 2>&1; then
    /usr/bin/open "${URL}" || fail "the default browser could not be opened."
    printf "Ready. Keep this window open; press Control-C to stop Paperplain.\n\n"
    wait "${SERVER_PID}"
    exit $?
  fi

  /bin/sleep 0.2
done

fail "the localhost health check timed out."
