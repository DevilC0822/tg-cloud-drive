#!/usr/bin/env bash
set -euo pipefail

readonly CUSTOM_COMMAND_STATUS="status"
readonly CUSTOM_COMMAND_CLEANUP="cleanup"
readonly CLEANUP_IMAGE_LABEL="悬空镜像"
readonly CLEANUP_CONTAINER_LABEL="已停止容器"
readonly CLEANUP_VOLUME_LABEL="未使用数据卷"
readonly CLEANUP_NETWORK_LABEL="未使用网络"
readonly CLEANUP_CACHE_LABEL="构建缓存"

mode="build"
args=("$@")

if (($# > 0)); then
  last_index=$(($# - 1))
  last_arg="${args[$last_index]}"

  if [[ "$last_arg" == "dev" || "$last_arg" == "build" ]]; then
    mode="$last_arg"
    unset 'args[$last_index]'
    args=("${args[@]}")
  fi
fi

command_name=""
for arg in "${args[@]}"; do
  if [[ "$arg" != -* ]]; then
    command_name="$arg"
    break
  fi
done

has_explicit_service_name() {
  for arg in "${args[@]}"; do
    case "$arg" in
      postgres|telegram-bot-api|qbittorrent|backend|frontend|frontend-dev)
        return 0
        ;;
    esac
  done

  return 1
}

print_section() {
  local title="$1"

  printf '\n== %s ==\n' "$title"
}

run_status_command() {
  local title="$1"
  shift

  print_section "$title"
  "$@" || true
}

print_status() {
  run_status_command "Docker 磁盘占用总览" docker system df
  run_status_command "当前项目容器" docker compose ps --all
  run_status_command "当前项目容器（dev profile）" docker compose --profile dev ps --all
  run_status_command "全部容器" docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Size}}"
  run_status_command "悬空镜像" docker images --filter dangling=true
  run_status_command "未使用数据卷" docker volume ls -f dangling=true
  run_status_command "构建缓存" docker builder du
}

run_cleanup_step() {
  local label="$1"
  shift

  print_section "清理${label}"
  "$@"
}

run_cleanup() {
  run_status_command "清理前 Docker 磁盘占用" docker system df
  run_cleanup_step "$CLEANUP_IMAGE_LABEL" docker image prune -f
  run_cleanup_step "$CLEANUP_CONTAINER_LABEL" docker container prune -f
  run_cleanup_step "$CLEANUP_VOLUME_LABEL" docker volume prune -f
  run_cleanup_step "$CLEANUP_NETWORK_LABEL" docker network prune -f
  run_cleanup_step "$CLEANUP_CACHE_LABEL" docker builder prune -a -f
  run_status_command "清理后 Docker 磁盘占用" docker system df
}

remove_service_if_present() {
  local service_name="$1"
  local remove_args=(rm -sf "$service_name")

  if [[ "$service_name" == "frontend-dev" ]]; then
    remove_args=(--profile dev "${remove_args[@]}")
  fi

  echo "Switching frontend mode: removing $service_name container if present." >&2
  docker compose "${remove_args[@]}" >/dev/null 2>&1 || true
}

compose_args=()
if [[ "$mode" == "dev" ]]; then
  compose_args+=(--profile dev)
fi
compose_args+=("${args[@]}")

case "$command_name" in
  "$CUSTOM_COMMAND_STATUS")
    print_status
    exit 0
    ;;
  "$CUSTOM_COMMAND_CLEANUP")
    run_cleanup
    exit 0
    ;;
esac

if [[ "$command_name" == "up" ]] && ! has_explicit_service_name; then
  if [[ "$mode" == "dev" ]]; then
    remove_service_if_present "frontend"
    compose_args+=(frontend-dev)
  else
    remove_service_if_present "frontend-dev"
  fi
fi

exec docker compose "${compose_args[@]}"
