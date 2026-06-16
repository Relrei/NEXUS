# NEXUS デザイン調査：メカニック × 生体（バイオメカ）— 大型魚 / ヴンダー軸

2026-06-16。ユーザー選択「D」＝メカ＋生体テーマを軸に調査。生物＝大型魚、参照＝エヴァ AAA ヴンダー。
画像生成はユーザー側で実施 → 本書は**方向性の調査＋生成プロンプト**。

## なぜこの軸がNEXUSに合うか（比喩の核）
- **方舟（ark）**：ヴンダー＝人類の残りを積んで運ぶ生体機械の箱舟。NEXUS＝自分の知識を全部積んで運ぶ箱舟。
  「倉庫/図書館」の正統進化＝**動く巨大な器**。Cold（積荷＝動かない確定在庫）/ Hot（鰓＝呼吸＝再取得）。
- **濾過摂食（filter feeder）**：ジンベエザメ＝泳ぎながら通過する物を全部漉し取る、巨大で穏やかな生物。
  ＝**摩擦ゼロInbox**そのもの（口を開けているだけで集まる）。
- **生きた化石（coelacanth）/ 深海**：一度沈めた物は変わらない＝Coldキャッシュの正当性。深海＝静かな保管庫。

## トーン指針（エヴァ感を品よく）
- 「**構造はメカ・表層は生体**」。装甲パネル＋リブ（肋骨/脊椎）＋グリーブル と、半透明の膜・濡れた皮膚・脈動。
- 全部グロにしない：寒色（深海ブルー＋生体発光シアン）を主、暖色（琥珀＝警告灯/ヴンダーのアクセント）を差し色に。
- 動きは最小（拍動する鰓・ゆらぐ光条）。自己組織化で勝手に動く系はADHD空間記憶を壊すので不可。

## 配色HEX案
- 装甲ボーン白 `#E8E4DA` / ガンメタル `#2A2F36`
- 深海背景 `#07111F` → `#0B2233`
- 生体発光シアン `#58E5D6` / 補助 `#7CC4FF`
- 琥珀の警告アクセント `#FF8A3D`

## NEXUS UI へのマッピング
| 要素 | バイオメカ表現 |
|---|---|
| 背景（今＝宇宙/地球） | 深海＋船体内部（リブ・脊椎・膜・光条）。星空→漂う微粒子 |
| カード | 装甲鱗 / 積荷セル（金属リブ枠＋半透明の呼吸膜＋発光リム） |
| 検索 | ソナー/生体発光パルスが暗い船倉を走査 → 該当セルが点灯、他は murk に沈む |
| Output（梱包） | 腺/カーゴベイから**封入カプセルを分泌/射出**（Source→Transform→Output） |
| Cold / Hot | 休眠する鱗 / 拍動する鰓 |
| フリーボード | 脊椎沿いの船倉を泳ぐ。パン＝海流 |
| アプリ全体の象徴 | 巨大生体機械リヴァイアサン（ジンベエ × ヴンダー） |

---

## 画像生成プロンプト

> ⚠️ 2026-06-16 修正: 旧版(下の「leviathan/concept sheet」系)は**生き物の絵**になってしまった。
> UI画面が欲しいときは下の【UI-first 修正版】を使う。生物アートはマスコット/ロゴ用と割り切る。

