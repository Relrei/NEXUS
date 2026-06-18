import { db, type Item } from './db'

// 倉庫(items)＋実体(blobs)＋nexus.* の localStorage を1ファイルに梱包/復元する。
// ブラウザのIndexedDBはオリジン毎に隔離される=別アプリ(Tauri等)へは自動で移らないので、
// 「書いた内容を持っていく」唯一の確実な橋がこのExport/Import。NEXUSの「梱包して渡す」をデータ自身に適用。

const LS_PREFIX = 'nexus.'

function abToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

function b64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export interface Backup {
  app: 'nexus'
  version: number
  exportedAt: number
  items: Item[]
  blobs: { key: string; mime: string; b64: string }[]
  localStorage: Record<string, string>
}

export async function buildBackup(): Promise<Backup> {
  const items = await db.items.toArray()
  const blobRows = await db.blobs.toArray()
  const blobs = await Promise.all(
    blobRows.map(async (r) => ({
      key: r.key,
      mime: r.blob.type || 'application/octet-stream',
      b64: abToB64(await r.blob.arrayBuffer()),
    })),
  )
  const ls: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(LS_PREFIX)) {
      const v = localStorage.getItem(k)
      if (v != null) ls[k] = v
    }
  }
  return { app: 'nexus', version: 1, exportedAt: Date.now(), items, blobs, localStorage: ls }
}

export async function exportToFile(): Promise<void> {
  const backup = await buildBackup()
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  a.href = url
  a.download = `nexus-backup-${ts}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export interface ImportResult {
  items: number
  blobs: number
}

export async function importFromBackup(
  backup: Backup,
  mode: 'merge' | 'replace' = 'merge',
): Promise<ImportResult> {
  if (backup?.app !== 'nexus' || !Array.isArray(backup.items)) {
    throw new Error('NEXUSのバックアップファイルではありません')
  }
  if (mode === 'replace') {
    await db.items.clear()
    await db.blobs.clear()
  }
  await db.items.bulkPut(backup.items)
  for (const b of backup.blobs ?? []) {
    await db.blobs.put({ key: b.key, blob: b64ToBlob(b.b64, b.mime) })
  }
  for (const [k, v] of Object.entries(backup.localStorage ?? {})) {
    localStorage.setItem(k, v)
  }
  return { items: backup.items.length, blobs: (backup.blobs ?? []).length }
}

export async function importFromFile(
  file: File,
  mode: 'merge' | 'replace' = 'merge',
): Promise<ImportResult> {
  const backup = JSON.parse(await file.text()) as Backup
  return importFromBackup(backup, mode)
}
