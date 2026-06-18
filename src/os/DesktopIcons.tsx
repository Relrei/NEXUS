import { useEffect, useRef, useState } from 'react'

type IconC = (p: { className?: string }) => React.ReactNode
export interface Shortcut {
  id: string
  name: string
  Icon: IconC
}
type Cell = { c: number; r: number }
type Grid = Record<string, Cell>

const CW = 92 // セル幅
const CH = 96 // セル高
const PAD = 10

// グリッドにスナップするデスクトップアイコン。重なりは「空きセルへ押し出し」で回避。
export function DesktopIcons({ items, onOpen }: { items: Shortcut[]; onOpen: (id: string) => void }) {
  const [grid, setGrid] = useState<Grid>(() => {
    try {
      return JSON.parse(localStorage.getItem('nexus.icons') || '{}')
    } catch {
      return {}
    }
  })
  const drag = useRef<{ id: string; dx: number; dy: number; px: number; py: number; moved: boolean } | null>(null)
  const [ghost, setGhost] = useState<{ id: string; x: number; y: number } | null>(null)
  const rows = Math.max(1, Math.floor((window.innerHeight - 120) / CH))

  // 配置: アプリの増減(=保存IDとitemsの不一致)があれば隙間なく詰め直す。
  // 一致している間はユーザーのドラッグ配置を保持。
  useEffect(() => {
    setGrid((g) => {
      const ids = new Set(items.map((i) => i.id))
      const stale = Object.keys(g).some((id) => !ids.has(id)) // 消えたアプリの残骸
      const missing = items.some((it) => !g[it.id]) // 新規アプリ
      if (!stale && !missing) return g
      // items 順に左列から縦へ詰める(空欄を作らない)
      const next: Grid = {}
      items.forEach((it, i) => { next[it.id] = { c: Math.floor(i / rows), r: i % rows } })
      localStorage.setItem('nexus.icons', JSON.stringify(next))
      return next
    })
  }, [items, rows])

  const cellXY = (cell: Cell) => {
    const maxC = Math.max(0, Math.floor((window.innerWidth - PAD - CW) / CW))
    const maxR = Math.max(0, Math.floor((window.innerHeight - 80 - CH) / CH))
    const c = Math.min(cell.c, maxC)
    const r = Math.min(cell.r, maxR)
    return { x: PAD + c * CW, y: PAD + r * CH }
  }

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current
      if (!d) return
      d.moved = true
      setGhost({ id: d.id, x: e.clientX - d.dx, y: e.clientY - d.dy })
    }
    const up = (e: PointerEvent) => {
      const d = drag.current
      drag.current = null
      setGhost(null)
      if (!d || !d.moved) return
      // 最寄りセル → 空きを探して確定(重なり回避)
      let c = Math.max(0, Math.round((e.clientX - d.dx - PAD) / CW))
      let r = Math.max(0, Math.round((e.clientY - d.dy - PAD) / CH))
      setGrid((g) => {
        const used = new Set(Object.entries(g).filter(([k]) => k !== d.id).map(([, v]) => `${v.c},${v.r}`))
        let rr = r
        while (used.has(`${c},${rr}`)) {
          rr++
          if (rr >= rows + 2) {
            rr = 0
            c++
          }
        }
        const next = { ...g, [d.id]: { c, r: rr } }
        localStorage.setItem('nexus.icons', JSON.stringify(next))
        return next
      })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [rows])

  return (
    <>
      {items.map((it) => {
        const cell = grid[it.id] ?? { c: 0, r: 0 }
        const base = cellXY(cell)
        const pos = ghost?.id === it.id ? { x: ghost.x, y: ghost.y } : base
        const Icon = it.Icon
        return (
          <button
            key={it.id}
            onPointerDown={(e) => {
              drag.current = { id: it.id, dx: e.clientX - base.x, dy: e.clientY - base.y, px: e.clientX, py: e.clientY, moved: false }
            }}
            onDoubleClick={() => onOpen(it.id)}
            style={{ left: pos.x, top: pos.y, width: CW - 4 }}
            className={`absolute z-[2] flex cursor-grab flex-col items-center gap-1 select-none active:cursor-grabbing ${
              ghost?.id === it.id ? 'opacity-80' : ''
            }`}
            title={`${it.name}（ダブルクリックで開く・ドラッグで移動）`}
          >
            {/* アイコン = 丸みを帯びた正方形のガラスタイル */}
            <span className="glass grid place-items-center rounded-2xl hover:brightness-125" style={{ width: 60, height: 60 }}>
              <Icon className="ico-edge h-7 w-7 text-neutral-100" />
            </span>
            <span className="txt-edge line-clamp-1 w-full text-center text-[10px] leading-tight text-neutral-100">{it.name}</span>
          </button>
        )
      })}
    </>
  )
}
