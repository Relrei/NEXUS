import { useEffect, useRef, useState } from 'react'
import { basename, matchPath, resolve, useVfs, vfs } from '../vfs'
import { IconFile, IconFolder } from '../../icons'
import { FilesGraph } from './FilesGraph'
import { FilesNodes } from './FilesNodes'

type View = 'tile' | 'graph' | 'nodes'
type SortKey = 'name' | 'mt' | 'ct' | 'size'

// GNOME/GTK4 Files(Nautilus)風エクスプローラー。
const QUICK_DEF = [
  { name: 'デスクトップ', path: '/home/user/Desktop' },
  { name: 'ダウンロード', path: '/home/user/Downloads' },
  { name: 'ドキュメント', path: '/home/user/Documents' },
  { name: 'ピクチャ', path: '/home/user/Pictures' },
]
const QUICK_NAME: Record<string, string> = Object.fromEntries(QUICK_DEF.map((q) => [q.path, q.name]))
const PC = [{ name: 'PC', path: '/home/user' }, { name: 'ネットワーク', path: '/' }]
const join = (d: string, n: string) => (d === '/' ? `/${n}` : `${d}/${n}`)

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
function fmtDate(ms: number): string {
  if (!ms) return '—'
  const d = new Date(ms)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

type Menu = { x: number; y: number; name?: string } | null
type MItem = { sep: true } | { sep?: false; label: string; shortcut?: string; disabled?: boolean; on: () => void }

export function Files({ onOpen }: { onOpen?: (path: string) => void }) {
  useVfs()
  const [cwd, setCwd] = useState('/home/user')
  const [hist, setHist] = useState<string[]>(['/home/user'])
  const [hi, setHi] = useState(0)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [anchor, setAnchor] = useState<string | null>(null)
  const [menu, setMenu] = useState<Menu>(null)
  const [clip, setClip] = useState<{ paths: string[]; cut: boolean } | null>(null)
  const [vmode, setVmode] = useState<View>('tile')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [topMenu, setTopMenu] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [editPath, setEditPath] = useState<string | null>(null) // パスバーをテキスト編集中か
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'name', asc: true })
  const [quickOrder, setQuickOrder] = useState<string[]>(() => {
    try { const s = JSON.parse(localStorage.getItem('nexus.quickorder') || 'null'); if (Array.isArray(s)) return s } catch { /* */ }
    return QUICK_DEF.map((q) => q.path)
  })
  const [marks, setMarks] = useState<string[]>(() => {
    try { const s = JSON.parse(localStorage.getItem('nexus.bookmarks') || 'null'); if (Array.isArray(s)) return s } catch { /* */ }
    return []
  })
  // ローカルフォルダ(仮想マウント。アプリ版で実フォルダに接続する布石)
  const [mounts, setMounts] = useState<string[]>(() => {
    try { const s = JSON.parse(localStorage.getItem('nexus.mounts') || 'null'); if (Array.isArray(s)) return s } catch { /* */ }
    return []
  })
  const dragIdx = useRef<number | null>(null) // クイックアクセスD&Dの掴み位置
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => { localStorage.setItem('nexus.quickorder', JSON.stringify(quickOrder)) }, [quickOrder])
  useEffect(() => { localStorage.setItem('nexus.bookmarks', JSON.stringify(marks)) }, [marks])
  useEffect(() => { localStorage.setItem('nexus.mounts', JSON.stringify(mounts)) }, [mounts])

  const entries = vfs.ls(cwd)
  // 並び替え(フォルダ→ファイルの順は維持し、各群の中を key で)。
  // 隠しファイル(.で始まる .log 等)は常に末尾へ回す。
  const cmp = (a: string, b: string) => {
    const ha = a.startsWith('.'), hb = b.startsWith('.')
    if (ha !== hb) return ha ? 1 : -1
    const sa = vfs.stat(resolve(cwd, a)), sb = vfs.stat(resolve(cwd, b))
    let r = 0
    if (sort.key === 'name' || !sa || !sb) r = a.localeCompare(b, 'ja')
    else if (sort.key === 'size') r = sa.size - sb.size
    else r = sa[sort.key] - sb[sort.key]
    if (r === 0) r = a.localeCompare(b, 'ja')
    return sort.asc ? r : -r
  }
  const dirs = entries.filter((n) => vfs.isDir(resolve(cwd, n))).sort(cmp)
  const files = entries.filter((n) => !vfs.isDir(resolve(cwd, n))).sort(cmp)
  const order = [...dirs, ...files]

  const ql = q.trim().toLowerCase()
  const hits = ql ? vfs.subtree(cwd).filter((p) => matchPath(p, ql)) : []

  // 現在地のノードトレイル(パスを一直線のノードで・どこまで来たか)
  const trail = (cwd === '/' ? ['/'] : cwd.split('/').map((_, i, arr) => '/' + arr.slice(1, i + 1).join('/')))
    .map((p) => ({ path: p === '' ? '/' : p, name: basename(p) || 'PC' }))

  function navigate(p: string) {
    if (!vfs.exists(p)) return
    setSel(new Set())
    setCwd(p)
    const h = hist.slice(0, hi + 1)
    h.push(p)
    setHist(h)
    setHi(h.length - 1)
  }
  const back = () => hi > 0 && (setHi(hi - 1), setCwd(hist[hi - 1]), setSel(new Set()))
  const fwd = () => hi < hist.length - 1 && (setHi(hi + 1), setCwd(hist[hi + 1]), setSel(new Set()))
  const up = () => cwd !== '/' && navigate(resolve(cwd, '..'))
  const open = (name: string) => {
    const p = resolve(cwd, name)
    if (vfs.isDir(p)) navigate(p)
    else onOpen?.(p)
  }
  // パスを貼り付け/入力してジャンプ(フォルダ=移動・ファイル=開く)
  function jumpTo(raw: string) {
    const p = resolve(cwd, raw.trim())
    if (!vfs.exists(p)) return
    if (vfs.isDir(p)) navigate(p)
    else onOpen?.(p)
  }

  // ---- 選択 ----
  function clickItem(name: string, e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) {
    if (e.shiftKey) window.getSelection()?.removeAllRanges()
    if (e.shiftKey && anchor) {
      const a = order.indexOf(anchor), b = order.indexOf(name)
      if (a >= 0 && b >= 0) { const [lo, hi2] = a < b ? [a, b] : [b, a]; setSel(new Set(order.slice(lo, hi2 + 1))) }
    } else if (e.ctrlKey || e.metaKey) {
      setSel((s) => { const n = new Set(s); n.has(name) ? n.delete(name) : n.add(name); return n }); setAnchor(name)
    } else { setSel(new Set([name])); setAnchor(name) }
  }
  const selPaths = () => [...sel].map((n) => resolve(cwd, n))

  // ---- ドラッグ＆ドロップで移動 ----
  const dragItems = useRef<string[]>([]) // 掴んでいる項目の絶対パス
  const [dropTarget, setDropTarget] = useState<string | null>(null) // ドロップ先フォルダ(ハイライト)
  // ドラッグ中ゴースト(WebKitGTKは標準ドラッグ画像が出ないので自前で「何を掴んでるか」を表示)
  const [ghost, setGhost] = useState<{ label: string; count: number; x: number; y: number } | null>(null)
  // 掴んだ項目が選択内なら選択全部、そうでなければその1個だけ動かす
  function startItemDrag(name: string, e?: React.DragEvent) {
    const names = sel.has(name) ? [...sel] : [name]
    dragItems.current = names.map((n) => resolve(cwd, n))
    setGhost({ label: name, count: names.length, x: e?.clientX ?? 0, y: e?.clientY ?? 0 })
    // 標準のドラッグ画像(WebKitGTKでは空白/壊れがち)を透明にして自前ゴーストだけ見せる
    if (e?.dataTransfer) {
      const img = new Image()
      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
      try { e.dataTransfer.setDragImage(img, 0, 0) } catch { /* */ }
    }
  }
  // ドラッグ中のゴースト位置追従＆終了で消す
  useEffect(() => {
    if (!ghost) return
    const move = (e: DragEvent) => setGhost((g) => (g ? { ...g, x: e.clientX, y: e.clientY } : g))
    const end = () => setGhost(null)
    window.addEventListener('dragover', move)
    window.addEventListener('dragend', end)
    window.addEventListener('drop', end)
    return () => {
      window.removeEventListener('dragover', move)
      window.removeEventListener('dragend', end)
      window.removeEventListener('drop', end)
    }
  }, [ghost])
  function moveInto(destDir: string) {
    const srcs = dragItems.current
    dragItems.current = []
    setDropTarget(null)
    setGhost(null)
    if (!srcs.length || !vfs.isDir(destDir)) return
    vfs.batch(() => srcs.forEach((s) => { if (vfs.parentOf(s) !== destDir) vfs.move(s, destDir) }))
    setSel(new Set())
  }

  // ---- 操作 ----
  function newFolder() {
    const n = prompt('新規フォルダー名', '新しいフォルダー')
    if (n) vfs.mkdir(resolve(cwd, n))
  }
  function newFile() {
    // 空のうちは作らない(何も書かなければ保存しない)。エディタが最初の入力で生成。
    const n = prompt('新規ファイル名', 'untitled.txt')
    if (n) onOpen?.(resolve(cwd, n))
  }
  function rename() {
    if (sel.size !== 1) return
    const name = [...sel][0]
    const n = prompt('名前変更', name)
    if (n && n !== name) vfs.rename(resolve(cwd, name), n)
  }
  function del() {
    const ps = selPaths()
    if (!ps.length) return
    if (confirm(ps.length === 1 ? `${basename(ps[0])} を削除しますか？` : `${ps.length}個の項目を削除しますか？`)) {
      vfs.batch(() => ps.forEach((p) => vfs.rm(p)))
      setSel(new Set())
    }
  }
  const copy = (cut: boolean) => { const ps = selPaths(); if (ps.length) setClip({ paths: ps, cut }) }
  function deepCopy(src: string, dest: string) {
    if (vfs.isDir(src)) { vfs.mkdir(dest); for (const c of vfs.ls(src)) deepCopy(join(src, c), join(dest, c)) }
    else vfs.writeFile(dest, vfs.read(src))
  }
  function paste() {
    if (!clip) return
    vfs.batch(() => {
      for (const src of clip.paths) {
        if (clip.cut) vfs.move(src, cwd)
        else {
          const base = basename(src)
          let dest = join(cwd, base)
          for (let i = 1; vfs.exists(dest); i++) dest = join(cwd, `${base} (${i})`)
          deepCopy(src, dest)
        }
      }
    })
    if (clip.cut) setClip(null)
  }
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: true }))
  // クイックアクセスD&D並び替え: from→to へ要素を差し込む
  const reorderQuick = (from: number, to: number) => setQuickOrder((o) => {
    if (from === to || from < 0 || to < 0 || from >= o.length || to >= o.length) return o
    const n = [...o]; const [moved] = n.splice(from, 1); n.splice(to, 0, moved); return n
  })
  const addMark = (p: string) => { if (vfs.isDir(p) && !marks.includes(p)) setMarks((m) => [...m, p]) }
  const removeMark = (p: string) => setMarks((m) => m.filter((x) => x !== p))
  const copyPath = (p: string) => navigator.clipboard?.writeText(p)
  // ローカルフォルダ追加(今は仮想マウント点をVFSに作る。アプリ版で実フォルダにバインド予定)
  function addLocal() {
    const name = prompt('追加するローカルフォルダ名（アプリ版で実フォルダに接続予定）', 'マイフォルダ')
    if (!name) return
    const p = `/home/user/ローカル/${name}`
    vfs.mkdir(p)
    if (!mounts.includes(p)) setMounts((m) => [...m, p])
    navigate(p)
  }
  const removeMount = (p: string) => setMounts((m) => m.filter((x) => x !== p))

  // ---- キーボード ----
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const onKey = (e: KeyboardEvent) => {
      if (!el.contains(document.activeElement) && document.activeElement !== document.body) return
      if (!el.matches(':hover') && !el.contains(document.activeElement)) return
      const ae = document.activeElement
      if (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement) return
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (mod && k === 'a') { e.preventDefault(); setSel(new Set(entries)); return }
      if (mod && !e.shiftKey && k === 'z') { e.preventDefault(); vfs.undo(); return }
      if (mod && ((e.shiftKey && k === 'z') || k === 'y')) { e.preventDefault(); vfs.redo(); return }
      if (mod && k === 'c') { e.preventDefault(); copy(false); return }
      if (mod && k === 'x') { e.preventDefault(); copy(true); return }
      if (mod && k === 'v') { e.preventDefault(); paste(); return }
      if (e.key === 'F2') { e.preventDefault(); rename() }
      else if (e.key === 'Delete') { e.preventDefault(); del() }
      else if (e.key === 'Enter' && sel.size === 1) { e.preventDefault(); open([...sel][0]) }
      else if (e.key === 'Backspace') { e.preventDefault(); up() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const navBtn = (active: boolean) =>
    `flex flex-1 items-center gap-1.5 rounded px-2 py-1 text-left text-[12px] ${active ? 'bg-white/15 text-white' : 'text-neutral-300 hover:bg-white/10'}`
  const sortMark = (key: SortKey) => (sort.key === key ? (sort.asc ? ' ▲' : ' ▼') : '')
  const toggleExp = (p: string) => setExpanded((s) => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n })

  // サイドバーの階段フォルダ行。サブフォルダを下の行に＞で展開(staircase)。
  function FolderRow({ path, label, depth, grip, onRemove }: { path: string; label: string; depth: number; grip?: boolean; onRemove?: () => void }) {
    const exists = vfs.exists(path)
    const subs = exists && vfs.isDir(path) ? vfs.ls(path).map((n) => join(path, n)).filter((c) => vfs.isDir(c)).sort((a, b) => basename(a).localeCompare(basename(b), 'ja')) : []
    const exp = expanded.has(path)
    return (
      <>
        <div className="group flex items-center" style={{ paddingLeft: depth * 12 }}>
          {grip && <span className="cursor-grab px-0.5 text-[10px] text-neutral-600 opacity-0 group-hover:opacity-100" title="ドラッグで並べ替え">⠿</span>}
          <button draggable={false} onPointerDown={(e) => e.stopPropagation()} onClick={() => subs.length && toggleExp(path)} className="w-3.5 shrink-0 text-center text-[10px] text-neutral-500 hover:text-white">{subs.length ? (exp ? '▾' : '＞') : ''}</button>
          <button
            draggable={false}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => (exists ? navigate(path) : (vfs.mkdir(path), navigate(path)))}
            onDragOver={(e) => { if (dragItems.current.length) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget(path) } }}
            onDragLeave={() => setDropTarget((d) => (d === path ? null : d))}
            onDrop={(e) => { if (dragItems.current.length) { e.preventDefault(); e.stopPropagation(); moveInto(path) } }}
            className={`${navBtn(cwd === path)} ${dropTarget === path ? 'ring-1 ring-white/70 bg-white/15' : ''}`}
            title={path}
          >
            <IconFolder className="h-4 w-4 shrink-0" />{label}
          </button>
          {onRemove && <button draggable={false} onPointerDown={(e) => e.stopPropagation()} onClick={onRemove} className="px-1 text-[10px] text-neutral-500 opacity-0 hover:text-red-300 group-hover:opacity-100">✕</button>}
        </div>
        {exp && subs.map((c) => <FolderRow key={c} path={c} label={basename(c)} depth={depth + 1} />)}
      </>
    )
  }

  // ---- メニューバー ----
  const SEP: MItem = { sep: true }
  const single = sel.size === 1
  const some = sel.size > 0
  const MENUS: { id: string; label: string; items: MItem[] }[] = [
    {
      id: 'file', label: 'ファイル', items: [
        { label: '新規フォルダー', shortcut: 'Ctrl+Shift+N', on: newFolder },
        { label: '新規ファイル', on: newFile },
        SEP,
        { label: '開く', shortcut: 'Enter', disabled: !single, on: () => single && open([...sel][0]) },
        { label: '名前変更', shortcut: 'F2', disabled: !single, on: rename },
        { label: 'ゴミ箱へ移動', shortcut: 'Delete', disabled: !some, on: del },
      ],
    },
    {
      id: 'edit', label: '編集', items: [
        { label: '元に戻す', shortcut: 'Ctrl+Z', disabled: !vfs.canUndo(), on: () => vfs.undo() },
        { label: 'やり直す', shortcut: 'Ctrl+Shift+Z', disabled: !vfs.canRedo(), on: () => vfs.redo() },
        SEP,
        { label: '切り取り', shortcut: 'Ctrl+X', disabled: !some, on: () => copy(true) },
        { label: 'コピー', shortcut: 'Ctrl+C', disabled: !some, on: () => copy(false) },
        { label: '貼り付け', shortcut: 'Ctrl+V', disabled: !clip, on: paste },
        SEP,
        { label: 'すべて選択', shortcut: 'Ctrl+A', on: () => setSel(new Set(entries)) },
      ],
    },
    {
      id: 'view', label: '表示', items: [
        { label: `${vmode === 'tile' ? '● ' : ''}タイル`, on: () => setVmode('tile') },
        { label: `${vmode === 'graph' ? '● ' : ''}グラフ`, on: () => setVmode('graph') },
        { label: `${vmode === 'nodes' ? '● ' : ''}ノード`, on: () => setVmode('nodes') },
        SEP,
        { label: `名前で並び替え${sortMark('name')}`, on: () => toggleSort('name') },
        { label: `更新日で並び替え${sortMark('mt')}`, on: () => toggleSort('mt') },
        { label: `作成日で並び替え${sortMark('ct')}`, on: () => toggleSort('ct') },
        { label: `サイズで並び替え${sortMark('size')}`, on: () => toggleSort('size') },
      ],
    },
    {
      id: 'go', label: '移動', items: [
        { label: '戻る', shortcut: 'Backspace', disabled: hi === 0, on: back },
        { label: '進む', disabled: hi >= hist.length - 1, on: fwd },
        { label: '上の階層へ', disabled: cwd === '/', on: up },
        SEP,
        { label: 'ホーム', on: () => navigate('/home/user') },
      ],
    },
    {
      id: 'help', label: 'ヘルプ', items: [
        { label: 'キーボードショートカット', on: () => alert('Ctrl+A すべて選択 / Ctrl+C コピー / Ctrl+X 切り取り / Ctrl+V 貼り付け\nCtrl+Z 元に戻す / Ctrl+Shift+Z やり直す / Ctrl+S 保存(エディタ)\nF2 名前変更 / Delete 削除 / Enter 開く / Backspace 上へ\nShift+クリック=範囲選択 / Ctrl+クリック=追加選択') },
        { label: 'NEXUS エクスプローラーについて', on: () => alert('NEXUS Files — GNOME/GTK4 Files 風\nタイル/グラフ/ノードの3ビューで仮想FSを閲覧。') },
      ],
    },
  ]

  return (
    <div ref={rootRef} tabIndex={0} className="flex h-full flex-col text-sm outline-none" onClick={() => { menu && setMenu(null); topMenu && setTopMenu(null) }}>
      {/* メニューバー + ビュー切替(左) + 検索(右・ヘルプの横) */}
      <div className="flex items-center gap-0.5 border-b border-white/10 px-1 py-0.5 text-[12px]">
        {MENUS.map((m) => (
          <div key={m.id} className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setTopMenu((o) => (o === m.id ? null : m.id)) }}
              onMouseEnter={() => topMenu && setTopMenu(m.id)}
              className={`rounded px-2 py-0.5 ${topMenu === m.id ? 'bg-white/15 text-white' : 'text-neutral-300 hover:bg-white/10'}`}
            >
              {m.label}
            </button>
            {topMenu === m.id && (
              <div className="glass absolute top-full left-0 z-50 mt-0.5 w-60 rounded-lg p-1" onClick={(e) => e.stopPropagation()}>
                {m.items.map((it, i) =>
                  it.sep ? <div key={i} className="my-1 h-px bg-white/10" /> : (
                    <button key={i} disabled={it.disabled} onClick={() => { it.on(); setTopMenu(null) }} className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-neutral-200 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent">
                      <span>{it.label}</span>
                      {it.shortcut && <span className="ml-3 text-[10px] text-neutral-500">{it.shortcut}</span>}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        ))}
        <span className="mx-1.5 h-4 w-px bg-white/10" />
        <div className="flex shrink-0 overflow-hidden rounded-full bg-white/5 text-[11px]">
          {(['tile', 'graph', 'nodes'] as View[]).map((v) => (
            <button key={v} onClick={() => setVmode(v)} className={`px-2.5 py-0.5 ${vmode === v ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}>
              {v === 'tile' ? 'タイル' : v === 'graph' ? 'グラフ' : 'ノード'}
            </button>
          ))}
        </div>
        {/* 検索: ヘルプの横(右端) */}
        <div className="ml-auto flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px]">
          <span className="text-neutral-500">🔍</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQ('')}
            placeholder={`${basename(cwd) || 'PC'} 内を検索`}
            className="w-32 bg-transparent text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
          />
          {q && <button onClick={() => setQ('')} className="text-neutral-500 hover:text-neutral-200">✕</button>}
        </div>
      </div>

      {/* パスバー = 一直線ノードトレイル(クリックで移動)。空き領域クリックでパス編集(コピー/貼り付けジャンプ) */}
      <div className="flex items-center gap-2 border-b border-white/10 px-2 py-1.5">
        <button onClick={back} disabled={hi === 0} className="rounded px-1.5 text-neutral-300 hover:bg-white/10 disabled:opacity-30">←</button>
        <button onClick={fwd} disabled={hi >= hist.length - 1} className="rounded px-1.5 text-neutral-300 hover:bg-white/10 disabled:opacity-30">→</button>
        <button onClick={up} disabled={cwd === '/'} className="rounded px-1.5 text-neutral-300 hover:bg-white/10 disabled:opacity-30">↑</button>
        {editPath !== null ? (
          <input
            autoFocus
            defaultValue={editPath}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { jumpTo(e.currentTarget.value); setEditPath(null) }
              else if (e.key === 'Escape') setEditPath(null)
            }}
            onBlur={() => setEditPath(null)}
            className="flex-1 rounded-full border border-white/25 bg-white/10 px-3 py-1 font-mono text-xs text-neutral-100 focus:outline-none"
          />
        ) : (
          <div
            className="flex flex-1 items-center overflow-x-auto rounded-full border border-white/10 bg-white/5 px-2 py-1"
            onClick={() => setEditPath(cwd)}
            title="クリックでパス編集・コピー / パスを貼り付けて Enter でジャンプ"
          >
            {trail.map((seg, i) => (
              <span key={seg.path} className="flex shrink-0 items-center">
                {i > 0 && <span className="h-px w-4 bg-white/25" />}
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(seg.path) }}
                  onDragOver={(e) => { if (dragItems.current.length) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget(seg.path) } }}
                  onDragLeave={() => setDropTarget((d) => (d === seg.path ? null : d))}
                  onDrop={(e) => { if (dragItems.current.length) { e.preventDefault(); e.stopPropagation(); moveInto(seg.path) } }}
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${dropTarget === seg.path ? 'ring-1 ring-white/70 bg-white/15' : seg.path === cwd ? 'bg-white/20 text-white' : 'text-neutral-300 hover:bg-white/10'}`}
                  title={seg.path}
                >
                  <span className="h-2 w-2 rounded-full bg-current opacity-70" />{seg.name}
                </button>
              </span>
            ))}
            <span className="min-w-[2.5rem] flex-1 self-stretch" />
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* サイドバー = クイックアクセス統合フォルダ(階段ツリー)。ツリータブは廃止。 */}
        <div className="w-52 shrink-0 overflow-auto border-r border-white/10 p-2">
          <div>
            <div className="px-2 pb-1 text-[10px] text-neutral-500">★ クイック アクセス（ドラッグで並べ替え・＞で展開）</div>
            {quickOrder.map((path, i) => (
              <div
                key={path}
                draggable
                onDragStart={() => (dragIdx.current = i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (dragIdx.current !== null) reorderQuick(dragIdx.current, i); dragIdx.current = null }}
              >
                <FolderRow path={path} label={QUICK_NAME[path] ?? basename(path)} depth={0} grip />
              </div>
            ))}
          </div>
          <div className="mt-2">
            <div className="px-2 pb-1 text-[10px] text-neutral-500">PC</div>
            {PC.map((qq) => <FolderRow key={qq.path} path={qq.path} label={qq.name} depth={0} />)}
          </div>
          {marks.length > 0 && (
            <div className="mt-2">
              <div className="px-2 pb-1 text-[10px] text-neutral-500">ショートカット</div>
              {marks.map((p) => <FolderRow key={p} path={p} label={basename(p)} depth={0} onRemove={() => removeMark(p)} />)}
            </div>
          )}
          <div className="mt-2">
            <div className="flex items-center justify-between px-2 pb-1">
              <span className="text-[10px] text-neutral-500">ローカル</span>
              <button onClick={addLocal} title="ローカルフォルダを追加" className="text-[12px] leading-none text-neutral-400 hover:text-white">＋</button>
            </div>
            {mounts.map((p) => <FolderRow key={p} path={p} label={basename(p)} depth={0} onRemove={() => removeMount(p)} />)}
            {mounts.length === 0 && <div className="px-2 text-[10px] text-neutral-600">＋で追加</div>}
          </div>
        </div>

        {/* メイン */}
        {vmode === 'tile' && ql ? (
          <div className="min-w-0 flex-1 overflow-auto p-3 select-none">
            <div className="mb-1 text-xs text-neutral-400">「{q.trim()}」の検索結果 ({hits.length})</div>
            {hits.length === 0 ? (
              <p className="mt-8 text-center text-xs text-neutral-600">一致する項目がありません</p>
            ) : (
              <div className="space-y-0.5">
                {hits.map((p) => (
                  <button key={p} onClick={() => (vfs.isDir(p) ? navigate(p) : onOpen?.(p))} className="flex w-full items-center gap-2 rounded p-1.5 text-left hover:bg-white/10" title={p}>
                    {vfs.isDir(p) ? <IconFolder className="h-5 w-5 shrink-0 text-neutral-200" /> : <IconFile className="h-5 w-5 shrink-0 text-neutral-400" />}
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] text-neutral-100">{basename(p)}</span>
                      <span className="block truncate text-[10px] text-neutral-500">{vfs.parentOf(p)}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : vmode === 'tile' ? (
          <div
            className="min-w-0 flex-1 overflow-auto p-3 select-none"
            onClick={() => setSel(new Set())}
            onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }) }}
          >
            {/* ソート列ヘッダー(クリックで名前/サイズ/更新日時に並び替え) */}
            <div className="mb-2 flex items-center gap-2 border-b border-white/10 pb-1 text-[11px] text-neutral-400" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => toggleSort('name')} className={`flex-1 text-left hover:text-white ${sort.key === 'name' ? 'text-white' : ''}`}>名前{sortMark('name')}</button>
              <button onClick={() => toggleSort('size')} className={`w-24 text-right hover:text-white ${sort.key === 'size' ? 'text-white' : ''}`}>サイズ{sortMark('size')}</button>
              <button onClick={() => toggleSort('mt')} className={`w-32 text-right hover:text-white ${sort.key === 'mt' ? 'text-white' : ''}`}>更新日時{sortMark('mt')}</button>
            </div>
            {dirs.length > 0 && <div className="mb-1 text-xs text-neutral-400">フォルダー ({dirs.length})</div>}
            <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
              {dirs.map((name) => (
                <Tile key={name} name={name} dir stat={vfs.stat(resolve(cwd, name))} selected={sel.has(name)} onClick={(e) => clickItem(name, e)} onOpen={() => open(name)} onMenu={(x, y) => { if (!sel.has(name)) setSel(new Set([name])); setMenu({ x, y, name }) }} onDragStart={(e) => startItemDrag(name, e)} onDropInto={() => moveInto(resolve(cwd, name))} />
              ))}
            </div>
            {files.length > 0 && <div className="mt-3 mb-1 text-xs text-neutral-400">ファイル ({files.length})</div>}
            <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
              {files.map((name) => (
                <Tile key={name} name={name} stat={vfs.stat(resolve(cwd, name))} selected={sel.has(name)} onClick={(e) => clickItem(name, e)} onOpen={() => open(name)} onMenu={(x, y) => { if (!sel.has(name)) setSel(new Set([name])); setMenu({ x, y, name }) }} onDragStart={(e) => startItemDrag(name, e)} />
              ))}
            </div>
            {entries.length === 0 && <p className="mt-8 text-center text-xs text-neutral-600">（空のフォルダー）— 右クリックで新規作成</p>}
          </div>
        ) : vmode === 'graph' ? (
          <div className="min-w-0 flex-1"><FilesGraph cwd={cwd} q={ql} onOpen={(p) => onOpen?.(p)} onEnter={(p) => navigate(p)} /></div>
        ) : (
          <div className="grid-paper min-w-0 flex-1"><FilesNodes cwd={cwd} q={ql} onOpen={(p) => onOpen?.(p)} onEnter={(p) => navigate(p)} /></div>
        )}
      </div>

      <div className="border-t border-white/10 px-3 py-1 text-[10px] text-neutral-500">
        {entries.length} 個の項目{sel.size > 0 && ` — ${sel.size}個 選択`}
      </div>

      {/* 右クリックメニュー */}
      {menu && (
        <div style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()} className="glass fixed z-50 w-48 rounded-xl p-1 text-xs" onContextMenu={(e) => e.preventDefault()}>
          {menu.name ? (
            <>
              <MenuItem onClick={() => (open(menu.name!), setMenu(null))}>開く</MenuItem>
              <MenuItem onClick={() => (copy(false), setMenu(null))}>コピー{sel.size > 1 ? ` (${sel.size})` : ''}</MenuItem>
              <MenuItem onClick={() => (copy(true), setMenu(null))}>切り取り{sel.size > 1 ? ` (${sel.size})` : ''}</MenuItem>
              <MenuItem onClick={() => (rename(), setMenu(null))}>名前変更</MenuItem>
              <MenuItem onClick={() => (copyPath(resolve(cwd, menu.name!)), setMenu(null))}>パスのコピー</MenuItem>
              {vfs.isDir(resolve(cwd, menu.name)) && !marks.includes(resolve(cwd, menu.name)) && (
                <MenuItem onClick={() => (addMark(resolve(cwd, menu.name!)), setMenu(null))}>ショートカットに追加</MenuItem>
              )}
              <div className="my-1 h-px bg-white/10" />
              <MenuItem danger onClick={() => (del(), setMenu(null))}>削除{sel.size > 1 ? ` (${sel.size})` : ''}</MenuItem>
            </>
          ) : (
            <>
              <MenuItem onClick={() => (newFolder(), setMenu(null))}>新規フォルダー</MenuItem>
              <MenuItem onClick={() => (newFile(), setMenu(null))}>新規ファイル</MenuItem>
              {clip && <MenuItem onClick={() => (paste(), setMenu(null))}>貼り付け</MenuItem>}
              <MenuItem onClick={() => (copyPath(cwd), setMenu(null))}>このフォルダーのパスをコピー</MenuItem>
              <div className="my-1 h-px bg-white/10" />
              <MenuItem onClick={() => (setSel(new Set(entries)), setMenu(null))}>すべて選択</MenuItem>
            </>
          )}
        </div>
      )}

      {/* ドラッグ中ゴースト = 何を掴んでいるか(アイコン+名前+件数)をカーソルに追従表示 */}
      {ghost && (
        <div
          className="glass pointer-events-none fixed z-[60] flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] text-white shadow-lg"
          style={{ left: ghost.x + 12, top: ghost.y + 12 }}
        >
          <IconFile className="h-4 w-4 shrink-0" />
          <span className="max-w-40 truncate">{ghost.label}</span>
          {ghost.count > 1 && <span className="rounded-full bg-white/20 px-1.5 text-[10px]">{ghost.count}</span>}
        </div>
      )}
    </div>
  )
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`block w-full rounded-lg px-2 py-1 text-left ${danger ? 'text-red-300 hover:bg-red-500/20' : 'text-neutral-200 hover:bg-white/10'}`}>
      {children}
    </button>
  )
}

