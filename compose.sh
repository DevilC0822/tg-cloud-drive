#!/usr/bin/env bash
set -euo pipefail

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

if [[ "$command_name" == "up" ]] && ! has_explicit_service_name; then
  if [[ "$mode" == "dev" ]]; then
    remove_service_if_present "frontend"
    compose_args+=(frontend-dev)
  else
    remove_service_if_present "frontend-dev"
  fi
fi

exec docker compose "${compose_args[@]}"
