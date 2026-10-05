#!/usr/bin/env bash
# =============================================================================
# Verificación del flujo de autenticación, de extremo a extremo.
# =============================================================================
# Levanta el servidor de desarrollo, comprueba que las rutas del panel están
# protegidas y que el inicio de sesión funciona de verdad (no solo que compila).
#
# Uso:  ./scripts/verificar-login.sh
#
# Las credenciales se leen de .env y NUNCA se imprimen.
#
# NOTA: los comandos curl van en una sola línea a propósito. Las continuaciones
# con barra invertida se rompen al copiar el archivo entre entornos.

set -uo pipefail

BASE="${BASE:-http://localhost:3000}"
PUERTO="${PUERTO:-3000}"
COOKIES_BUENAS="$(mktemp)"
COOKIES_MALAS="$(mktemp)"
REGISTRO="$(mktemp)"
PID_SERVIDOR=""

limpiar() {
  rm -f "$COOKIES_BUENAS" "$COOKIES_MALAS" "$REGISTRO"

  if [ -n "$PID_SERVIDOR" ]; then
    # Next arranca procesos hijo, así que matar solo el padre deja el puerto
    # ocupado. Se cierran ambos: el árbol del padre y lo que escuche en el puerto.
    pkill -P "$PID_SERVIDOR" 2>/dev/null
    kill "$PID_SERVIDOR" 2>/dev/null
  fi

  PIDS_PUERTO=$(ss -tlnp 2>/dev/null | grep -E ":${PUERTO}\b" | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
  for p in $PIDS_PUERTO; do
    kill "$p" 2>/dev/null
  done

  sleep 1
}
trap limpiar EXIT

fallos=0

comprobar() {
  if [ "$2" = "$3" ]; then
    echo "  OK    $1: $2"
  else
    echo "  FALLA $1: $2 (esperado $3)"
    fallos=$((fallos + 1))
  fi
}

comprobar_contiene() {
  case "$2" in
    *"$3"*) echo "  OK    $1" ;;
    *) echo "  FALLA $1 (recibido: $2)"; fallos=$((fallos + 1)) ;;
  esac
}

csrf_de() {
  curl -s -c "$1" "$BASE/api/auth/csrf" | sed -E 's/.*"csrfToken":"([^"]+)".*/\1/'
}

# $1=tarro de cookies  $2=csrf  $3=email  $4=password
intentar_login() {
  curl -s -b "$1" -c "$1" -o /dev/null -X POST "$BASE/api/auth/callback/credentials" -H 'Content-Type: application/x-www-form-urlencoded' --data-urlencode "csrfToken=$2" --data-urlencode "email=$3" --data-urlencode "password=$4" --data-urlencode "callbackUrl=$BASE/admin"
}

# --- Credenciales -----------------------------------------------------------
if [ ! -f .env ]; then
  echo "Falta el archivo .env (ver .env.example)."
  exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.env
set +a

if [ -z "${SEED_SUPERADMIN_EMAIL:-}" ] || [ -z "${SEED_SUPERADMIN_PASSWORD:-}" ]; then
  echo "Define SEED_SUPERADMIN_EMAIL y SEED_SUPERADMIN_PASSWORD en .env."
  exit 1
fi

# --- Puerto libre -----------------------------------------------------------
if ss -tlnp 2>/dev/null | grep -qE ":${PUERTO}\b"; then
  echo "El puerto ${PUERTO} ya está en uso. Detén el proceso o usa PUERTO=otro."
  exit 1
fi

# --- Servidor ---------------------------------------------------------------
echo "Levantando el servidor en el puerto ${PUERTO}…"
nohup npm run dev -- --port "$PUERTO" >"$REGISTRO" 2>&1 &
PID_SERVIDOR=$!

listo=0
for _ in $(seq 1 60); do
  if curl -sf -o /dev/null "$BASE/admin/login"; then
    listo=1
    break
  fi
  sleep 2
done

if [ "$listo" -ne 1 ]; then
  echo "El servidor no respondió a tiempo. Últimas líneas del registro:"
  tail -30 "$REGISTRO"
  exit 1
fi

echo "Servidor listo."
echo ""

# --- 1. Rutas protegidas sin sesión ----------------------------------------
echo "== Sin sesión =="

SALIDA_ADMIN=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$BASE/admin")
comprobar_contiene "GET /admin redirige al formulario de acceso" "$SALIDA_ADMIN" "/admin/login"

