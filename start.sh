#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js не найден. Установите: https://nodejs.org/"
  exit 1
fi

export ELECTRON_SKIP_BINARY_DOWNLOAD=1

if [ ! -d "node_modules" ]; then
  echo "Установка зависимостей..."
  npm install
fi

if [ ! -f "node_modules/electron/dist/electron" ]; then
  echo "Загрузка Electron..."
  mkdir -p node_modules/electron/dist
  if [ "$(uname -s)" = "Darwin" ]; then
    URL="https://github.com/electron/electron/releases/download/v33.4.11/electron-v33.4.11-darwin-x64.zip"
  else
    URL="https://github.com/electron/electron/releases/download/v33.4.11/electron-v33.4.11-linux-x64.zip"
  fi
  curl -L "$URL" -o /tmp/electron.zip
  unzip -o /tmp/electron.zip -d node_modules/electron/dist
  echo "33.4.11" > node_modules/electron/dist/version
  echo "electron" > node_modules/electron/path.txt
fi

npm start
