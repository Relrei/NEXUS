import { useEffect, useRef, useState } from 'react'
import { basename, resolve, useVfs, vfs } from '../vfs'
import { IconFile, IconFolder } from '../../icons'
import { FilesGraph } from './FilesGraph'
import { FilesNodes } from './FilesNodes'

type View = 'tile' | 'graph' | 'nodes'

// Windows 11 風エクスプローラー。左ナビ＋ツールバー＋パンくず＋大タイル＋右クリック＋キー操作。
const QUICK = [
  { name: 'デスクトップ', path: '/home/user/Desktop' },
  { name: 'ダウンロード', path: '/home/user/Downloads' },
  { name: 'ドキュメント', path: '/home/user/Documents' },
  { name: 'ピクチャ', path: '/home/user/Pictures' },
]
const PC = [{ name: 'PC', path: '/home/user' }, { name: 'ネットワーク', path: '/' }]

type Menu = { x: number; y: number; name?: string } | null

export function Files({ onOpen }: { onOpen?: (path: string) => void }) {
  useVfs()
  const [cwd, setCwd] = useState('/home/user')
  const [hist, setHist] = useState<string[]>(['/home/user'])
  const [hi, setHi] = useState(0)
  const [sel, setSel] = useState<string | null>(null)
  const [menu, setMenu] = useState<Menu>(null)
  const [clip, setClip] = useState<{ path: string; cut: boolean } | null>(null)
  const [vmode, setVmode] = useState<View>('tile')
  const rootRef = useRef<HTMLDivElement>(null)

  const entries = vfs.ls(cwd)
  const dirs = entries.filter((n) => vfs.isDir(resolve(cwd, n)))
  const files = entries.filter((n) => !vfs.isDir(resolve(cwd, n)))

  function navigate(p: string) {
    if (!vfs.exists(p)) return
    setSel(null)
    setCwd(p)
    const h = hist.slice(0, hi + 1)
    h.push(p)
    setHist(h)
    setHi(h.length - 1)
  }
  const back = () => hi > 0 && (setHi(hi - 1), setCwd(hist[hi - 1]), setSel(null))
  const fwd = () => hi < hist.length - 1 && (setHi(hi + 1), setCwd(hist[hi + 1]), setSel(null))
  const up = () => cwd !== '/' && navigate(resolve(cwd, '..'))
  const open = (name: string) => {
    const p = resolve(cwd, name)
    if (vfs.isDir(p)) navigate(p)
    else onOpen?.(p)
  }
  function newFolder() {
    const n = prompt('新規フォルダ名', '新しいフォルダー')
    if (n) vfs.mkdir(resolve(cwd, n))
  }
  function newFile() {
    const n = prompt('新規ファイル名', 'untitled.txt')
    if (n) {
      const p = resolve(cwd, n)
      if (!vfs.exists(p)) vfs.writeFile(p, '')
      onOpen?.(p)
    }
  }
  function rename(name: string) {
    const n = prompt('名前変更', name)
    if (n && n !== name) vfs.rename(resolve(cwd, name), n)
  }
  function del(name: string) {
    if (confirm(`${name} を削除しますか？`)) {
      vfs.rm(resolve(cwd, name))
      setSel(null)
    }
  }
  function copy(name: string, cut: boolean) {
    setClip({ path: resolve(cwd, name), cut })
  }
  function paste() {
    if (!clip) return
    const name = basename(clip.path)
    let dest = resolve(cwd, name)
    for (let i = 1; vfs.exists(dest); i++) dest = resolve(cwd, `${name} (${i})`)
    if (clip.cut) vfs.rename(clip.path, basename(dest))
    else if (vfs.isFile(clip.path)) vfs.writeFile(dest, vfs.read(clip.path))
    if (clip.cut) setClip(null)
  }

  // キー操作(エクスプローラーにフォーカスがある時)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const onKey = (e: KeyboardEvent) => {
      if (!el.contains(document.activeElement) && document.activeElement !== document.body) return
      if (!el.matches(':hover') && !el.contains(document.activeElement)) return
      if (e.key === 'F2' && sel) { e.preventDefault(); rename(sel) }
      else if (e.key === 'Delete' && sel) { e.preventDefault(); del(sel) }
      else if (e.key === 'Enter' && sel) { e.preventDefault(); open(sel) }
      else if (e.key === 'Backspace') { e.preventDefault(); up() }
      else if ((e.ctrlKey && e.key === 'c') && sel) copy(sel, false)
      else if ((e.ctrlKey && e.key === 'x') && sel) copy(sel, true)
      else if (e.ctrlKey && e.key === 'v') paste()
    }
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  })

  const crumbs = cwd === '/' ? [''] : cwd.split('/')
  const navBtn = (active: boolean) =>
    `flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[12px] ${active ? 'bg-white/15 text-white' : 'text-neutral-300 hover:bg-white/10'}`

  return (
    <div ref={rootRef} tabIndex={0} className="flex h-full flex-col text-sm outline-none" onClick={() => menu && setMenu(null)}>
      {/* ツールバー */}
      <div className="flex items-center gap-1 border-b border-white/10 px-2 py-1">
        <button onClick={newFolder} className="rounded px-2 py-0.5 text-xs text-neutral-200 hover:bg-white/10">＋ 新規フォルダー</button>
        <button onClick={newFile} className="rounded px-2 py-0.5 text-xs text-neutral-200 hover:bg-white/10">＋ ファイル</button>
        {sel && <>
          <span className="mx-1 h-4 w-px bg-white/10" />
          <button onClick={() => copy(sel, false)} className="rounded px-2 py-0.5 text-xs text-neutral-200 hover:bg-white/10">コピー</button>
          <button onClick={() => rename(sel)} className="rounded px-2 py-0.5 text-xs text-neutral-200 hover:bg-white/10">名前変更</button>
          <button onClick={() => del(sel)} className="rounded px-2 py-0.5 text-xs text-red-300 hover:bg-red-500/20">削除</button>
        </>}
        {clip && <button onClick={paste} className="rounded px-2 py-0.5 text-xs text-neutral-200 hover:bg-white/10">貼り付け</button>}
        <div className="ml-auto flex shrink-0 overflow-hidden rounded-full bg-white/5 text-[11px]">
          <button onClick={() => setVmode('tile')} className={`px-2.5 py-0.5 ${vmode === 'tile' ? 'bg-white/15 text-white' : 'text-neutral-400'}`}>タイル</button>
          <button onClick={() => setVmode('graph')} className={`px-2.5 py-0.5 ${vmode === 'graph' ? 'bg-white/15 text-white' : 'text-neutral-400'}`}>グラフ</button>
          <button onClick={() => setVmode('nodes')} className={`px-2.5 py-0.5 ${vmode === 'nodes' ? 'bg-white/15 text-white' : 'text-neutral-400'}`}>ノード</button>
        </div>
      </div>

      {/* アドレスバー */}
      <div className="flex items-center gap-2 border-b border-white/10 px-2 py-1.5">
        <button onClick={back} disabled={hi === 0} className="rounded px-1.5 text-neutral-300 hover:bg-white/10 disabled:opacity-30">←</button>
        <button onClick={fwd} disabled={hi >= hist.length - 1} className="rounded px-1.5 text-neutral-300 hover:bg-white/10 disabled:opacity-30">→</button>
        <button onClick={up} disabled={cwd === '/'} className="rounded px-1.5 text-neutral-300 hover:bg-white/10 disabled:opacity-30">↑</button>
        <div className="flex flex-1 items-center gap-0.5 overflow-x-auto rounded border border-white/10 bg-white/5 px-2 py-1 text-xs">
          {crumbs.map((c, i) => {
            const p = '/' + crumbs.slice(1, i + 1).join('/')
            return (
              <span key={i} className="flex shrink-0 items-center">
                {i > 0 && <span className="px-1 text-neutral-600">›</span>}
                <button onClick={() => navigate(i === 0 ? '/' : p)} className="rounded px-1 text-neutral-200 hover:bg-white/10">{c || 'PC'}</button>
              </span>
            )
          })}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* 左ナビ */}
        <div className="w-44 shrink-0 space-y-2 overflow-auto border-r border-white/10 p-2">
          <div>
            <div className="px-2 pb-1 text-[10px] text-neutral-500">★ クイック アクセス</div>
            {QUICK.map((q) => (
              <button key={q.path} onClick={() => (vfs.exists(q.path) ? navigate(q.path) : (vfs.mkdir(q.path), navigate(q.path)))} className={navBtn(cwd === q.path)}>
                <IconFolder className="h-4 w-4 shrink-0" />{q.name}
              </button>
            ))}
          </div>
          <div>
            <div className="px-2 pb-1 text-[10px] text-neutral-500">PC</div>
            {PC.map((q) => (
              <button key={q.name} onClick={() => navigate(q.path)} className={navBtn(cwd === q.path)}>
                <IconFolder className="h-4 w-4 shrink-0" />{q.name}
              </button>
            ))}
          </div>
        </div>

        {/* メイン: タイル / グラフ / ノード */}
        {vmode === 'tile' ? (
          <div
            className="min-w-0 flex-1 overflow-auto p-3"
            onClick={() => setSel(null)}
            onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }) }}
          >
            {dirs.length > 0 && <div className="mb-1 text-xs text-neutral-400">フォルダー ({dirs.length})</div>}
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
              {dirs.map((name) => (
                <Tile key={name} name={name} dir selected={sel === name} onSelect={() => setSel(name)} onOpen={() => open(name)} onMenu={(x, y) => setMenu({ x, y, name })} />
              ))}
            </div>
            {files.length > 0 && <div className="mt-3 mb-1 text-xs text-neutral-400">ファイル ({files.length})</div>}
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
              {files.map((name) => (
                <Tile key={name} name={name} selected={sel === name} onSelect={() => setSel(name)} onOpen={() => open(name)} onMenu={(x, y) => setMenu({ x, y, name })} />
              ))}
            </div>
            {entries.length === 0 && <p className="mt-8 text-center text-xs text-neutral-600">（空のフォルダー）— 右クリックで新規作成</p>}
          </div>
        ) : vmode === 'graph' ? (
          <div className="min-w-0 flex-1"><FilesGraph cwd={cwd} onOpen={(p) => onOpen?.(p)} onEnter={(p) => navigate(p)} /></div>
        ) : (
          <div className="min-w-0 flex-1"><FilesNodes cwd={cwd} onOpen={(p) => onOpen?.(p)} onEnter={(p) => navigate(p)} /></div>
        )}
      </div>

      <div className="border-t border-white/10 px-3 py-1 text-[10px] text-neutral-500">
        {entries.length} 個の項目{sel && ` — 「${sel}」を選択`}
      </div>

      {/* 右クリックメニュー */}
      {menu && (
        <div style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()} className="glass fixed z-50 w-40 rounded-xl p-1 text-xs" onContextMenu={(e) => e.preventDefault()}>
          {menu.name ? (
            <>
              <MenuItem onClick={() => (open(menu.name!), setMenu(null))}>開く</MenuItem>
              <MenuItem onClick={() => (copy(menu.name!, false), setMenu(null))}>コピー</MenuItem>
              <MenuItem onClick={() => (copy(menu.name!, true), setMenu(null))}>切り取り</MenuItem>
              <MenuItem onClick={() => (rename(menu.name!), setMenu(null))}>名前変更</MenuItem>
              <div className="my-1 h-px bg-white/10" />
              <MenuItem danger onClick={() => (del(menu.name!), setMenu(null))}>削除</MenuItem>
            </>
          ) : (
            <>
              <MenuItem onClick={() => (newFolder(), setMenu(null))}>新規フォルダー</MenuItem>
              <MenuItem onClick={() => (newFile(), setMenu(null))}>新規ファイル</MenuItem>
              {clip && <MenuItem onClick={() => (paste(), setMenu(null))}>貼り付け</MenuItem>}
            </>
          )}
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

function Tile({ name, dir, selected, onSelect, onOpen, onMenu }: { name: string; dir?: boolean; selected: boolean; onSelect: () => void; onOpen: () => void; onMenu: (x: number, y: number) => void }) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelect() }}
      onDoubleClick={onOpen}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(); onMenu(e.clientX, e.clientY) }}
      className={`flex cursor-pointer items-center gap-2 rounded p-2 ${selected ? 'bg-white/20' : 'hover:bg-white/10'}`}
      title="ダブルクリックで開く / 右クリックでメニュー"
    >
      {dir ? <IconFolder className="h-7 w-7 shrink-0 text-neutral-200" /> : <IconFile className="h-7 w-7 shrink-0 text-neutral-400" />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] text-neutral-100">{name}</div>
        <div className="text-[10px] text-neutral-500">{dir ? 'フォルダー' : 'ファイル'}</div>
      </div>
    </div>
  )
}
