#!/bin/bash
cd /var/www/alvio

PID=$(sudo ss -tlnp | grep 3000 | grep -oP 'pid=\K[0-9]+')
if [ ! -z "$PID" ]; then sudo kill -9 $PID; sleep 2; fi

pm2 stop alvio
sleep 1

git pull
npm run build
pm2 start alvio
