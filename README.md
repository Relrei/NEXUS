# NEXUS （alpha）

散らばった素材を集め、束ね、渡せる形に**梱包**する、個人用の倉庫 / ナレッジ・デスクトップ。
Arch + Hyprland 風の「動くWebデスクトップ環境」として作っています（ローカル完結・サーバー不要）。

> ⚠️ **alpha / WIP / 個人用**。仕様も見た目も頻繁に変わります。

## すぐ使う（ダウンロードして開くだけ）

1. [`NEXUS.html`](./NEXUS.html) をダウンロード
2. ブラウザで開く（ダブルクリック）

これだけで動きます。単一HTMLに全部入り（JS/CSS/アイコンをインライン）。
データはそのブラウザ内（IndexedDB）にローカル保存されます。

> Chromium 系を推奨（GPUで滑らかに動きます）。

## 開発して使う

```bash
npm install
npm run dev           # http://localhost:5173
npm run build         # dist/ に通常ビルド
npm run build:single  # dist-single/index.html に単一HTMLを生成
```

## アプリとして起動（Linux・Chromium app mode）

GPUが効いて軽いので、ネイティブ風に使うならこれ：

```bash
./launch-app.sh
```

（`chromium --app` で単一HTMLを専用プロファイルで起動します）

## 機能（抜粋）

- 仮想ファイルシステム上のエクスプローラー（タイル / グラフ / ノードの3ビュー・D&D移動・検索）
- ターミナル / エディタ / ブラウザ などのアプリを窓で開く（タイル & フロート）
- waybar 風トップバー・自動非表示ドック・壁紙・液体ガラス（CSS）
- データの Export / Import（端末・環境間の移行用）

## 技術

Vite + React + TypeScript + Tailwind + Dexie(IndexedDB)。依存は最小限。

## ライセンス

MIT（[LICENSE](./LICENSE)）

---

🤖 Built with [Claude Code](https://claude.com/claude-code)
