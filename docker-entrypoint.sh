#!/bin/sh

(
  node /opt/pot-provider/server/build/main.js --port 4416 ||
    echo "WARNING: PO token provider exited; continuing without it."
) &

for i in $(seq 1 30); do
  if node -e "require('http').get('http://127.0.0.1:4416/ping', res => process.exit(res.statusCode >= 200 && res.statusCode < 300 ? 0 : 1)).on('error', () => process.exit(1))"; then
    break
  fi
  sleep 0.5
done

exec npm start
