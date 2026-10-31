#!/usr/bin/env bash
# 部署到 GitHub Pages（公開網站）：建置到 dist-pages/（不動 dist/），推到只放網站的公開儲存庫。
# 用法：bash scripts/deploy-pages.sh [--build-only]
# 注意：網站含信望愛和合本資料（其下載目錄標示「僅作為測試用途」，見 docs/資料來源.md）；公開發佈由使用者決定並承擔。
set -euo pipefail
SITE_REPO="${SITE_REPO:-timcsy/biblexer-app}"
BASE_PATH="/${SITE_REPO#*/}/"
OUT=dist-pages

echo "建置：base=${BASE_PATH} → ${OUT}/"
BASE_PATH="$BASE_PATH" npx vite build --outDir "$OUT" --emptyOutDir
touch "$OUT/.nojekyll"   # 讓 GitHub Pages 原樣提供所有檔案
cp "$OUT/index.html" "$OUT/404.html"
[ "${1:-}" = "--build-only" ] && { echo "只建置，未上傳：$(du -sh "$OUT" | cut -f1)"; exit 0; }

# 以獨立的 git 歷史推送（網站內容每次整份取代）
TMP=$(mktemp -d)
cp -R "$OUT"/. "$TMP"/
cd "$TMP"
git init -q -b main
git add -A
git commit -q -m "部署 BibLexer（$(date '+%Y-%m-%d %H:%M')）"
if ! gh repo view "$SITE_REPO" >/dev/null 2>&1; then
  gh repo create "$SITE_REPO" --public --description "BibLexer 語意串珠聖經（建置好的網站）"
fi
git push -q -f "https://github.com/${SITE_REPO}.git" main
gh api -X POST "repos/${SITE_REPO}/pages" -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1 \
  || gh api -X PUT "repos/${SITE_REPO}/pages" -f "source[branch]=main" -f "source[path]=/" >/dev/null
echo "已推送。網站：https://${SITE_REPO%%/*}.github.io/${SITE_REPO#*/}/（第一次約需一兩分鐘生效）"
