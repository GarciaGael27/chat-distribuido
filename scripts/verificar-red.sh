#!/usr/bin/env bash
# scripts/verificar-red.sh
# Verifica, con curl, que el servidor del chat es alcanzable desde esta máquina.
# Útil en la RHEL de solo terminal antes de abrir el cliente.
#
# Uso:
#   ./scripts/verificar-red.sh http://192.168.1.50:31234
#   ./scripts/verificar-red.sh http://localhost:3000

set -u
URL="${1:-http://localhost:3000}"

echo "Verificando servidor en: $URL"
echo "-----------------------------------------"

check() {
  local ruta="$1" desc="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${URL}${ruta}")
  if [ "$code" = "200" ]; then
    echo "  [OK]    $desc  (HTTP $code)"
  else
    echo "  [FALLO] $desc  (HTTP $code)"
    return 1
  fi
}

fallos=0
check "/"                         "Página / (liveness)"        || fallos=$((fallos+1))
check "/socket.io/socket.io.js"   "Cliente Socket.io"          || fallos=$((fallos+1))
check "/client.js"                "client.js"                  || fallos=$((fallos+1))
check "/style.css"                "style.css"                  || fallos=$((fallos+1))

echo "-----------------------------------------"
if [ "$fallos" -eq 0 ]; then
  echo "Servidor alcanzable. Puedes abrir el chat o usar cliente-terminal.js."
  exit 0
else
  echo "Hay $fallos comprobación(es) fallida(s)."
  echo "Revisa: IP correcta, puerto NodePort, firewall (firewall-cmd) y red bridged."
  exit 1
fi
