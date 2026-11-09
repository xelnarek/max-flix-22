#!/usr/bin/env bash
set -uo pipefail

if [ "$#" -eq 0 ]; then
  echo "Usage: retry-command.sh COMMAND [ARG ...]" >&2
  exit 64
fi

max_attempts="${RETRY_MAX_ATTEMPTS:-3}"
initial_delay="${RETRY_INITIAL_DELAY_SECONDS:-15}"
if [[ ! "$max_attempts" =~ ^[1-9][0-9]*$ ]] || [[ ! "$initial_delay" =~ ^[0-9]+$ ]]; then
  echo "Retry settings must be non-negative integers; max attempts must be at least one." >&2
  exit 64
fi

log_file="$(mktemp)"
trap 'rm -f "$log_file"' EXIT
delay="$initial_delay"

for ((attempt = 1; attempt <= max_attempts; attempt++)); do
  : > "$log_file"
  echo "Attempt $attempt/$max_attempts: $*"
  "$@" 2>&1 | tee "$log_file"
  status="${PIPESTATUS[0]}"

  if [ "$status" -eq 0 ]; then
    exit 0
  fi

  # Retry only network/service failures. Deterministic compiler, test and
  # configuration errors should fail immediately rather than waste CI time.
  if ! grep -Eiq '(^|[^0-9])5[0-9]{2}([^0-9]|$)|gateway time[- ]out|timed? ?out|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|temporary failure|connection reset|connection closed|socket hang up|TLS handshake timeout' "$log_file"; then
    echo "Command failed with exit $status; no transient network error detected, not retrying." >&2
    exit "$status"
  fi

  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "Transient network failure persisted after $max_attempts attempts." >&2
    exit "$status"
  fi

  echo "Transient network failure detected. Retrying in ${delay}s." >&2
  sleep "$delay"
  delay=$((delay * 2))
done

exit 1
