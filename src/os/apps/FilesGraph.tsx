import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { basename, matchPath, useVfs, vfs } from '../vfs'

// エクスプローラーのグラフビュー(Obsidian グラフビュー風)。
// ・ノード = cwd と subtree のファイル/フォルダ。親子(parentOf)= リンク。
// ・力学レイアウト: 中心力 / 反発力 / リンクする力 / リンクの距離 をスライダー調整。
// ・パン/ズーム/ノードドラッグ/クリックでフォルダへ移動・ファイルを開く。
// ・配色は青みのないニュートラル真黒+白(プロジェクトのETHOS)。フォルダ=琥珀/ファイル=グレー。
type N = { p: string; x: number; y: number; vx: number; vy: number; dir: boolean }

// 力学パラメータ(0..1 の正規化値で持ち、係数へ写像)
type Forces = { center: number; repel: number; link: number; dist: number }
const DEFAULT_FORCES: Forces = { center: 0.4, repel: 0.5, link: 0.4, dist: 0.5 }

// 表示パラメータ
type Display = { arrows: boolean; textFade: number; nodeSize: number; linkWidth: number }
const DEFAULT_DISPLAY: Display = { arrows: false, textFade: 0.55, nodeSize: 1, linkWidth: 1 }

// ノード色(既定は白。フォルダ/ファイルを別々に設定可)。localStorage に保存。
type Colors = { dir: string; file: string }
const DEFAULT_COLORS: Colors = { dir: '#ffffff', file: '#ffffff' }
const COLOR_KEY = 'nexus.graph.nodeColor'
function loadColors(): Colors {
  try {
    const raw = localStorage.getItem(COLOR_KEY)
    if (raw) {
      const o = JSON.parse(raw)
      return { dir: typeof o?.dir === 'string' ? o.dir : DEFAULT_COLORS.dir, file: typeof o?.file === 'string' ? o.file : DEFAULT_COLORS.file }
    }
  } catch { /* ignore */ }
  return DEFAULT_COLORS
}

