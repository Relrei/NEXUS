import { useEffect, useState } from 'react'

// 仮想ファイルシステム(ローカルのみ・ネイティブには触れない=安全)。
// localStorage に木をJSONで持つ。ターミナル/ファイル/エディタが共有する単一の真実。
type Node = { type: 'dir' } | { type: 'file'; content: string }
type Store = Record<string, Node>

const KEY = 'nexus.vfs'

function load(): Store {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (s && s['/']) return s
  } catch {
    /* ignore */
  }
  // 初期FS
  const s: Store = {
    '/': { type: 'dir' },
    '/home': { type: 'dir' },
    '/home/user': { type: 'dir' },
    '/home/user/Desktop': { type: 'dir' },
    '/home/user/Documents': { type: 'dir' },
    '/home/user/Downloads': { type: 'dir' },
    '/home/user/welcome.txt': {
      type: 'file',
      content: 'NEXUS OS へようこそ。\nターミナルで `help` と打つと使い方が出ます。\n',
    },
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
  mkdir(p: string) {
    if (store[p]) return
    const par = parent(p)
    if (!store[par]) this.mkdir(par)
    store[p] = { type: 'dir' }
    commit()
  },
  writeFile(p: string, content = '') {
    const par = parent(p)
    if (!store[par]) this.mkdir(par)
    store[p] = { type: 'file', content }
    commit()
  },
  rm(p: string) {
    if (p === '/' || p === '/home/user') return
    for (const k of Object.keys(store)) if (k === p || k.startsWith(p + '/')) delete store[k]
    commit()
  },
  rename(p: string, name: string) {
    const np = parent(p) === '/' ? `/${name}` : `${parent(p)}/${name}`
    if (store[np]) return
    for (const k of Object.keys(store))
      if (k === p || k.startsWith(p + '/')) {
        store[np + k.slice(p.length)] = store[k]
        delete store[k]
      }
    commit()
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
