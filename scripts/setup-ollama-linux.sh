#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  exec sudo -E "$0" "$@"
fi

OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.2:3b}"
OLLAMA_HOST="${OLLAMA_HOST:-127.0.0.1:11434}"
OLLAMA_ORIGINS="${OLLAMA_ORIGINS:-http://127.0.0.1:4173,http://localhost:4173}"
OLLAMA_INSTALL_URL="${OLLAMA_INSTALL_URL:-https://ollama.com/install.sh}"

log() {
  printf '\n==> %s\n' "$*"
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

install_packages() {
  if command -v apt-get >/dev/null 2>&1; then
    log "Installing Ollama setup dependencies"
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      ca-certificates \
      curl
    return
  fi

  command -v curl >/dev/null 2>&1 || fail "curl is required to install Ollama"
}

install_ollama() {
  if command -v ollama >/dev/null 2>&1; then
    log "Ollama already installed"
    ollama --version || true
    return
  fi

  log "Installing Ollama"
  curl -fsSL "$OLLAMA_INSTALL_URL" | sh
}

configure_ollama_service() {
  if ! command -v systemctl >/dev/null 2>&1; then
    fail "systemd is required for this Linux setup script"
  fi

  log "Configuring Ollama systemd service"
  install -d -m 755 /etc/systemd/system/ollama.service.d
  cat > /etc/systemd/system/ollama.service.d/soulecho.conf <<EOF
[Service]
Environment="OLLAMA_HOST=$OLLAMA_HOST"
Environment="OLLAMA_ORIGINS=$OLLAMA_ORIGINS"
EOF

  systemctl daemon-reload
  systemctl enable --now ollama.service
  systemctl restart ollama.service
}

wait_for_ollama() {
  local url="http://$OLLAMA_HOST/api/tags"
  local attempt

  log "Waiting for Ollama at $url"
  for attempt in {1..40}; do
    if curl -fsS "$url" >/dev/null; then
      return
    fi
    sleep 0.5
  done

  systemctl --no-pager --full status ollama.service || true
  journalctl -u ollama.service -n 80 --no-pager || true
  fail "Ollama did not become healthy at $url"
}

pull_model() {
  log "Pulling $OLLAMA_MODEL"
  env OLLAMA_HOST="$OLLAMA_HOST" ollama pull "$OLLAMA_MODEL"
}

print_summary() {
  log "Ollama ready"
  echo "Host: http://$OLLAMA_HOST"
  echo "Model: $OLLAMA_MODEL"
  echo "Service logs: journalctl -u ollama.service -f"
}

install_packages
install_ollama
configure_ollama_service
wait_for_ollama
pull_model
print_summary
