import { useEffect, useState } from 'react'

// 仮想ファイルシステム(ローカルのみ・ネイティブには触れない=安全)。
// localStorage に木をJSONで持つ。ターミナル/ファイル/エディタが共有する単一の真実。
// ct=作成時刻, mt=更新時刻(epoch ms)。既存データには無いことがあるので任意。
type Node = { type: 'dir'; ct?: number; mt?: number } | { type: 'file'; content: string; ct?: number; mt?: number }
type Store = Record<string, Node>
const now = () => Date.now()

const KEY = 'nexus.vfs'

function load(): Store {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (s && s['/']) return s
  } catch {
    /* ignore */
  }
  // 初期FS
  const t = Date.now()
  const s: Store = {
    '/': { type: 'dir', ct: t, mt: t },
    '/home': { type: 'dir', ct: t, mt: t },
    '/home/user': { type: 'dir', ct: t, mt: t },
    '/home/user/Desktop': { type: 'dir', ct: t, mt: t },
    '/home/user/Documents': { type: 'dir', ct: t, mt: t },
    '/home/user/Downloads': { type: 'dir', ct: t, mt: t },
    '/home/user/Pictures': { type: 'dir', ct: t, mt: t },
    // Desktopが空だと寂しいので最初から中身を置く(画面のアイコンとも一致する)
    '/home/user/Desktop/welcome.txt': {
      type: 'file',
      content: 'NEXUS OS へようこそ。\nターミナルで `help` と打つと使い方が出ます。\n',
      ct: t, mt: t,
    },
    '/home/user/Desktop/はじめに.md': {
      type: 'file',
      content: '# はじめに\n\n- 下端にカーソルを置くとドック\n- 窓は右上の ◇ でフロート/タイル切替\n- エクスプローラーはタイル/グラフ/ノードの3表示\n- 設定からデータの Export/Import ができます\n',
      ct: t, mt: t,
    },
    '/home/user/Desktop/メモ': { type: 'dir', ct: t, mt: t },
  }
  localStorage.setItem(KEY, JSON.stringify(s))
  return s
}

let store: Store = load()
const subs = new Set<() => void>()
function commit() {
  localStorage.setItem(KEY, JSON.stringify(store))
  subs.forEach((c) => c())
}

// ---- log(作業/変更/起動の記録) ----
// /home/user/.log/events.json に最新順で保持。件数は nexus.logmax(既定3・最大10)。
const LOG_DIR = '/home/user/.log'
const LOG_FILE = '/home/user/.log/events.json'
export type LogEntry = { t: number; kind: string; msg: string }
function logMax(): number {
  const n = Number(localStorage.getItem('nexus.logmax'))
  return Number.isFinite(n) && n >= 1 ? Math.min(10, Math.floor(n)) : 3
}
function readLog(): LogEntry[] {
  try { const a = JSON.parse((store[LOG_FILE] as { content: string } | undefined)?.content || '[]'); return Array.isArray(a) ? a : [] } catch { return [] }
}
let logging = false
function writeLog(entries: LogEntry[]) {
  // log書き込み自体を履歴/再帰logの対象にしない
  logging = true
  if (!store[LOG_DIR]) { const t = Date.now(); store[LOG_DIR] = { type: 'dir', ct: t, mt: t } }
  const t = Date.now()
  store[LOG_FILE] = { type: 'file', content: JSON.stringify(entries.slice(0, logMax())), ct: store[LOG_FILE]?.ct ?? t, mt: t }
  localStorage.setItem(KEY, JSON.stringify(store))
  subs.forEach((c) => c())
  logging = false
}

// ---- 履歴(undo/redo) = store全体スナップショット方式(木は小さいので十分) ----
const clone = (s: Store): Store => JSON.parse(JSON.stringify(s))
const undoStack: Store[] = []
let redoStack: Store[] = []
let batching = false
// 構造変更(mkdir/rm/rename/新規writeFile)の前に1回だけ記録。ネストは1スナップに束ねる。
function withHistory<T>(fn: () => T): T {
  if (batching) return fn()
  batching = true
  undoStack.push(clone(store))
  if (undoStack.length > 60) undoStack.shift()
  redoStack = []
  try {
    return fn()
  } finally {
    batching = false
  }
}

// ---- パス解決 ----
export function resolve(cwd: string, p: string): string {
  if (!p) return cwd
  let base = p.startsWith('/') ? '/' : cwd
  const parts = (p.startsWith('/') ? p : `${cwd}/${p}`).split('/').filter(Boolean)
  const stack: string[] = []
  for (const part of parts) {
    if (part === '.') continue
    if (part === '..') stack.pop()
    else stack.push(part)
  }
  base = '/' + stack.join('/')
  return base === '/' ? '/' : base.replace(/\/$/, '')
}
function parent(path: string): string {
  if (path === '/') return '/'
  const i = path.lastIndexOf('/')
  return i <= 0 ? '/' : path.slice(0, i)
}
export function basename(path: string): string {
  return path === '/' ? '/' : path.slice(path.lastIndexOf('/') + 1)
}

