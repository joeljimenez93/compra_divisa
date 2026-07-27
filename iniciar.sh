#!/bin/bash

echo "═══════════════════════════════════════════"
echo "  💵 Compra/Venta USD - BCV → Binance"
echo "═══════════════════════════════════════════"
echo ""

# Kill any existing processes on ports 3000 and 4200
kill $(lsof -t -i:3000) 2>/dev/null
kill $(lsof -t -i:4200) 2>/dev/null

# Start backend
echo "🚀 Iniciando Backend (Express) en puerto 3000..."
cd "$(dirname "$0")/backend"
node index.js &
BACKEND_PID=$!
sleep 1

# Check if backend started
if kill -0 $BACKEND_PID 2>/dev/null; then
  echo "✅ Backend corriendo: http://localhost:3000"
else
  echo "❌ Error al iniciar backend"
  exit 1
fi

# Start frontend
echo ""
echo "🎨 Iniciando Frontend (Angular) en puerto 4200..."
cd "$(dirname "$0")/frontend"
npx ng serve --host 0.0.0.0 --port 4200 &
FRONTEND_PID=$!

echo ""
echo "═══════════════════════════════════════════"
echo "  Backend:  http://localhost:3000"
echo "  Frontend: http://localhost:4200"
echo ""
echo "  Presiona Ctrl+C para detener todo"
echo "═══════════════════════════════════════════"

# Trap Ctrl+C
trap "echo 'Deteniendo...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM

# Wait
wait