### 【UI-first 修正版】← UI画面はこれ
**共通接尾辞（材質だけ・生物禁止を明記）**
```
. IMPORTANT: this is a SOFTWARE UI SCREEN, not an illustration of an animal — do NOT draw a
fish, shark, whale or creature. The biomechanical whale-shark / Wunder look appears ONLY as
the material of the interface: bone-white and gunmetal armored panels fused with translucent
ribbed membranes, thin bioluminescent cyan seams and small amber indicator lights,
brushed-metal plus wet-organic sheen, deep-ocean ultramarine background. Dark-mode product UI,
flat front-facing app screen, clean tidy layout, Figma / dribbble mockup, crisp, 8k, 16:9
```
**ヘッド（必ず「UI画面」から始める）**
- 全体: `A dark-mode desktop app UI mockup titled "NEXUS — Everything, in one.": a tiling knowledge workspace screen with a slim left toolbar, a central freeboard of scattered content cards, a floating top search and quick-capture bar, subtle status chips`
- フリーボード: `A dark-mode app UI screenshot of the NEXUS freeboard: rounded content cards scattered on an infinite canvas, a floating top search-and-capture bar, a small zoom control in the corner`
- カード: `A UI component close-up: a single NEXUS content card — a rounded panel with a thumbnail, a title line and small meta icons`
- 検索: `A dark-mode app UI screenshot of NEXUS search: a search field at the top, the matching card brightly highlighted while the other cards dim, a soft pulse ring from the match`
- Output: `A dark-mode app UI screenshot of the NEXUS package panel: three connected stages labeled Source, Transform, Output, with required input slots and a generated file bundle (CLAUDE.md, spec.md, refs/) shown as a list`
- まだ魚が出るとき先頭を強化: `A flat 2D dark UI screenshot (no perspective, no illustration), ...`

### 【旧版＝生物アート/マスコット用】（UI画面には使わない）
### 共通スタイル接尾辞（毎回末尾に付ける）
```
, NEXUS mecha-bio design language: biomechanical vessel aesthetic inspired by the AAA Wunder
(Evangelion) and a colossal deep-sea fish / whale-shark; bone-white and gunmetal armored hull
panels fused with organic ribbed membranes and breathing skin; deep-ocean ultramarine
background with god-rays and floating particulate; bioluminescent cyan veins and warm amber
warning accents; brushed metal plus wet organic sheen, subtle pulsing glow, cinematic depth,
premium, awe, calm but alive. Dark product UI / concept art, 8k --ar 16:9
```

### ヒーロー（象徴）
```
Hero concept of "NEXUS", a personal knowledge ark: a colossal biomechanical leviathan, half
armored airship (AAA Wunder) and half deep-sea whale-shark, carrying a glowing archive inside
its ribbed belly, swimming through dark ocean depths, god-rays, bioluminescent cargo cells
visible through translucent hull membranes. Tagline "Everything, in one."
```
＋共通接尾辞

### ビュー別
**1. フリーボード（船倉の内部）**
```
UI mockup: the NEXUS freeboard as the interior cargo-hold of the biomechanical leviathan —
content cards as ribbed bio-mechanical cargo cells floating along the spine, scattered
organically, a floating glass-and-chitin top search/capture bar, deep-ocean hull membranes
and glowing veins behind
```
**2. カード単体（質感）**
```
Close-up of one NEXUS card as a biomechanical scale / cargo-cell: a rounded armored panel
fused with a translucent breathing membrane, ribbed metal frame, a thumbnail inset, faint
bioluminescent rim, wet sheen, dark depths behind, bokeh
```
**3. 検索＝ソナー/生体発光パルス**
```
NEXUS search visualized as a bioluminescent sonar pulse sweeping a dark cargo hold; the
matching cargo-cell lights up brightly while the others dim into the murk
```
**4. Output＝梱包の分泌/射出**
```
NEXUS packaging Output as the leviathan secreting a glowing sealed capsule from a mechanical
gland, stages labeled Source / Transform / Output, a pod of files ejected from a ribbed cargo
bay
```
**5. 外観シルエット（マスコット/象徴の確定用）**
```
Full-body concept of the NEXUS leviathan: a graceful colossal whale-shark-meets-Wunder
airship, armored dorsal panels, fin-sails, amber-glowing gill-vents, barnacle greebles,
swimming, side profile, concept sheet
```

### SD用 Negative
```
text, watermark, gore, slimy body-horror, bright daylight, white background, cluttered,
deformed anatomy, low-res, blurry
```

## 振り幅キーワード
- もっとメカ寄り → `hard-surface, panel lines, greebles, military, hangar`
- もっと生体寄り → `organic, cartilage, gills, membrane, bioluminescence, breathing`
- もっとヴンダー寄り → `Evangelion Wunder, AAA airship, bio-machine ark, orange caution markings`
- もっと深海/魚寄り → `whale shark, abyssal, deep sea, god rays, marine snow`