// 検索: パス名 or (ファイルなら)中身に query(小文字済み)を含むか。
// 倉庫の核 = 名前を覚えてなくても「中身」で手繰り寄せられる(検索グセ対策)。
export function matchPath(p: string, ql: string): boolean {
  if (!ql) return true
  if (basename(p).toLowerCase().includes(ql)) return true
  return vfs.isFile(p) && vfs.read(p).toLowerCase().includes(ql)
}

// ---- 操作 ----
export const vfs = {
  exists: (p: string) => p in store,
  isDir: (p: string) => store[p]?.type === 'dir',
  isFile: (p: string) => store[p]?.type === 'file',
  read: (p: string) => (store[p]?.type === 'file' ? (store[p] as { content: string }).content : ''),
  ls: (p: string): string[] =>
    Object.keys(store)
      .filter((k) => k !== p && parent(k) === p)
      .map(basename)
      .sort(),
  // p 配下の全パス(自分は含まない)。グラフ/ノード表示用。
  subtree: (p: string): string[] =>
    Object.keys(store).filter((k) => k !== p && (p === '/' ? k !== '/' : k.startsWith(p + '/'))),
  parentOf: (p: string) => parent(p),
  // ファイル/フォルダのメタ情報(作成/更新時刻・サイズ)。
  stat(p: string): { ct: number; mt: number; size: number; dir: boolean } | null {
    const n = store[p]
    if (!n) return null
    const ct = n.ct ?? 0
    const mt = n.mt ?? ct
    const size = n.type === 'file' ? new TextEncoder().encode(n.content).length : Object.keys(store).filter((k) => k !== p && parent(k) === p).length
    return { ct, mt, size, dir: n.type === 'dir' }
  },
  mkdir(p: string) {
    if (store[p]) return
    withHistory(() => {
      const par = parent(p)
      if (!store[par]) this.mkdir(par)
      const t = now()
      store[p] = { type: 'dir', ct: t, mt: t }
      commit()
    })
    this.logEvent('変更', `フォルダ作成 ${p}`)
  },
  // track=false: エディタ自動保存(中身編集)は履歴に残さない。新規/構造変更時のみ記録。
  writeFile(p: string, content = '', track = true) {
    const isNew = !store[p]
    const run = () => {
      const par = parent(p)
      if (!store[par]) this.mkdir(par)
      const t = now()
      const ct = store[p]?.ct ?? t
      store[p] = { type: 'file', content, ct, mt: t }
      commit()
    }
    if (track && isNew) withHistory(run)
    else run()
    if (track && isNew && !p.startsWith(LOG_DIR)) this.logEvent('変更', `ファイル作成 ${p}`)
  },
  rm(p: string) {
    if (p === '/' || p === '/home/user') return
    withHistory(() => {
      for (const k of Object.keys(store)) if (k === p || k.startsWith(p + '/')) delete store[k]
      commit()
    })
    this.logEvent('変更', `削除 ${p}`)
  },
  rename(p: string, name: string) {
    const np = parent(p) === '/' ? `/${name}` : `${parent(p)}/${name}`
    if (store[np]) return
    withHistory(() => {
      for (const k of Object.keys(store))
        if (k === p || k.startsWith(p + '/')) {
          store[np + k.slice(p.length)] = store[k]
          delete store[k]
        }
      commit()
    })
    this.logEvent('変更', `名前変更 ${p} → ${name}`)
  },
  // 別フォルダへ移動(コピー&削除でなく木ごと移し替え)。dest=移動先ディレクトリ。
  move(p: string, destDir: string) {
    if (p === '/' || p === '/home/user') return
    const np = destDir === '/' ? `/${basename(p)}` : `${destDir}/${basename(p)}`
    if (store[np] || np === p || np.startsWith(p + '/')) return
    withHistory(() => {
      for (const k of Object.keys(store))
        if (k === p || k.startsWith(p + '/')) {
          store[np + k.slice(p.length)] = store[k]
          delete store[k]
        }
      commit()
    })
    this.logEvent('変更', `移動 ${p} → ${destDir}`)
  },
  undo() {
    if (!undoStack.length) return
    redoStack.push(clone(store))
    store = undoStack.pop()!
    commit()
  },
  redo() {
    if (!redoStack.length) return
    undoStack.push(clone(store))
    store = redoStack.pop()!
    commit()
  },
  canUndo: () => undoStack.length > 0,
  canRedo: () => redoStack.length > 0,
  // 複数の構造変更を1回のundoに束ねる(貼り付け/一括削除など)
  batch(fn: () => void) {
    withHistory(fn)
  },
  // log: 作業/変更/起動を記録(最大件数は nexus.logmax)。
  logEvent(kind: string, msg: string) {
    if (logging) return
    writeLog([{ t: Date.now(), kind, msg }, ...readLog()])
  },
  getLog: (): LogEntry[] => readLog(),
  logMax,
  setLogMax(n: number) {
    localStorage.setItem('nexus.logmax', String(Math.min(10, Math.max(1, Math.floor(n)))))
    writeLog(readLog()) // 上限変更を即反映
  },
}

// React 再描画用: vfsを読むコンポーネントはこれを呼ぶ
export function useVfs() {
  const [, set] = useState(0)
  useEffect(() => {
    const cb = () => set((x) => x + 1)
    subs.add(cb)
    return () => {
      subs.delete(cb)
    }
  }, [])
}
