import { useEffect, useMemo, useRef, useState } from 'react'
import { basename, useVfs, vfs } from '../vfs'

// エクスプローラーのグラフビュー(Obsidian風)。cwd配下のファイル/フォルダ=ノード、
// 親子=リンク。力学レイアウト。クリックでフォルダ移動/ファイルを開く。
type N = { p: string; x: number; y: number; vx: number; vy: number; dir: boolean }

export function FilesGraph({ cwd, onOpen, onEnter }: { cwd: string; onOpen: (p: string) => void; onEnter: (p: string) => void }) {
  useVfs()
  const nodes = useRef<Map<string, N>>(new Map())
  const [, force] = useState(0)
  const [view, setView] = useState({ x: 0, y: 0, s: 1 })
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ p: string; moved: boolean } | null>(null)
  const pan = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const raf = useRef(0)

  const paths = useMemo(() => [cwd, ...vfs.subtree(cwd)], [cwd])
  const edges = useMemo(() => paths.filter((p) => p !== cwd).map((p) => [vfs.parentOf(p), p] as [string, string]).filter(([a]) => paths.includes(a)), [paths])

  useEffect(() => {
    const m = nodes.current
    const set = new Set(paths)
    for (const k of [...m.keys()]) if (!set.has(k)) m.delete(k)
    paths.forEach((p, i) => {
      if (!m.has(p)) { const a = i * 2.4, r = 30 + 16 * Math.sqrt(i); m.set(p, { p, x: p === cwd ? 0 : Math.cos(a) * r, y: p === cwd ? 0 : Math.sin(a) * r, vx: 0, vy: 0, dir: vfs.isDir(p) }) }
      else m.get(p)!.dir = vfs.isDir(p)
    })
    force((n) => n + 1)
  }, [paths, cwd])

  useEffect(() => {
    let alive = true
    const step = () => {
      if (!alive) return
      const ns = [...nodes.current.values()]
      let e = 0
      for (let i = 0; i < ns.length; i++) {
        const a = ns[i]; if (drag.current?.p === a.p || a.p === cwd) { a.vx = a.vy = 0; continue }
        let fx = -a.x * 0.01, fy = -a.y * 0.01
        for (let j = 0; j < ns.length; j++) { if (i === j) continue; const b = ns[j]; const dx = a.x - b.x, dy = a.y - b.y; const d2 = dx * dx + dy * dy || 0.01; const rep = 1000 / d2; fx += dx * rep; fy += dy * rep }
        a.vx = (a.vx + fx) * 0.82; a.vy = (a.vy + fy) * 0.82
      }
      for (const [pa, pb] of edges) { const a = nodes.current.get(pa), b = nodes.current.get(pb); if (!a || !b) continue; const dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 0.01; const f = (d - 70) * 0.025; const ux = dx / d, uy = dy / d; if (drag.current?.p !== a.p && a.p !== cwd) { a.vx += ux * f; a.vy += uy * f } if (drag.current?.p !== b.p) { b.vx -= ux * f; b.vy -= uy * f } }
      for (const a of ns) { if (drag.current?.p === a.p || a.p === cwd) continue; a.x += a.vx; a.y += a.vy; e += a.vx * a.vx + a.vy * a.vy }
      force((n) => n + 1)
      if (e > 0.4 || drag.current) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => { alive = false; cancelAnimationFrame(raf.current) }
  }, [edges, paths, cwd])

  function toWorld(cx: number, cy: number) { const r = svgRef.current!.getBoundingClientRect(); return { x: (cx - r.left - r.width / 2 - view.x) / view.s, y: (cy - r.top - r.height / 2 - view.y) / view.s } }
  useEffect(() => {
    const move = (ev: PointerEvent) => {
      if (drag.current) { drag.current.moved = true; const w = toWorld(ev.clientX, ev.clientY); const n = nodes.current.get(drag.current.p); if (n) { n.x = w.x; n.y = w.y; n.vx = n.vy = 0; force((v) => v + 1) } }
      else if (pan.current) setView((v) => ({ ...v, x: pan.current!.ox + (ev.clientX - pan.current!.sx), y: pan.current!.oy + (ev.clientY - pan.current!.sy) }))
    }
    const up = () => { drag.current = null; pan.current = null }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  })

  const ns = [...nodes.current.values()]
  return (
    <svg ref={svgRef} className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
      onPointerDown={(e) => { pan.current = { sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y } }}
      onWheel={(e) => setView((v) => ({ ...v, s: Math.min(3, Math.max(0.3, v.s * (e.deltaY < 0 ? 1.1 : 1 / 1.1))) }))}>
      <g transform={`translate(${(svgRef.current?.clientWidth ?? 0) / 2 + view.x} ${(svgRef.current?.clientHeight ?? 0) / 2 + view.y}) scale(${view.s})`}>
        {edges.map(([pa, pb], i) => { const a = nodes.current.get(pa), b = nodes.current.get(pb); if (!a || !b) return null; return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#fff" strokeOpacity={0.14} strokeWidth={1 / view.s} /> })}
        {ns.map((n) => {
          const isCwd = n.p === cwd
          return (
            <g key={n.p} transform={`translate(${n.x} ${n.y})`} style={{ cursor: 'pointer' }}
              onPointerDown={(e) => { e.stopPropagation(); drag.current = { p: n.p, moved: false } }}
              onClick={(e) => { e.stopPropagation(); if (drag.current?.moved) return; if (n.dir) onEnter(n.p); else onOpen(n.p) }}>
              <circle r={isCwd ? 10 : n.dir ? 8 : 6} fill={n.dir ? '#fbbf24' : '#a3a3a3'} stroke={isCwd ? '#fff' : 'rgba(255,255,255,0.5)'} strokeWidth={(isCwd ? 2 : 1) / view.s} />
              {view.s > 0.55 && <text y={(n.dir ? 8 : 6) + 11} textAnchor="middle" fontSize={10 / Math.max(0.8, view.s)} fill="#e5e5e5" style={{ pointerEvents: 'none' }}>{basename(n.p)}</text>}
            </g>
          )
        })}
      </g>
    </svg>
  )
}