function Tile({ name, dir, stat, selected, onClick, onOpen, onMenu, onDragStart, onDropInto }: { name: string; dir?: boolean; stat: { ct: number; mt: number; size: number } | null; selected: boolean; onClick: (e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => void; onOpen: () => void; onMenu: (x: number, y: number) => void; onDragStart: (e: React.DragEvent) => void; onDropInto?: () => void }) {
  const [over, setOver] = useState(false)
  const sub = dir ? `フォルダー · ${stat?.size ?? 0}項目` : `${fmtSize(stat?.size ?? 0)}`
  return (
    <div
      draggable
      onDragStart={(e) => { e.stopPropagation(); try { e.dataTransfer.setData('text/plain', name); e.dataTransfer.effectAllowed = 'move' } catch { /* */ }; onDragStart(e) }}
      onDragOver={onDropInto ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(true) } : undefined}
      onDragLeave={onDropInto ? () => setOver(false) : undefined}
      onDrop={onDropInto ? (e) => { e.preventDefault(); e.stopPropagation(); setOver(false); onDropInto() } : undefined}
      onClick={(e) => { e.stopPropagation(); onClick(e) }}
      onDoubleClick={onOpen}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onMenu(e.clientX, e.clientY) }}
      className={`flex cursor-pointer items-center gap-2 rounded p-2 ${over ? 'bg-white/20 ring-2 ring-white/70' : selected ? 'bg-white/25 ring-1 ring-white/40' : 'hover:bg-white/10'}`}
      title={`${name}\n${sub}\n更新: ${fmtDate(stat?.mt ?? 0)}`}
    >
      {dir ? <IconFolder className="h-7 w-7 shrink-0 text-neutral-200" /> : <IconFile className="h-7 w-7 shrink-0 text-neutral-400" />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] text-neutral-100">{name}</div>
        <div className="truncate text-[10px] text-neutral-500">{sub} · {fmtDate(stat?.mt ?? 0)}</div>
      </div>
    </div>
  )
}
