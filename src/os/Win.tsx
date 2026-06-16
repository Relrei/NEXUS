import { useEffect, useRef, type ReactNode } from 'react'

export type WState = 'normal' | 'max' | 'min'
export interface Wm {
  id: string
  title: string
  x: number
  y: number
  w: number
  h: number
  z: number
  state: WState
}
export type Rect = { x: number; y: number; w: number; h: number }

// 窓。タイル時は親が計算したgeomで配置(ドラッグ/リサイズ不可=Hyprland流)。
// フロート時はgeom=保存値でドラッグ/リサイズ可。右上: ◇フロート切替 / − / □ / ✕。
export function Win({
  win,
  geom,
  tiled,
  focused,
  accent,
  children,
  onClose,
  onMin,
  onMax,
  onToggleFloat,
  onFocus,
  onMove,
  onResize,
  onMenu,
  onTileDown,
  dragOffset,
}: {
  win: Wm
  geom: Rect
  tiled: boolean
  focused: boolean
  accent: string
  children: ReactNode
  onClose: () => void
  onMin: () => void
  onMax: () => void
  onToggleFloat: () => void
  onFocus: () => void
  onMove: (x: number, y: number) => void
  onResize: (w: number, h: number) => void
  onMenu: (x: number, y: number) => void
  onTileDown: (x: number, y: number) => void
  dragOffset?: { dx: number; dy: number }
}) {
  const g = useRef<{ mode: 'move' | 'size'; sx: number; sy: number; ox: number; oy: number } | null>(null)
  const movable = !tiled && win.state !== 'max'

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const s = g.current
      if (!s) return
      if (s.mode === 'move') onMove(s.ox + (e.clientX - s.sx), s.oy + (e.clientY - s.sy))
      else onResize(Math.max(260, s.ox + (e.clientX - s.sx)), Math.max(150, s.oy + (e.clientY - s.sy)))
    }
    const up = () => (g.current = null)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [onMove, onResize])

  return (
    <div
      data-winid={win.id}
      onPointerDown={onFocus}
      style={{
        left: geom.x,
        top: geom.y,
        width: geom.w,
        height: geom.h,
        zIndex: win.z,
        borderColor: focused ? accent : undefined,
        transform: dragOffset ? `translate(${dragOffset.dx}px, ${dragOffset.dy}px)` : undefined,
        pointerEvents: dragOffset ? 'none' : undefined,
        opacity: dragOffset ? 0.85 : undefined,
      }}
      className={`glass-win absolute flex flex-col overflow-hidden rounded-xl ${
        tiled && !dragOffset ? 'transition-[left,top,width,height] duration-150' : ''
      } ${focused ? 'border-2' : ''}`}
    >
      <div
        onPointerDown={(e) => {
          if (movable) g.current = { mode: 'move', sx: e.clientX, sy: e.clientY, ox: geom.x, oy: geom.y }
          else onTileDown(e.clientX, e.clientY)
        }}
        onDoubleClick={onMax}
        onContextMenu={(e) => {
          e.preventDefault()
          onMenu(e.clientX, e.clientY)
        }}
        className={`flex shrink-0 items-center gap-1 border-b border-white/10 bg-white/5 px-2 py-1 select-none ${
          movable ? 'cursor-grab active:cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <span className="flex-1 truncate px-1 text-xs text-neutral-300">{win.title}</span>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={onToggleFloat} title={tiled ? 'フロートにする' : 'タイルに戻す'} className="grid h-5 w-5 place-items-center rounded text-neutral-400 hover:bg-neutral-700">
          {tiled ? '◇' : '▦'}
        </button>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={onMin} title="最小化" className="grid h-5 w-5 place-items-center rounded text-neutral-400 hover:bg-neutral-700">
          <span className="block h-px w-2.5 bg-current" />
        </button>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={onMax} title="最大化" className="grid h-5 w-5 place-items-center rounded text-neutral-400 hover:bg-neutral-700">
          <span className="block h-2.5 w-2.5 border border-current" />
        </button>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={onClose} title="閉じる" className="grid h-5 w-5 place-items-center rounded text-neutral-400 hover:bg-red-500/80 hover:text-white">
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">{children}</div>

      {movable && (
        <div
          onPointerDown={(e) => {
            e.stopPropagation()
            g.current = { mode: 'size', sx: e.clientX, sy: e.clientY, ox: geom.w, oy: geom.h }
          }}
          className="absolute right-0 bottom-0 h-4 w-4 cursor-nwse-resize"
        />
      )}
    </div>
  )
}
