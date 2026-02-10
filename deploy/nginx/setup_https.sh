#!/usr/bin/env bash
set -euo pipefail

# TG Cloud Drive 一键 HTTPS 部署脚本（Debian / Ubuntu）
# 功能：
# 1) 安装 Nginx + Certbot（如未安装）
# 2) 创建 Nginx 反向代理站点（默认转发到 127.0.0.1:3000）
# 3) 自动申请 Let's Encrypt 证书并开启 HTTP->HTTPS 重定向

SCRIPT_NAME="$(basename "$0")"
DOMAIN=""
EMAIL=""
UPSTREAM="127.0.0.1:3000"
SITE_NAME=""
DRY_RUN="false"
SKIP_INSTALL="false"

usage() {
  cat <<EOF
用法:
  sudo ./${SCRIPT_NAME} --domain example.com --email admin@example.com [选项]

必填参数:
  --domain <域名>            访问域名（需已解析到本机公网 IP）
  --email <邮箱>             Let's Encrypt 注册邮箱

可选参数:
  --upstream <地址>          反代上游，默认: 127.0.0.1:3000
  --site-name <名称>         Nginx 站点名，默认: tgcd-<domain>
  --dry-run                  使用 Let's Encrypt 测试环境演练
  --skip-install             跳过 apt 安装步骤（已安装环境可用）
  -h, --help                 显示帮助

示例:
  sudo ./${SCRIPT_NAME} --domain pan.example.com --email ops@example.com
  sudo ./${SCRIPT_NAME} --domain pan.example.com --email ops@example.com --upstream 127.0.0.1:3000 --dry-run
EOF
}

log() {
  printf '[tgcd-https] %s\n' "$*"
}

err() {
  printf '[tgcd-https] 错误: %s\n' "$*" >&2
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    err "请使用 root 或 sudo 运行脚本"
    exit 1
  fi
}

require_cmd() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    err "缺少命令: ${cmd}"
    exit 1
  fi
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --domain)
        DOMAIN="${2:-}"
        shift 2
        ;;
      --email)
        EMAIL="${2:-}"
        shift 2
        ;;
      --upstream)
        UPSTREAM="${2:-}"
        shift 2
        ;;
      --site-name)
        SITE_NAME="${2:-}"
        shift 2
        ;;
      --dry-run)
        DRY_RUN="true"
        shift
        ;;
      --skip-install)
        SKIP_INSTALL="true"
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        err "未知参数: $1"
        usage
        exit 1
        ;;
    esac
  done
}

validate_args() {
  if [[ -z "${DOMAIN}" ]]; then
    err "--domain 不能为空"
    exit 1
  fi
  if [[ -z "${EMAIL}" ]]; then
    err "--email 不能为空"
    exit 1
  fi
  if [[ -z "${SITE_NAME}" ]]; then
    SITE_NAME="tgcd-${DOMAIN}"
  fi
  # 文件名安全处理，避免特殊字符影响路径
  SITE_NAME="$(echo "${SITE_NAME}" | tr -cd 'a-zA-Z0-9._-')"
  if [[ -z "${SITE_NAME}" ]]; then
    err "站点名非法，请使用 --site-name 指定"
    exit 1
  fi
}

install_packages_if_needed() {
  if [[ "${SKIP_INSTALL}" == "true" ]]; then
    log "已跳过依赖安装（--skip-install）"
    return
  fi

  require_cmd apt-get
  log "安装依赖：nginx certbot python3-certbot-nginx"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y nginx certbot python3-certbot-nginx
}

check_dns_hint() {
  if command -v getent >/dev/null 2>&1; then
    if ! getent ahosts "${DOMAIN}" >/dev/null 2>&1; then
      err "当前主机无法解析域名 ${DOMAIN}，请先完成 DNS A/AAAA 记录配置"
      exit 1
    fi
  fi
}

write_nginx_site() {
  local conf_path="/etc/nginx/sites-available/${SITE_NAME}.conf"
  local enabled_path="/etc/nginx/sites-enabled/${SITE_NAME}.conf"

  log "写入 Nginx 站点配置: ${conf_path}"
  cat > "${conf_path}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    # 网盘场景可能存在大文件上传
    client_max_body_size 0;

    location / {
        proxy_pass http://${UPSTREAM};
        proxy_http_version 1.1;
        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$http_host;
        proxy_set_header X-Forwarded-Port \$server_port;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_buffering off;
        proxy_request_buffering off;
    }
}
EOF

  ln -sfn "${conf_path}" "${enabled_path}"
}

reload_nginx() {
  require_cmd nginx
  if [[ -f "/etc/nginx/sites-enabled/default" ]]; then
    # 默认站点可能抢占 80，首次部署时移除可避免冲突
    rm -f "/etc/nginx/sites-enabled/default"
  fi
  nginx -t
  systemctl enable --now nginx
  systemctl reload nginx
}

issue_certificate() {
  require_cmd certbot

  local certbot_args=(
    --nginx
    -d "${DOMAIN}"
    --non-interactive
    --agree-tos
    --email "${EMAIL}"
    --redirect
  )
  if [[ "${DRY_RUN}" == "true" ]]; then
    certbot_args+=(--dry-run)
    log "开始证书演练（dry-run）"
  else
    log "开始申请正式证书"
  fi

  certbot "${certbot_args[@]}"
}

show_result() {
  local cert_status_cmd="certbot certificates"
  log "部署完成"
  log "访问地址: https://${DOMAIN}"
  log "当前证书信息可执行: ${cert_status_cmd}"
  log "自动续期状态可执行: systemctl list-timers | grep certbot"
}

main() {
  parse_args "$@"
  require_root
  validate_args
  check_dns_hint
  install_packages_if_needed
  write_nginx_site
  reload_nginx
  issue_certificate
  show_result
}

main "$@"

