import { useMemo } from 'react'
import { basename, useVfs, vfs } from '../vfs'
import { IconFile, IconFolder } from '../../icons'

// エクスプローラーのノードビュー(Blenderノード/ツリー風)。
// cwd を起点に左→右へ階層を展開、親子をベジェ配線で結ぶ。フォルダクリックで潜る。
const CW = 150 // 列幅
const RH = 30 // 行高

type Lay = { p: string; col: number; row: number; dir: boolean }

export function FilesNodes({ cwd, onOpen, onEnter }: { cwd: string; onOpen: (p: string) => void; onEnter: (p: string) => void }) {
  useVfs()
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
  const byPath = new Map(layout.map((l) => [l.p, l]))
  const width = 12 + (Math.max(0, ...layout.map((l) => l.col)) + 1) * CW + 40
  const height = 24 + layout.length * RH

  return (
    <div className="h-full overflow-auto">
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
          return (
            <foreignObject key={l.p} x={x} y={y} width={CW - 34} height={24}>
              <button
                onClick={() => (l.dir ? onEnter(l.p) : onOpen(l.p))}
                className={`flex h-6 w-full items-center gap-1.5 rounded-md border px-2 text-[11px] ${l.p === cwd ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 bg-white/5 text-neutral-200 hover:bg-white/10'}`}
                title={l.p}
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
