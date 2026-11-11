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

# Check if the Base64 config is provided via env var
if [ -n "$X_WARP_CONFIG_B64" ]; then
    echo "Using provided WARP config from environment variable..."
    echo "$X_WARP_CONFIG_B64" | base64 -d > /tmp/wgcf-profile.conf
elif [ ! -f /tmp/wgcf-account.toml ]; then
    echo "Attempting to register WARP..."
    wgcf register --accept-tos
    wgcf generate
    mv wgcf-profile.conf /tmp/
else
    echo "Using existing WARP config..."
fi

# Start wireproxy using the config
if [ -f /tmp/wgcf-profile.conf ]; then
    wireproxy -c /tmp/wgcf-profile.conf --bind 127.0.0.1:40000 &
    sleep 2
else
    echo "WARNING: No WARP config found. Proxy may not work."
fi

exec npm start