CODIGO_API=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/orders")
comprobar "GET /api/orders responde 401" "$CODIGO_API" "401"

CODIGO_API_IMPORTAR=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/admin/imports/analyze")
comprobar "POST /api/admin/imports/analyze responde 401" "$CODIGO_API_IMPORTAR" "401"

echo ""

# --- 2. Credenciales incorrectas -------------------------------------------
echo "== Credenciales incorrectas =="

CSRF_MALAS=$(csrf_de "$COOKIES_MALAS")
intentar_login "$COOKIES_MALAS" "$CSRF_MALAS" "$SEED_SUPERADMIN_EMAIL" "contrasena-deliberadamente-incorrecta"

SESION_MALA=$(curl -s -b "$COOKIES_MALAS" "$BASE/api/auth/session")
comprobar "no se crea sesión con contraseña incorrecta" "$SESION_MALA" "null"

CODIGO_CON_MALA=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIES_MALAS" "$BASE/api/orders")
comprobar "la API sigue cerrada con credenciales incorrectas" "$CODIGO_CON_MALA" "401"

echo ""

# --- 3. Inicio de sesión correcto ------------------------------------------
echo "== Credenciales correctas =="

CSRF=$(csrf_de "$COOKIES_BUENAS")
if [ -z "$CSRF" ]; then
  echo "  FALLA no se pudo obtener el token CSRF"
  fallos=$((fallos + 1))
else
  echo "  OK    se obtuvo el token CSRF"
fi

intentar_login "$COOKIES_BUENAS" "$CSRF" "$SEED_SUPERADMIN_EMAIL" "$SEED_SUPERADMIN_PASSWORD"

SESION=$(curl -s -b "$COOKIES_BUENAS" "$BASE/api/auth/session")
comprobar_contiene "la sesión se creó" "$SESION" "$SEED_SUPERADMIN_EMAIL"
comprobar_contiene "la sesión incluye el rol" "$SESION" "SUPERADMIN"

echo ""

# --- 4. Acceso con sesión --------------------------------------------------
echo "== Con sesión =="

CODIGO_PANEL=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIES_BUENAS" "$BASE/admin")
comprobar "GET /admin responde 200" "$CODIGO_PANEL" "200"

CODIGO_ORDENES=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIES_BUENAS" "$BASE/admin/ordenes")
comprobar "GET /admin/ordenes responde 200" "$CODIGO_ORDENES" "200"

CODIGO_IMPORTAR=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIES_BUENAS" "$BASE/admin/importar")
comprobar "GET /admin/importar responde 200" "$CODIGO_IMPORTAR" "200"

CODIGO_LISTA=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIES_BUENAS" "$BASE/admin/importaciones")
comprobar "GET /admin/importaciones responde 200" "$CODIGO_LISTA" "200"

CODIGO_API_OK=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIES_BUENAS" "$BASE/api/orders?pageSize=5")
comprobar "GET /api/orders responde 200" "$CODIGO_API_OK" "200"

CUERPO_ORDENES=$(curl -s -b "$COOKIES_BUENAS" "$BASE/api/orders?pageSize=5")
comprobar_contiene "la API devuelve el total de órdenes" "$CUERPO_ORDENES" '"total":'

echo ""

# --- 5. Cierre de sesión ---------------------------------------------------
echo "== Cierre de sesión =="

CSRF_SALIR=$(csrf_de "$COOKIES_BUENAS")
curl -s -b "$COOKIES_BUENAS" -c "$COOKIES_BUENAS" -o /dev/null -X POST "$BASE/api/auth/signout" -H 'Content-Type: application/x-www-form-urlencoded' --data-urlencode "csrfToken=$CSRF_SALIR" --data-urlencode "callbackUrl=$BASE/admin/login"

SESION_FINAL=$(curl -s -b "$COOKIES_BUENAS" "$BASE/api/auth/session")
comprobar "la sesión se cerró" "$SESION_FINAL" "null"

CODIGO_TRAS_SALIR=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIES_BUENAS" "$BASE/api/orders")
comprobar "la API vuelve a estar cerrada" "$CODIGO_TRAS_SALIR" "401"

echo ""
if [ "$fallos" -eq 0 ]; then
  echo "AUTENTICACIÓN VERIFICADA: todas las comprobaciones pasaron."
else
  echo "AUTENTICACIÓN CON ${fallos} FALLO(S)."
  exit 1
fi