export function FilesGraph({ cwd, q = '', onOpen, onEnter }: { cwd: string; q?: string; onOpen: (p: string) => void; onEnter: (p: string) => void }) {
  useVfs()
  const nodes = useRef<Map<string, N>>(new Map())
  const [, force] = useState(0)
  const [view, setView] = useState({ x: 0, y: 0, s: 1 })
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ p: string; moved: boolean } | null>(null)
  const pan = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const raf = useRef(0)
  // シミュレーションの「温度」: 0 で停止。ドラッグ/設定変更/フォーカスで再加熱。
  const heat = useRef(1)
  const reheat = () => { heat.current = 1 }

  const [forces, setForces] = useState<Forces>(DEFAULT_FORCES)
  const [disp, setDisp] = useState<Display>(DEFAULT_DISPLAY)
  const [colors, setColors] = useState<Colors>(loadColors)
  // 色変更を localStorage へ保存(次回も保持)
  useEffect(() => { try { localStorage.setItem(COLOR_KEY, JSON.stringify(colors)) } catch { /* ignore */ } }, [colors])
  const [panelOpen, setPanelOpen] = useState(true)
  // 折りたたみセクションの開閉
  const [open, setOpen] = useState({ display: true, force: true, filter: false, group: false })

  const paths = useMemo(() => [cwd, ...vfs.subtree(cwd)], [cwd])
  const edges = useMemo(() => paths.filter((p) => p !== cwd).map((p) => [vfs.parentOf(p), p] as [string, string]).filter(([a]) => paths.includes(a)), [paths])

  // ノード初期化(cwd=中心、子=放射状に散らす)。設定変更でも再加熱。
  useEffect(() => {
    const m = nodes.current
    const set = new Set(paths)
    for (const k of [...m.keys()]) if (!set.has(k)) m.delete(k)
    paths.forEach((p, i) => {
      if (!m.has(p)) {
        const a = i * 2.4, r = 30 + 16 * Math.sqrt(i)
        m.set(p, { p, x: p === cwd ? 0 : Math.cos(a) * r, y: p === cwd ? 0 : Math.sin(a) * r, vx: 0, vy: 0, dir: vfs.isDir(p) })
      } else m.get(p)!.dir = vfs.isDir(p)
    })
    reheat()
    force((n) => n + 1)
  }, [paths, cwd])

  // 設定(力)が変わったら再加熱
  useEffect(() => { reheat() }, [forces])

  // 力学シミュレーション。エネルギーが落ち着いたら raf 停止、heat>0 のあいだだけ回す。
  useEffect(() => {
    let alive = true
    // 正規化値→係数
    const k = {
      center: forces.center * 0.03,
      repel: 200 + forces.repel * 2600,
      link: forces.link * 0.06,
      dist: 30 + forces.dist * 160,
    }
    const step = () => {
      if (!alive) return
      const ns = [...nodes.current.values()]
      let energy = 0
      for (let i = 0; i < ns.length; i++) {
        const a = ns[i]
        if (drag.current?.p === a.p || a.p === cwd) { a.vx = a.vy = 0; continue }
        let fx = -a.x * k.center, fy = -a.y * k.center
        for (let j = 0; j < ns.length; j++) {
          if (i === j) continue
          const b = ns[j]; const dx = a.x - b.x, dy = a.y - b.y; const d2 = dx * dx + dy * dy || 0.01; const rep = k.repel / d2
          fx += dx * rep; fy += dy * rep
        }
        a.vx = (a.vx + fx) * 0.82; a.vy = (a.vy + fy) * 0.82
      }
      for (const [pa, pb] of edges) {
        const a = nodes.current.get(pa), b = nodes.current.get(pb); if (!a || !b) continue
        const dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 0.01; const f = (d - k.dist) * k.link; const ux = dx / d, uy = dy / d
        if (drag.current?.p !== a.p && a.p !== cwd) { a.vx += ux * f; a.vy += uy * f }
        if (drag.current?.p !== b.p && b.p !== cwd) { b.vx -= ux * f; b.vy -= uy * f }
      }
      for (const a of ns) {
        if (drag.current?.p === a.p || a.p === cwd) continue
        a.x += a.vx; a.y += a.vy
        energy += a.vx * a.vx + a.vy * a.vy
      }
      force((n) => n + 1)
      // エネルギーが小さく、ドラッグしていなければ冷却→停止
      if (drag.current) heat.current = 1
      else if (energy < 0.05) heat.current = Math.max(0, heat.current - 0.05)
      if (heat.current <= 0) { raf.current = 0; return }
      raf.current = requestAnimationFrame(step)
    }
    if (!raf.current) raf.current = requestAnimationFrame(step)
    return () => { alive = false; cancelAnimationFrame(raf.current); raf.current = 0 }
  }, [edges, paths, cwd, forces])

  // heat を上げたら(reheat 後)ループが止まっていれば起こす
  useEffect(() => {
    const id = setInterval(() => {
      if (heat.current > 0 && !raf.current) force((n) => n + 1)
    }, 120)
    return () => clearInterval(id)
  }, [])

  function toWorld(cx: number, cy: number) { const r = svgRef.current!.getBoundingClientRect(); return { x: (cx - r.left - r.width / 2 - view.x) / view.s, y: (cy - r.top - r.height / 2 - view.y) / view.s } }
  useEffect(() => {
    const move = (ev: PointerEvent) => {
      if (drag.current) { drag.current.moved = true; reheat(); const w = toWorld(ev.clientX, ev.clientY); const n = nodes.current.get(drag.current.p); if (n) { n.x = w.x; n.y = w.y; n.vx = n.vy = 0; force((v) => v + 1) } }
      else if (pan.current) {
        // pan.current を先にローカルへ退避。setView の更新関数は非同期で走るため、
        // その時には pointerup で pan.current=null になり得る(null参照→クラッシュ→黒画面)対策。
        const p = pan.current
        setView((v) => ({ ...v, x: p.ox + (ev.clientX - p.sx), y: p.oy + (ev.clientY - p.sy) }))
      }
    }
    const up = () => { if (drag.current) reheat(); drag.current = null; pan.current = null }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  })

  const ns = [...nodes.current.values()]
  const showText = view.s >= disp.textFade
  const r0 = (base: number) => base * disp.nodeSize

  // 背景ドット = CSS(radial-gradient)で描画。SVG<pattern>はGPUによってはズーム時に
  // 黒画面化(テクスチャ破綻)するため使わない。ズーム/パンは background-size/position で追従。
  const cellPx = 28 * view.s
  const dotBg: React.CSSProperties = cellPx > 3 ? {
    backgroundImage: 'radial-gradient(rgba(255,255,255,0.16) 1.3px, transparent 1.8px)',
    backgroundSize: `${cellPx}px ${cellPx}px`,
    backgroundPosition: `${(svgRef.current?.clientWidth ?? 0) / 2 + view.x}px ${(svgRef.current?.clientHeight ?? 0) / 2 + view.y}px`,
  } : {}

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* 背景ドット(CSS・GPU安全) */}
      <div className="pointer-events-none absolute inset-0" style={dotBg} />
      <svg ref={svgRef} className="relative h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={(e) => { pan.current = { sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y } }}
        onWheel={(e) => setView((v) => ({ ...v, s: Math.min(3, Math.max(0.2, v.s * (e.deltaY < 0 ? 1.1 : 1 / 1.1))) }))}>
        <defs>
          <marker id="fg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="rgba(255,255,255,0.55)" />
          </marker>
        </defs>

        <g transform={`translate(${(svgRef.current?.clientWidth ?? 0) / 2 + view.x} ${(svgRef.current?.clientHeight ?? 0) / 2 + view.y}) scale(${view.s})`}>
          {/* リンク(親→子) */}
          {edges.map(([pa, pb], i) => {
            const a = nodes.current.get(pa), b = nodes.current.get(pb); if (!a || !b) return null
            const hitA = !q || a.p === cwd || matchPath(a.p, q)
            const hitB = !q || b.p === cwd || matchPath(b.p, q)
            const dim = q && !(hitA && hitB)
            // 矢印が子ノードの円に刺さらないよう端点を少し縮める
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1
            const pad = (disp.arrows ? r0(b.dir ? 8 : 6) + 3 : 0)
            const ex = b.x - (dx / d) * pad, ey = b.y - (dy / d) * pad
            return (
              <line key={i} x1={a.x} y1={a.y} x2={ex} y2={ey}
                stroke="#fff" strokeOpacity={dim ? 0.04 : 0.16} strokeWidth={(disp.linkWidth * 1) / view.s}
                markerEnd={disp.arrows ? 'url(#fg-arrow)' : undefined} />
            )
          })}

          {/* ノード */}
          {ns.map((n) => {
            const isCwd = n.p === cwd
            const hit = !q || isCwd || matchPath(n.p, q)
            const rr = r0(isCwd ? 10 : n.dir ? 8 : 6)
            return (
              <g key={n.p} transform={`translate(${n.x} ${n.y})`} style={{ cursor: 'pointer', opacity: hit ? 1 : 0.16 }}
                onPointerDown={(e) => { e.stopPropagation(); drag.current = { p: n.p, moved: false } }}
                onClick={(e) => { e.stopPropagation(); if (drag.current?.moved) return; if (n.dir) onEnter(n.p); else onOpen(n.p) }}>
                <circle r={rr} fill={n.dir ? colors.dir : colors.file} stroke={isCwd ? '#fff' : 'rgba(255,255,255,0.5)'} strokeWidth={(isCwd ? 2 : 1) / view.s} />
                {showText && (
                  <text y={rr + 11} textAnchor="middle" fontSize={10 / Math.max(0.8, view.s)} fill="#e5e5e5" style={{ pointerEvents: 'none' }}>{basename(n.p)}</text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {/* 歯車トグル(パネルを閉じているとき) */}
      {!panelOpen && (
        <button onClick={() => setPanelOpen(true)}
          className="glass absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-neutral-200"
          title="グラフ設定">{'⚙'}</button>
      )}

      {/* コントロールパネル(Obsidian風・右上フロート) */}
      {panelOpen && (
        <div className="glass absolute right-3 top-3 w-60 rounded-lg p-2 text-[12px] text-neutral-200">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="font-medium text-neutral-100">グラフ設定</span>
            <button onClick={() => setPanelOpen(false)} className="text-neutral-400 hover:text-neutral-100" title="閉じる">{'✕'}</button>
          </div>

          {/* 表示 */}
          <Section title="表示" open={open.display} onToggle={() => setOpen((o) => ({ ...o, display: !o.display }))}>
            <Row label="矢印">
              <Toggle on={disp.arrows} onChange={(v) => setDisp((d) => ({ ...d, arrows: v }))} />
            </Row>
            <Slider label="テキストフェードの閾値" min={0.2} max={3} step={0.05} value={disp.textFade}
              onChange={(v) => setDisp((d) => ({ ...d, textFade: v }))} />
            <Slider label="ノードの大きさ" min={0.4} max={2.5} step={0.05} value={disp.nodeSize}
              onChange={(v) => setDisp((d) => ({ ...d, nodeSize: v }))} />
            <Slider label="リンクの太さ" min={0.5} max={4} step={0.1} value={disp.linkWidth}
              onChange={(v) => setDisp((d) => ({ ...d, linkWidth: v }))} />
            <Row label="フォルダ色">
              <ColorPicker value={colors.dir} onChange={(v) => setColors((c) => ({ ...c, dir: v }))} />
            </Row>
            <Row label="ファイル色">
              <ColorPicker value={colors.file} onChange={(v) => setColors((c) => ({ ...c, file: v }))} />
            </Row>
            <button onClick={() => setColors(DEFAULT_COLORS)}
              className="glass-pill mt-1 w-full rounded-md py-1 text-center text-neutral-300 hover:brightness-125">
              色を既定(白)に戻す
            </button>
            <button onClick={reheat}
              className="glass-pill mt-1 w-full rounded-md py-1 text-center text-neutral-100 hover:brightness-125">
              アニメーション開始
            </button>
          </Section>

          {/* 力の強さ */}
          <Section title="力の強さ" open={open.force} onToggle={() => setOpen((o) => ({ ...o, force: !o.force }))}>
            <Slider label="中心力" min={0} max={1} step={0.01} value={forces.center}
              onChange={(v) => setForces((f) => ({ ...f, center: v }))} />
            <Slider label="反発力" min={0} max={1} step={0.01} value={forces.repel}
              onChange={(v) => setForces((f) => ({ ...f, repel: v }))} />
            <Slider label="リンクする力" min={0} max={1} step={0.01} value={forces.link}
              onChange={(v) => setForces((f) => ({ ...f, link: v }))} />
            <Slider label="リンクの距離" min={0} max={1} step={0.01} value={forces.dist}
              onChange={(v) => setForces((f) => ({ ...f, dist: v }))} />
          </Section>

          {/* フィルタ(プレースホルダ) */}
          <Section title="フィルタ" open={open.filter} onToggle={() => setOpen((o) => ({ ...o, filter: !o.filter }))}>
            <div className="px-1 py-1 text-[11px] text-neutral-500">検索バーで絞り込み(該当を強調)。</div>
          </Section>

          {/* グループ(プレースホルダ) */}
          <Section title="グループ" open={open.group} onToggle={() => setOpen((o) => ({ ...o, group: !o.group }))}>
            <div className="px-1 py-1 text-[11px] text-neutral-500">色は「表示」セクションで設定(既定=白)。</div>
          </Section>
        </div>
      )}
    </div>
  )
}

// ---- 小さなUI部品(青み無し・ニュートラル) ----

function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="border-t border-white/10 pt-1">
      <button onClick={onToggle} className="flex w-full items-center gap-1 px-1 py-1 text-left text-neutral-300 hover:text-neutral-100">
        <span className="inline-block w-3 text-neutral-500">{open ? '▾' : '▸'}</span>
        <span className="font-medium">{title}</span>
      </button>
      {open && <div className="space-y-1 pb-1">{children}</div>}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <span className="text-neutral-300">{label}</span>
      {children}
    </div>
  )
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="px-1">
      <div className="text-neutral-400">{label}</div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-neutral-300" />
    </div>
  )
}

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
      className="h-5 w-9 cursor-pointer rounded border border-white/20 bg-transparent p-0"
      title="ノードの色" />
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on}
      className="relative h-5 w-9 rounded-full border border-white/20 transition-colors"
      style={{ background: on ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.10)' }}>
      <span className="absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all"
        style={{ left: on ? '18px' : '2px', background: on ? '#0a0a0a' : '#d4d4d4' }} />
    </button>
  )
}
