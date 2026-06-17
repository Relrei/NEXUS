import { useMemo, useRef } from 'react'
import { basename, matchPath, useVfs, vfs } from '../vfs'
import { IconFile, IconFolder } from '../../icons'

// エクスプローラーのノードビュー(Blenderノード/ツリー風)。
// cwd を起点に左→右へ階層を展開、親子をベジェ配線で結ぶ。
// クリック=その位置へパン(画面移動)だけ。ダブルクリック=そのフォルダへ潜る(任意)。
const CW = 150 // 列幅
const RH = 30 // 行高

type Lay = { p: string; col: number; row: number; dir: boolean }

export function FilesNodes({ cwd, q = '', onOpen, onEnter }: { cwd: string; q?: string; onOpen: (p: string) => void; onEnter: (p: string) => void }) {
  useVfs()
  const scRef = useRef<HTMLDivElement>(null)
  const layout = useMemo(() => {
    const out: Lay[] = []
    let row = 0
    const walk = (p: string, col: number) => {
      out.push({ p, col, row: row++, dir: vfs.isDir(p) })
      if (vfs.isDir(p)) for (const name of vfs.ls(p)) walk(p === '/' ? `/${name}` : `${p}/${name}`, col + 1)
    }
    walk(cwd, 0)
    return out
  }, [cwd])

  const posOf = (l: Lay) => ({ x: 12 + l.col * CW, y: 12 + l.row * RH })
  // クリックしたノードを画面中央へパン(中に入らない=戻る手間ゼロ)
  function panTo(l: Lay) {
    const el = scRef.current
    if (!el) return
    const { x, y } = posOf(l)
    el.scrollTo({ left: Math.max(0, x - el.clientWidth / 2 + CW / 2), top: Math.max(0, y - el.clientHeight / 2 + RH / 2), behavior: 'smooth' })
  }
  const byPath = new Map(layout.map((l) => [l.p, l]))
  const width = 12 + (Math.max(0, ...layout.map((l) => l.col)) + 1) * CW + 40
  const height = 24 + layout.length * RH

  return (
    <div ref={scRef} className="h-full overflow-auto">
      <svg width={width} height={height} className="block">
        {/* 配線 */}
        {layout.map((l) => {
          if (l.p === cwd) return null
          const par = byPath.get(vfs.parentOf(l.p))
          if (!par) return null
          const a = posOf(par), b = posOf(l)
          const x1 = a.x + CW - 30, y1 = a.y + 11, x2 = b.x - 4, y2 = b.y + 11
          const mx = (x1 + x2) / 2
          return <path key={l.p} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke="#fff" strokeOpacity={0.2} strokeWidth={1.2} />
        })}
        {/* ノード */}
        {layout.map((l) => {
          const { x, y } = posOf(l)
          const hit = !q || l.p === cwd || matchPath(l.p, q)
          return (
            <foreignObject key={l.p} x={x} y={y} width={CW - 34} height={24} style={{ opacity: hit ? 1 : 0.22 }}>
              <button
                onClick={() => (l.dir ? panTo(l) : onOpen(l.p))}
                onDoubleClick={() => l.dir && onEnter(l.p)}
                className={`flex h-6 w-full items-center gap-1.5 rounded-md border px-2 text-[11px] ${l.p === cwd ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 bg-white/5 text-neutral-200 hover:bg-white/10'}`}
                title={`${l.p}（クリック=移動 / ダブルクリック=ここを起点に）`}
              >
                {l.dir ? <IconFolder className="h-3.5 w-3.5 shrink-0" /> : <IconFile className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{l.p === cwd ? basename(l.p) || 'PC' : basename(l.p)}</span>
              </button>
            </foreignObject>
          )
        })}
      </svg>
    </div>
  )
}
