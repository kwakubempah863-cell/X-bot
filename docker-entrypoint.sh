#!/bin/sh

(
  node /opt/pot-provider/server/build/main.js --port 4416 ||
    echo "WARNING: PO token provider exited; continuing without it."
) &

exec npm start
