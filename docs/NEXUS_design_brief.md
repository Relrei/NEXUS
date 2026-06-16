# NEXUS — デザインブリーフ ＆ 画像生成プロンプト一式

## コンセプト（一行）
**「考える道具」ではなく「梱包する道具」。** 散らばった素材を集め → 束ね → AIや自分に渡せる形（コンテキスト＝`CLAUDE.md`＋`spec`＋`refs/`）に鋳造する、個人のための倉庫／図書館。

---

## デザインDNA（視覚）
- SpaceX／ミッションコントロールのダークUI。ほぼ漆黒 `#05070d` に、軌道から見た地球・かすかな星雲・星空。
- 無限フリーボード（タイル型・Hyprland感）。カードが**整然と並ぶグリッドではなく、空間に散らばって浮かぶ**。
- ガラス質（フロスト＋わずかに透ける）・角丸・細く発光する境界。アクセント＝シアン `#7cc4ff` ＋ 紫。
- ノード間に**かすかな発光する接続線**（ノードグラフへの布石）。
- 余白たっぷり・モノスペースの小さなラベル・微細なHUD・シネマティックな被写界深度とブルーム。落ち着いて高級。

---

## 参考アプリ → 借りる要素

| 参考アプリ | NEXUSで借りる要素 |
|---|---|
| **Milanote** | 無限フリーボード・ドラッグするカード・ゆるい列・コネクタ |
| **Obsidian** | 左サイドバー(ツリー)・ナレッジグラフ・ノートペイン/タブ |
| **website / AI / explorer** | 内蔵ブラウザタブ・AIアシスタント側パネル・ファイル/アセット一覧 |
| **Google Calendar** | 月表示カレンダー＋予定/マイルストーン |
| **Blender node** | ノードエディタ(ソケット＋ベジェ配線・Source→Transform→Output) |

---

## 共通スタイル接尾辞（毎回末尾に付ける＝NEXUSの皮）
```
, in the NEXUS design language: SpaceX mission-control dark UI, near-black #05070d with a
faint Earth-from-orbit and starfield, glassmorphic frosted rounded tiles with slight
transparency, thin glowing cyan (#7cc4ff) and soft violet borders, soft bloom and depth of
field, minimal monospace micro-labels, generous negative space, premium cinematic, calm.
Dark product UI design, dribbble, 8k --ar 16:9 --style raw
```

---

## A. 統合ワークスペース（1枚で世界観を見る用）
```
UI mockup of a futuristic personal knowledge app "NEXUS", a tiling workspace that fuses
several apps into one screen: a Milanote-style infinite freeboard in the center with
scattered draggable cards (sticky notes, image thumbnails, link cards) and a few glowing
connector lines; an Obsidian-style left sidebar file tree and a small knowledge-graph
mini-map; a right AI assistant chat panel; a Google-Calendar-style month widget with event
dots in a bottom corner; an embedded web browser tab; a thin Blender-node-editor strip at
the bottom with sockets and bezier noodle wires labeled Source / Transform / Output. Tiling
window layout, neatly partitioned glass panels
```
＋共通スタイル接尾辞

---

## B. ビュー別（各参考アプリ1枚ずつ＝参考に一番使いやすい）
各行の先頭文 ＋ **共通スタイル接尾辞** で生成。

**1. フリーボード（Milanote）**
```
A Milanote-style infinite freeboard view of "NEXUS": organic scattered glass cards — sticky
notes, image thumbnails, link cards — draggable on a deep-space canvas, a few faint glowing
connection lines, a floating top glass search + quick-capture bar
```

**2. ナレッジグラフ／ノート（Obsidian）**
```
An Obsidian-style view of "NEXUS": left glass sidebar with a folder tree, a central
constellation knowledge-graph of glowing nodes and links over starfield, a markdown note
pane with tabs on the right
```

**3. ノードエディタ（Blender node）**
```
A Blender-node-editor-style canvas in "NEXUS": rounded glass nodes with colored input/output
sockets connected by smooth bezier noodle wires, grouped left-to-right as Source then
Transform then a highlighted Output node casting a "package" of files, dark grid backdrop
```

**4. カレンダー（Google Calendar）**
```
A Google-Calendar-style month view inside "NEXUS": a glass calendar grid, today highlighted
with a cyan ring, event and milestone dots, an agenda list beside it
```

**5. AI＋ブラウザ＋エクスプローラー**
```
A side-by-side panel view in "NEXUS": an AI assistant chat panel with a typing indicator on
the right, an embedded web browser tab in the center, and a file/asset explorer grid with
image thumbnails on the left, all as frosted glass panels
```

---

## 使い方メモ
- ビュー別（B）を個別に出すと綺麗で参考にしやすい。A（全部入り）は世界観確認用（少しごちゃつく）。
- Midjourney は `--ar 21:9` でUWQHD横長に。SD（stable-diffusion-webui）はUIモック苦手なので雰囲気カット向き。
- **文字は崩れるので無視。配色・ガラス質感・ノードの配線・余白・タイルの散らし方だけ参考にする。**
- SD用 Negative: `text, watermark, logo, blurry, low-res, cluttered, childish, flat, white background, deformed`

---

## ★ 最後に：これは何のためのアプリか（一番大事な目的）

作る理由は「かっこいいUI」ではなく、**自分の困りごとを仕組みで消す**こと。

- **課題**：バイブコーディング中に何度も同じ確認をする／セッションを忘れる／方向性がまとまらない。調べて満足してまた不安で調べ直す無限ループ（ADHD的）。メモやファイルを作るのが面倒で放置する。
- **効かせ方（我慢ではなく不要にする）**：
  - 調べた物を**可視のノード**にして「もう調べたっけ？」を「目の前にある＝調べ済み」に変える。
  - 変わらない情報は **Cold＝確定（鍵）** にして再調査の対象から機械的に外す（Hotだけが再取得対象）。
  - **重複検出**で「もう持ってる」を即提示。
  - Outputに**必要ポート＝完了条件**を定義し、「揃った」の終点を作る（無限の収集を有限にする）。
  - **摩擦ゼロのInbox**（とりあえず投げ込む・D&D・ペースト）で「作るのが面倒」を消す。
- **動作モデル**：pull・純粋・無時間。**世界に撃ち込まない＝副作用なし＝安全**。倉庫(Cold)中心、新聞だけTTL(Hot)。
- **本命の出口**：実行ではなく**梱包**。素材を束ねて「Claude Codeが一発で食えるファイル一式（`CLAUDE.md`＋`spec`＋`refs/`）」を吐く。これがバイブコーディングの反復を支える、このアプリ最大の独自性。

> 一言でいえば — **散らばりと不安を、検索ではなく"確定した倉庫"で終わらせ、その倉庫からそのまま制作に渡せる道具。**
