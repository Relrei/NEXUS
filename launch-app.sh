#!/usr/bin/env bash
# NEXUS を Chromium の app mode で起動する。
# 理由: このマシンの Tauri(WebKitGTK)+NVIDIA は GPU が効かず(白画面/クラッシュ)CSS描画がCPUで重い。
# Chromium は GPU が効くので、同じ dist を app ウィンドウで軽快に動かせる(web版=一番理想)。
# データは専用 user-data-dir に永続化(他のChromiumプロファイルと混ざらない)。
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
HTML="$DIR/dist-single/index.html"
PROFILE="$HOME/.local/share/nexus-app"

# 単一HTMLが無ければビルド
[ -f "$HTML" ] || (cd "$DIR" && npm run build:single)

exec chromium \
  --app="file://$HTML" \
  --user-data-dir="$PROFILE" \
  --class=NEXUS \
  --name=NEXUS \
  --no-first-run \
  --no-default-browser-check
