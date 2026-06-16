import { db, putBlob, sha256, type Item, type Kind } from './db'

const URL_RE = /^https?:\/\/\S+$/i

function now() {
  return Date.now()
}

function newId() {
  return crypto.randomUUID()
}

// 画像から小さなサムネ(dataURL)を作る。一覧で実体blobを読まずに済ませるため。
async function makeThumb(blob: Blob, max = 320): Promise<string | undefined> {
  if (!blob.type.startsWith('image/')) return undefined
  try {
    const bmp = await createImageBitmap(blob)
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * scale))
    const h = Math.max(1, Math.round(bmp.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close()
    return canvas.toDataURL('image/webp', 0.8)
  } catch {
    return undefined
  }
}

export interface CaptureResult {
  item: Item
  duplicate: boolean // 既に同じものが倉庫にあった
}

// 既存の同一ハッシュを探す(重複検出)。
async function findByHash(hash: string): Promise<Item | undefined> {
  return db.items.where('hash').equals(hash).first()
}

async function save(item: Item, hash: string): Promise<CaptureResult> {
  const dup = await findByHash(hash)
  if (dup) return { item: dup, duplicate: true }
  await db.items.put(item)
  return { item, duplicate: false }
}

// テキスト or URL を1件として取り込む(Enter一発・摩擦ゼロ)。
export async function captureText(raw: string): Promise<CaptureResult> {
  const text = raw.trim()
  const isUrl = URL_RE.test(text)
  const hash = await sha256(text)
  const t = now()
  const item: Item = {
    id: newId(),
    kind: isUrl ? 'reference' : 'text',
    title: deriveTitle(text),
    content: isUrl ? '' : text,
    url: isUrl ? text : undefined,
    tags: [],
    freshness: 'cold',
    locked: false,
    hash,
    createdAt: t,
    updatedAt: t,
  }
  return save(item, hash)
}

// ファイル(画像/その他)を実体poolに入れて MediaRef として取り込む。
export async function captureFile(file: File): Promise<CaptureResult> {
  const blobKey = await putBlob(file) // = sha256(中身)
  const kind: Kind = file.type.startsWith('image/') ? 'media' : 'file'
  const thumb = await makeThumb(file)
  const t = now()
  const item: Item = {
    id: newId(),
    kind,
    title: file.name || (kind === 'media' ? '画像' : 'ファイル'),
    content: '',
    tags: [],
    freshness: 'cold',
    locked: false,
    hash: blobKey,
    blobKey,
    mime: file.type,
    fileName: file.name,
    size: file.size,
    thumb,
    createdAt: t,
    updatedAt: t,
  }
  return save(item, blobKey)
}

// 最初の行/80文字を見出しに。
function deriveTitle(text: string): string {
  const firstLine = text.split('\n').find((l) => l.trim()) ?? text
  return firstLine.trim().slice(0, 80)
}

// ---- 更新系 ----
export async function patchItem(id: string, patch: Partial<Item>): Promise<void> {
  await db.items.update(id, { ...patch, updatedAt: now() })
}

export async function toggleLock(item: Item): Promise<void> {
  await patchItem(item.id, { locked: !item.locked })
}

export async function toggleFreshness(item: Item): Promise<void> {
  await patchItem(item.id, {
    freshness: item.freshness === 'cold' ? 'hot' : 'cold',
    fetchedAt: item.freshness === 'cold' ? now() : item.fetchedAt,
  })
}

export async function removeItem(item: Item): Promise<void> {
  await db.items.delete(item.id)
  // pool掃除: 同じblobKeyを参照する他アイテムが無ければ実体も消す
  if (item.blobKey) {
    const others = await db.items.where('blobKey').equals(item.blobKey).count()
    if (others === 0) await db.blobs.delete(item.blobKey)
  }
}

// グラフの手動リンク(双方向に保存)
export async function linkItems(aId: string, bId: string): Promise<void> {
  if (aId === bId) return
  for (const [x, y] of [[aId, bId], [bId, aId]] as const) {
    const it = await db.items.get(x)
    if (!it) continue
    const links = Array.from(new Set([...(it.links ?? []), y]))
    await db.items.update(x, { links })
  }
}
export async function unlinkItems(aId: string, bId: string): Promise<void> {
  for (const [x, y] of [[aId, bId], [bId, aId]] as const) {
    const it = await db.items.get(x)
    if (!it) continue
    await db.items.update(x, { links: (it.links ?? []).filter((id) => id !== y) })
  }
}

// 倉庫フォルダ = エクスプローラー /home/user/.storage/<folder> と共有(ディレクトリを作る)
export async function setFolder(id: string, folder: string | null): Promise<void> {
  await db.items.update(id, { folder: folder ?? undefined })
}
