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

# Setup WARP (idempotent: only runs if config missing)
if [ ! -f /tmp/wgcf-account.toml ]; then
  wgcf register --accept-tos
  wgcf generate
  mv wgcf-profile.conf /tmp/
fi

# Start wireproxy as a SOCKS5 proxy on port 40000
wireproxy -c /tmp/wgcf-profile.conf --bind 127.0.0.1:40000 &
sleep 2

exec npm start
