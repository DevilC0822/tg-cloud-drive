#!/usr/bin/env sh
set -eu

ID_FILE="${TELEGRAM_API_ID_FILE:-/var/lib/tgcd-runtime/self-hosted-bot-api/telegram_api_id}"
HASH_FILE="${TELEGRAM_API_HASH_FILE:-/var/lib/tgcd-runtime/self-hosted-bot-api/telegram_api_hash}"
POLL_SECONDS="${TGCD_CREDENTIAL_POLL_SECONDS:-2}"

CHILD_PID=""

log() {
  echo "[tgcd-self-hosted-bot-api] $*"
}

has_credentials() {
  [ -s "$ID_FILE" ] && [ -s "$HASH_FILE" ]
}

credentials_checksum() {
  if ! has_credentials; then
    echo ""
    return
  fi
  cat "$ID_FILE" "$HASH_FILE" | sha256sum | awk '{print $1}'
}

stop_child() {
  if [ -z "$CHILD_PID" ]; then
    return
  fi
  if kill -0 "$CHILD_PID" 2>/dev/null; then
    kill -TERM "$CHILD_PID" 2>/dev/null || true
    wait "$CHILD_PID" 2>/dev/null || true
  fi
  CHILD_PID=""
}

cleanup() {
  stop_child
  exit 0
}

trap cleanup INT TERM

wait_for_credentials() {
  while ! has_credentials; do
    log "等待网页写入 API ID / API Hash 凭据文件..."
    sleep "$POLL_SECONDS"
  done
}

run_loop() {
  while :; do
    wait_for_credentials
    checksum="$(credentials_checksum)"
    log "凭据已就绪，启动 telegram-bot-api 服务"

    /docker-entrypoint.sh &
    CHILD_PID="$!"

    while kill -0 "$CHILD_PID" 2>/dev/null; do
      sleep "$POLL_SECONDS"
      new_checksum="$(credentials_checksum)"
      if [ -n "$new_checksum" ] && [ "$new_checksum" != "$checksum" ]; then
        log "检测到凭据变更，重启 telegram-bot-api 服务"
        stop_child
        break
      fi
    done

    if [ -n "$CHILD_PID" ] && ! kill -0 "$CHILD_PID" 2>/dev/null; then
      wait "$CHILD_PID" 2>/dev/null || true
      CHILD_PID=""
      log "telegram-bot-api 进程已退出，稍后自动重启"
      sleep 1
    fi
  done
}

run_loop