## 前テーマとの関係
- これは前の「生体（菌糸）案」とは別フレーバー＝**器/生物（船・大型魚）**。
  菌糸案の収穫「Cold=休眠 / Hot=拍動 / 確定=石化」という**生命状態メタファ**はこのバイオメカ案にもそのまま乗る。
- 実装方針は変わらず `data-theme` 属性＋CSS変数で**切替テーマ**として足すのが安全（青い宇宙テーマは温存）。
- まずは画像で見た目を確定 → 気に入った絵を正にCSS変数（配色）→背景→カード枠→検索パルス、の順で寄せる。

## ★構造案: 背骨＋肋骨フォルダ＋DNA螺旋（2026-06-16 ユーザー発案・本命候補）
「皮（素材）」でなく**構造とインタラクションを生体に**する案。斬新さの核。
- **背骨(軸)** = 中心の組織軸。プロジェクト=椎骨。常に見える=全体把握(ADHD対策)。
- **肋骨=フォルダ** = 背骨から垂直に伸縮・格納。閉=畳む/開=横に伸びる。
- **押すとDNA二重螺旋** = 中身が螺旋展開。項目=塩基対(rung)。スクロールで回転・手前鮮明/奥ボケ。
- ★**DNA=梱包が完全一致**: 集めた項目=遺伝子 / Transform=転写翻訳(リボソーム) / Output=発現したタンパク質
  =`CLAUDE.md+spec+refs`束。NEXUS=知識DNAがプロジェクト(製品)に発現する生き物。倉庫より強い比喩。
- 位置づけ案: 背骨ビュー=整理された図書館の骨格 / フリーボード=ばら撒き作業場(Inbox)の二本立て。
- 規律: 螺旋は魅せ重視でも**可読性死守**(rungは読めるカード・回転しても一覧性を殺さない)。ギミック倒れ防止。
- 次手候補: (a)この概念の画像プロンプト調整 / (b)★「肋骨押す→DNA螺旋展開」を動くReactプロトタイプ化(動きは静止画より触って判断)。
- プロンプト(UI-first)はメモ/会話参照(背骨ナビ・螺旋クローズアップ)。

## ★ヴンダー寄せ修正(2026-06-16): 構造は合ったが"皮"が足りない
背骨+肋骨+DNA螺旋は生成で立体化したが「綺麗すぎ/対称すぎ/汎用SF」で理想と乖離。本物のヴンダー=
**NERV/WILLE戦艦ダメージコントロール画面**の濃さが要る。リファレンス(エヴァWunder設計画・鯨骨格・コアリング・ダメコン図)から抽出した不足要素:
- 鯨の骨格=背骨＋**湾曲した肋骨**(直線タブでなく曲がった骨・骨+ガンメタ融合)
- **エンジンコアの同心リング**(発光シアンの輪・象徴的)
- **схематичHUD/設計図レイヤー**=細いワイヤーフレーム＋赤/アンバー警告ブロック＋等幅技術ラベル(`B-BLOCK: COREUNIT`)＋上部メニュー(`MNU EDT ESC DAMAGECONTROL`)←NERV感の正体
- 六角形ハルパネル / 横長鯨型船体＋内部吊りポッド / 非対称・密度
- 質感=ツヤ3Dでなく**設計図モニタ**。near-black teal＋シアン線＋赤/アンバー
- ★マッピング: ヴンダー**ダメコン全体図=NEXUSの倉庫全体マップ**。ブロック状態=Cold/Hot/確定(石化)、`ERROR`=未充足Outport(梱包に足りない素材)=完了条件の可視化が戦艦整備画面になる。
- 魔法ワード: damage-control monitor / wireframe schematic / whale-skeleton curved ribs / engine-core rings / monospace block codes / hexagonal plating / red ERROR tags / asymmetric dense。頭に`A technical wireframe schematic UI (not a 3D render), ...`で更に寄る。
- 修正プロンプト全文は会話(2026-06-16)参照。
