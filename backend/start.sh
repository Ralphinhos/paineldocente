#!/bin/sh

echo "==================================="
echo "Iniciando Stunnel Proxy..."
echo "==================================="

# Garante que não há stunnel anterior rodando
pkill stunnel 2>/dev/null || true

# Inicia Stunnel
stunnel /etc/stunnel/stunnel.conf &

sleep 3

echo "✅ Stunnel iniciado. Iniciando aplicação Node.js..."
echo "==================================="

exec node --tls-min-v1.0 server.js
