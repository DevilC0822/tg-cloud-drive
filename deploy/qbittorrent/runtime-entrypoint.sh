#!/bin/sh
set -eu

QBT_LISTEN_PORT="${QBT_LISTEN_PORT:-45000}"
QBT_DOWNLOAD_DIR="${QBT_DOWNLOAD_DIR:-/var/lib/tgcd-torrent-data}"
QBT_PROFILE_DIR="${QBT_PROFILE_DIR:-/config}"
QBT_CONFIG_FILE="${QBT_PROFILE_DIR}/qBittorrent/config/qBittorrent.conf"

log() {
  echo "[tgcd-qbt] $*"
}

set_or_append_kv() {
  key="$1"
  value="$2"
  file="$3"
  tmp="${file}.tmp.$$"
  awk -v k="$key" -v v="$value" '
    BEGIN { replaced = 0 }
    index($0, k "=") == 1 {
      if (replaced == 0) {
        print k "=" v
        replaced = 1
      }
      next
    }
    { print }
    END {
      if (replaced == 0) {
        print k "=" v
      }
    }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

mkdir -p "$QBT_DOWNLOAD_DIR" "$QBT_DOWNLOAD_DIR/temp" "$(dirname "$QBT_CONFIG_FILE")"

# 确保下载目录在首次启动即对 qBittorrent 进程可写。
if id qbtUser >/dev/null 2>&1; then
  chown -R qbtUser:qbtUser "$QBT_DOWNLOAD_DIR" || true
fi

if [ ! -f "$QBT_CONFIG_FILE" ]; then
  cat > "$QBT_CONFIG_FILE" <<EOF
[BitTorrent]
Session\DefaultSavePath=${QBT_DOWNLOAD_DIR}
Session\Port=${QBT_LISTEN_PORT}
Session\TempPath=${QBT_DOWNLOAD_DIR}/temp

[LegalNotice]
Accepted=true
EOF
fi

if ! grep -Fxq "[BitTorrent]" "$QBT_CONFIG_FILE"; then
  printf "\n[BitTorrent]\n" >> "$QBT_CONFIG_FILE"
fi
if ! grep -Fxq "[Preferences]" "$QBT_CONFIG_FILE"; then
  printf "\n[Preferences]\n" >> "$QBT_CONFIG_FILE"
fi

# 清理历史错误键（早期脚本将反斜杠键误写成无反斜杠版本）。
sed -i '/^SessionPort=/d;/^SessionDefaultSavePath=/d;/^SessionTempPath=/d' "$QBT_CONFIG_FILE"

set_or_append_kv 'Session\\Port' "$QBT_LISTEN_PORT" "$QBT_CONFIG_FILE"
set_or_append_kv 'Session\\DefaultSavePath' "$QBT_DOWNLOAD_DIR" "$QBT_CONFIG_FILE"
set_or_append_kv 'Session\\TempPath' "${QBT_DOWNLOAD_DIR}/temp" "$QBT_CONFIG_FILE"

# 允许通过端口映射地址访问 WebUI，避免 Host header 端口不一致导致 401。
set_or_append_kv 'WebUI\\HostHeaderValidation' "false" "$QBT_CONFIG_FILE"
set_or_append_kv 'WebUI\\ServerDomains' "*" "$QBT_CONFIG_FILE"

log "qBittorrent 监听端口固定为 ${QBT_LISTEN_PORT}"
log "下载目录权限已初始化: ${QBT_DOWNLOAD_DIR}"

exec /entrypoint.sh "$@"
