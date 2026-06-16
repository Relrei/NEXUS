import Dexie, { type Table } from 'dexie'

// 線に流す4つの型(Text/MediaRef/Record/Reference)に対応する倉庫アイテムの種別。
// MVPでは Record は text として扱い、後でノード化する。
export type Kind = 'text' | 'reference' | 'media' | 'file'
export type Freshness = 'cold' | 'hot'

export interface Item {
  id: string
  kind: Kind
  title: string
  content: string // text本文 / referenceのメモ / mediaのキャプション
  url?: string // reference用
  tags: string[]
  freshness: Freshness // cold=倉庫(永久) / hot=TTL(再取得対象)
  locked: boolean // 「確定」=もう調べ直さない印(鍵)
  hash?: string // 重複検出: mediaは中身のsha256・textは正規化本文のsha256
  blobKey?: string // blobs テーブルへの参照(=hash。content-addressed)
  mime?: string
  fileName?: string
  size?: number
  thumb?: string // 画像の小さなサムネ(dataURL)。一覧で実体を読まずに済む
  x?: number // フリーボード上のワールド座標(未設定なら自動配置)
  y?: number
  folder?: string // 倉庫のグループ(=エクスプローラー /home/user/.storage/<folder> と共有)
  links?: string[] // グラフで手動接続した相手の id(タグ由来の自動リンクとは別)
  createdAt: number
  updatedAt: number
  fetchedAt?: number // hotの鮮度判定用
}

// 実体(画像/ファイルのバイト列)は content-addressed で1回だけ保存する pool。
// MediaRefは「パス+サムネ+メタ」だけを Item に持ち、中身はここに置く=線に中身を流さない設計。
export interface BlobRow {
  key: string // = sha256
  blob: Blob
}

class NexusDB extends Dexie {
  items!: Table<Item, string>
  blobs!: Table<BlobRow, string>

  constructor() {
    super('nexus')
    this.version(1).stores({
      items: 'id, kind, freshness, locked, createdAt, updatedAt, hash, blobKey, *tags',
      blobs: 'key',
    })
    this.version(2).stores({
      items: 'id, kind, freshness, locked, createdAt, updatedAt, hash, blobKey, folder, *tags',
      blobs: 'key',
    })
  }
}

export const db = new NexusDB()

// ---- ハッシュ(重複検出 / content-addressed pool) ----
export async function sha256(data: ArrayBuffer | string): Promise<string> {
  const buf =
    typeof data === 'string' ? new TextEncoder().encode(data.trim().normalize('NFKC')) : data
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ---- blob を pool に入れて参照キーを返す(同一内容は1回だけ保存) ----
export async function putBlob(blob: Blob): Promise<string> {
  const key = await sha256(await blob.arrayBuffer())
  const exists = await db.blobs.get(key)
  if (!exists) await db.blobs.put({ key, blob })
  return key
}

export async function getBlobUrl(key?: string): Promise<string | undefined> {
  if (!key) return undefined
  const row = await db.blobs.get(key)
  return row ? URL.createObjectURL(row.blob) : undefined
}

// ---- 壁紙(デスクトップ背景) ----
// 実体は blob pool に置き、参照キーだけ localStorage に持つ(個人の画像)。
export async function setWallpaper(file: File): Promise<void> {
  const key = await putBlob(file)
  localStorage.setItem('nexus.wallpaper', key)
}
export async function getWallpaperUrl(): Promise<string | undefined> {
  const key = localStorage.getItem('nexus.wallpaper')
  return key ? getBlobUrl(key) : undefined
}
export function clearWallpaper(): void {
  localStorage.removeItem('nexus.wallpaper')
}
