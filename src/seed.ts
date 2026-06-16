import { captureFile, captureText } from './capture'
import { db } from './db'

// 開発用: フリーボードの見た目確認のためのサンプル投入。本番では呼ばない。
// 画像はcanvasで宇宙風タイルを生成し、本物の取込パイプライン(サムネ/pool)を通す。

const NOTES = [
  '色収差は白ベース＋鋭い折り目だけ虹。輝度上位20〜40%にMaskで盛る。',
  'VOICEVOX: プラナはpitchScale -0.05で低音。アロナは既定。',
  'NEXUSの本命Output＝実行でなく「梱包」。CLAUDE.md＋spec＋refs/ を吐く。',
  'Cold＝倉庫(永久)/Hot＝TTL。撃ち込まない＝副作用なし＝安全。',
  '摩擦ゼロInbox: とりあえず投げ込む。分類は後でいい。',
  'Falcorの水: 手続き波→SPPM→3ノブ(Gain/Sat/Mask)→AOV合成。',
]
const LINKS = [
  'https://nvlabs.github.io/Falcor/',
  'https://milanote.com/',
  'https://obsidian.md/',
]

function gradientTile(label: string, c1: string, c2: string): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 400
  const ctx = canvas.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 640, 400)
  g.addColorStop(0, c1)
  g.addColorStop(1, c2)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 640, 400)
  // 星
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  for (let i = 0; i < 60; i++) {
    ctx.globalAlpha = Math.random() * 0.8
    ctx.beginPath()
    ctx.arc(Math.random() * 640, Math.random() * 400, Math.random() * 1.6, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = '600 26px system-ui'
  ctx.fillText(label, 28, 56)
  return new Promise((res) =>
    canvas.toBlob((b) => res(new File([b!], `${label}.png`, { type: 'image/png' })), 'image/png'),
  )
}

export async function seedSample() {
  if ((await db.items.count()) > 0) return
  for (const n of NOTES) await captureText(n)
  for (const l of LINKS) await captureText(l)
  const tiles = await Promise.all([
    gradientTile('reference-sky', '#1a2a6c', '#b21f1f'),
    gradientTile('rocket-rise', '#0f2027', '#2c5364'),
    gradientTile('earth-orbit', '#000428', '#004e92'),
    gradientTile('nebula', '#42275a', '#734b6d'),
  ])
  for (const f of tiles) await captureFile(f)
}

// Playwright/手動からも呼べるようdevで公開
if (import.meta.env.DEV) {
  ;(window as unknown as { __nexusSeed: () => Promise<void> }).__nexusSeed = seedSample
}
