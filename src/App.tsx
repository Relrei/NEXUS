import { useEffect, useRef, useState } from 'react'
import { clearWallpaper, getWallpaperUrl, setWallpaper } from './db'
import { Win, type Rect, type Wm } from './os/Win'
import { basename, useVfs, vfs } from './os/vfs'
import { Terminal } from './os/apps/Terminal'
import { Files } from './os/apps/Files'
import { Editor } from './os/apps/Editor'
import { Settings } from './os/apps/Settings'
import { Browser } from './os/apps/Browser'
import { AudioViz } from './os/AudioViz'
import { LockScreen } from './os/LockScreen'
import { DesktopIcons } from './os/DesktopIcons'
import { IconBell, IconFolder, IconGear, IconGlobe, IconPower, IconTerminal, IconText, IconUser, IconVolume } from './icons'

type AppId = 'terminal' | 'files' | 'editor' | 'settings' | 'browser'
type W = Wm & { app: AppId; path?: string; ws: number; floating: boolean }
type Gut = { i: number; x: number; y: number; w: number; h: number; v: boolean; ax: number; ay: number; aw: number; ah: number }
type IconC = (p: { className?: string }) => React.ReactNode

const APPS: { id: AppId; name: string; Icon: IconC }[] = [
  { id: 'files', name: 'エクスプローラー', Icon: IconFolder },
  { id: 'terminal', name: 'kitty', Icon: IconTerminal },
  { id: 'editor', name: 'エディタ', Icon: IconText },
  { id: 'browser', name: 'ブラウザ', Icon: IconGlobe },
  { id: 'settings', name: '設定', Icon: IconGear },
]
const DEF = {
  terminal: { w: 580, h: 360, title: 'kitty' },
  files: { w: 640, h: 440, title: 'エクスプローラー' },
  editor: { w: 580, h: 460, title: 'エディタ' },
  browser: { w: 760, h: 520, title: 'ブラウザ' },
  settings: { w: 420, h: 300, title: '設定' },
} as const
const WORKSPACES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const GAP = 8
const DOCK = 64
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

// ratio付き dwindle: 各splitにratios[i]。境界(gutter)をドラッグでratio変更。
function layout(area: Rect, ids: string[], ratios: number[], i: number, out: Record<string, Rect>, guts: Gut[]) {
  if (ids.length === 0) return
  if (ids.length === 1) {
    out[ids[0]] = area
    return
  }
  const v = area.w >= area.h
  const r = clamp(ratios[i] ?? 0.5, 0.15, 0.85)
  const aw = v ? area.w * r : area.w
  const ah = v ? area.h : area.h * r
  out[ids[0]] = { x: area.x, y: area.y, w: aw, h: ah }
  const b: Rect = v
    ? { x: area.x + aw, y: area.y, w: area.w - aw, h: area.h }
    : { x: area.x, y: area.y + ah, w: area.w, h: area.h - ah }
  guts.push(
    v
      ? { i, x: area.x + aw - 3, y: area.y, w: 6, h: area.h, v: true, ax: area.x, ay: area.y, aw: area.w, ah: area.h }
      : { i, x: area.x, y: area.y + ah - 3, w: area.w, h: 6, v: false, ax: area.x, ay: area.y, aw: area.w, ah: area.h },
  )
  layout(b, ids.slice(1), ratios, i + 1, out, guts)
}

async function sampleAccent(url: string): Promise<string> {
  return new Promise((res) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = c.height = 16
      const x = c.getContext('2d')!
      x.drawImage(img, 0, 0, 16, 16)
      const d = x.getImageData(0, 0, 16, 16).data
      let r = 0, g = 0, b = 0
      for (let i = 0; i < d.length; i += 4) {
        r += d[i]; g += d[i + 1]; b += d[i + 2]
      }
      const n = d.length / 4
      r /= n; g /= n; b /= n
      const k = Math.min(2.2, 190 / Math.max(r, g, b, 1))
      res(`rgb(${Math.min(255, r * k) | 0},${Math.min(255, g * k) | 0},${Math.min(255, b * k) | 0})`)
    }
    img.onerror = () => res('#d4d4d4')
    img.src = url
  })
}

function fmt(bps: number): string {
  if (bps < 0) return '–'
  if (bps < 1024) return `${bps}B/s`
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(0)}K/s`
  return `${(bps / 1024 / 1024).toFixed(1)}M/s`
}

// WMO weather code → 絵文字(open-meteo)
function wIcon(c: number): string {
  if (c === 0) return '☀️'
  if (c <= 2) return '🌤️'
  if (c === 3) return '☁️'
  if (c <= 48) return '🌫️'
  if (c <= 67) return '🌧️'
  if (c <= 77) return '❄️'
  if (c <= 82) return '🌦️'
  if (c <= 86) return '🌨️'
  return '⛈️'
}

type Stats = Record<string, number>

function Bar({ ws, setWs, occupied, title, accent, onLock }: { ws: number; setWs: (n: number) => void; occupied: Set<number>; title: string; accent: string; onLock: () => void }) {
  const [now, setNow] = useState(() => new Date())
  const [s, setS] = useState<Stats | null>(null)
  const [power, setPower] = useState(false)
  const [notif, setNotif] = useState(false)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    let on = true
    const tick = async () => {
      try {
        const r = await fetch('http://127.0.0.1:8799/stats', { cache: 'no-store' })
        const j = await r.json()
        if (on) setS(j)
      } catch {
        if (on) setS(null)
      }
    }
    tick()
    const t = setInterval(tick, 2000)
    return () => {
      on = false
      clearInterval(t)
    }
  }, [])
  const wd = ['日', '月', '火', '水', '木', '金', '土'][now.getDay()]
  // バー透明: pillは持たず、薄い区切りでモジュールを並べる(JaKooLit#24準拠・背景透明)
  const sep = <span className="mx-1 text-neutral-600">|</span>
  void sep
  return (
    <header className="topbar relative z-30 flex items-center gap-2 px-3 py-1 text-[11px] text-neutral-200">
      {/* 左: 通知 + cava波形 + アクティブ窓名(狭いと…で省略) */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button onClick={() => setNotif((v) => !v)} title="通知" className="shrink-0 text-neutral-400 hover:text-neutral-100">
          <IconBell className="h-3.5 w-3.5" />
        </button>
        <div className="shrink-0"><AudioViz /></div>
        <span className="truncate text-neutral-300">{title || '—'}</span>
      </div>
      {notif && (
        <div className="glass absolute top-full left-2 z-50 mt-1.5 w-72 rounded-xl p-3 text-neutral-300">
          <div className="mb-1 text-xs font-medium text-neutral-200">通知</div>
          <p className="text-[11px] text-neutral-500">新しい通知はありません</p>
        </div>
      )}

      {/* 中央: ワークスペース1-10 + 時計 + 日付(md+) + 天気(lg+) */}
      <div className="flex shrink-0 items-center gap-2.5">
        <div className="flex items-center gap-0.5">
          {WORKSPACES.map((n) => (
            <button
              key={n}
              onClick={() => setWs(n)}
              style={n === ws ? { background: accent, color: '#0a0a0a' } : undefined}
              className={`grid h-4.5 min-w-4.5 place-items-center rounded-full px-1 text-[10px] ${
                n === ws ? '' : occupied.has(n) ? 'text-neutral-200 hover:bg-white/10' : 'text-neutral-600 hover:bg-white/10'
              }`}
            >
              {n === ws ? n : occupied.has(n) ? '●' : n}
            </button>
          ))}
        </div>
        <span className="tabular-nums text-neutral-100">
          {`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`}
        </span>
        <span className="hidden text-neutral-400 md:inline">{`${now.getMonth() + 1}/${now.getDate()}(${wd})`}</span>
        {s && s.wtemp > -900 && <span className="hidden text-neutral-200 lg:inline">{wIcon(s.wcode)} {s.wtemp}°</span>}
      </div>

      {/* 右: CPU/GPU/VRAM/RAM/SWP(xl+全部) | ネット(lg+) | 温度 | 音量 | 電源 | アバター */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 overflow-hidden">
        {s && (
          <div className="flex shrink-0 items-center gap-1.5 tabular-nums text-neutral-300">
            {s.cpu >= 0 && <span>CPU {s.cpu}%</span>}
            {s.gpu >= 0 && <span>GPU {s.gpu}%</span>}
            {s.vram >= 0 && <span className="hidden sm:inline">VRAM {s.vram}%</span>}
            {s.ram >= 0 && <span className="hidden sm:inline">RAM {s.ram}%</span>}
            {typeof s.swp === 'number' && s.swp >= 0 && <span className="hidden xl:inline">SWP {s.swp}%</span>}
          </div>
        )}
        {s && (s.lan >= 0 || s.net_dn >= 0) && (
          <span className="hidden shrink-0 items-center gap-1 tabular-nums text-neutral-300 lg:flex">
            {s.lan === 1 ? <IconGlobe className="h-3.5 w-3.5" /> : s.lan === 0 ? '⚠' : ''}
            {s.net_dn >= 0 && <>↓{fmt(s.net_dn)} ↑{fmt(s.net_up)}</>}
          </span>
        )}
        {s && s.temp >= 0 && <span className="hidden shrink-0 tabular-nums text-neutral-300 md:inline">{s.temp}°C</span>}
        {s && s.vol >= 0 && (
          <span className="flex shrink-0 items-center gap-1 tabular-nums text-neutral-300"><IconVolume className="h-3.5 w-3.5" />{s.vol}%</span>
        )}
        {s && s.bright >= 0 && <span className="shrink-0 tabular-nums text-neutral-300">☀{s.bright}%</span>}
        {s && s.bat >= 0 && <span className="shrink-0 tabular-nums text-neutral-300">{s.charging ? '⚡' : '🔋'}{s.bat}%</span>}
        <div className="relative shrink-0">
          <button onClick={() => setPower((p) => !p)} title="電源" className="grid h-6 w-6 place-items-center rounded-full text-neutral-300 hover:bg-white/10">
            <IconPower className="h-3.5 w-3.5" />
          </button>
          {power && (
            <div className="glass absolute right-0 mt-1 w-32 rounded-xl p-1 text-neutral-300">
              <button onClick={() => (setPower(false), onLock())} className="block w-full rounded-lg px-2 py-1 text-left hover:bg-white/10">ロック</button>
              <button onClick={() => document.documentElement.requestFullscreen?.()} className="block w-full rounded-lg px-2 py-1 text-left hover:bg-white/10">全画面</button>
              <button onClick={() => location.reload()} className="block w-full rounded-lg px-2 py-1 text-left hover:bg-white/10">リロード</button>
            </div>
          )}
        </div>
        <button onClick={onLock} title="ユーザー(クリックでロック)" className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10 text-neutral-200">
          <IconUser className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  )
}

// 窓セッションの保存/復元(リロード/更新で吹き飛ばない対策)
const SESSION_KEY = 'nexus.session'
function loadSession(): { wins: W[]; ws: number } | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    if (s && Array.isArray(s.wins)) return s
  } catch { /* ignore */ }
  return null
}

export default function App() {
  useVfs() // Desktopフォルダの変化をデスクトップアイコンに反映
  const session0 = loadSession()
  const [wins, setWins] = useState<W[]>(session0?.wins ?? [])
  const [wallpaper, setWp] = useState<string>()
  const [accent, setAccent] = useState('#d4d4d4')
  const [drawer, setDrawer] = useState(false)
  const [ws, setWs] = useState(session0?.ws ?? 1)
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null)
  const [deskMenu, setDeskMenu] = useState<{ x: number; y: number } | null>(null)
  const longPress = useRef<number>(0)
  const wpInput = useRef<HTMLInputElement>(null)
  const [size, setSize] = useState({ w: 1280, h: 720 })
  const [ratios, setRatios] = useState<number[]>([])
  const [locked, setLocked] = useState(false)
  // 液体ガラスは全端末で既定ON(モバイル/iPadもPCと統合)。設定トグルが唯一の制御点。
  // 重い端末は設定で軽量(OFF)に切替可能。localStorage `nexus.fx` を尊重。
  const [fx, setFx] = useState(() => localStorage.getItem('nexus.fx') !== '0')
  useEffect(() => {
    localStorage.setItem('nexus.fx', fx ? '1' : '0')
  }, [fx])
  const [tghost, setTghost] = useState<{ id: string; dx: number; dy: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const z = useRef(session0 ? Math.max(10, ...session0.wins.map((w) => w.z)) : 10)
  const cascade = useRef(0)
  const mainRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef(ws)
  wsRef.current = ws
  const gdrag = useRef<Gut | null>(null)
  const tdrag = useRef<{ id: string; sx: number; sy: number; active: boolean } | null>(null)

  useEffect(() => {
    getWallpaperUrl().then((u) => {
      setWp(u)
      if (u) sampleAccent(u).then(setAccent)
    })
  }, [])
  // 窓セッションを保存(吹き飛ぶ対策)。窓が変わるたびlocalStorageへ。
  useEffect(() => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ wins, ws }))
  }, [wins, ws])
  // 起動中アプリ/窓をlogに記録(復元の手がかり)。デバウンスで頻発を抑える。
  useEffect(() => {
    const t = setTimeout(() => {
      const names = wins.filter((w) => w.state !== 'min').map((w) => w.title)
      if (names.length) vfs.logEvent('セッション', `起動中: ${names.join(', ')}`)
    }, 1500)
    return () => clearTimeout(t)
  }, [wins])
  useEffect(() => {
    const measure = () => mainRef.current && setSize({ w: mainRef.current.clientWidth, h: mainRef.current.clientHeight })
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])
  // サイト内ではブラウザ既定の右クリックメニューを抑止(アプリ独自の右クリックを使うため)。
  // アプリの onContextMenu(独自メニュー)は別途発火するので両立する。
  useEffect(() => {
    const block = (e: MouseEvent) => e.preventDefault()
    document.addEventListener('contextmenu', block)
    return () => document.removeEventListener('contextmenu', block)
  }, [])

  // キーボード(デスクトップ向け。タッチ操作はそのまま動く)。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      const inField = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
      // OSショートカット = Ctrl または Alt(修飾)。
      // ブラウザのタブ内では Ctrl+数字/W/L/E/B 等が横取りされるため、Alt でも発火させる
      // (Ctrl は全画面/PWAで有効・Alt はタブ内でも有効)。
      const mod = (e.ctrlKey || e.altKey) && !e.metaKey
      if (mod) {
        const k = e.key.toLowerCase()
        if (k >= '1' && k <= '9') { e.preventDefault(); setWs(Number(k)); return }
        if (k === '0') { e.preventDefault(); setWs(10); return }
        if (k === 'e') { e.preventDefault(); openApp('files'); return }
        if (k === 'b') { e.preventDefault(); openApp('browser'); return }
        if (k === 'l') { e.preventDefault(); setLocked(true); return }
        if (e.code === 'Backquote') { e.preventDefault(); openApp('terminal'); return }
        if (k === 'w') {
          e.preventDefault()
          const cur = stateRef.current
          const here2 = cur.wins.filter((w) => w.ws === cur.ws && w.state !== 'min')
          const top = here2.length ? [...here2].sort((a, b) => b.z - a.z)[0] : null
          if (top) close(top.id)
          return
        }
      }
      if (inField) return
      // 素の数字キーでもワークスペース(入力欄以外)
      if (e.key >= '1' && e.key <= '9' && !e.ctrlKey && !e.metaKey && !e.altKey) setWs(Number(e.key))
      if (e.key === '0' && !e.ctrlKey && !e.metaKey && !e.altKey) setWs(10)
      if (e.key === 'Escape') {
        setMenu(null)
        setDeskMenu(null)
        setDrawer(false)
      }
    }
    // capture段で受ける(ブラウザ既定より先に拾えるものは拾う)
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  function focus(id: string) {
    setWins((all) => all.map((w) => (w.id === id ? { ...w, z: ++z.current } : w)))
  }
  function openApp(app: AppId, path?: string) {
    if (app === 'editor' && !path) {
      // 空のうちはファイルを作らない(何も書かなければ保存されない)。
      // 既存ファイル + 開いているエディタ窓のパスと衝突しない untitled 名を選ぶ。
      const openPaths = new Set(stateRef.current.wins.filter((w) => w.app === 'editor').map((w) => w.path))
      let np = '/home/user/untitled.txt'
      for (let i = 1; vfs.exists(np) || openPaths.has(np); i++) np = `/home/user/untitled-${i}.txt`
      path = np
    }
    setWins((all) => {
      if (app === 'editor' && path) {
        const ex = all.find((w) => w.app === 'editor' && w.path === path)
        if (ex) return all.map((w) => (w.id === ex.id ? { ...w, z: ++z.current, state: 'normal', ws: wsRef.current } : w))
      }
      const d = DEF[app]
      const n = cascade.current++ % 6
      return [...all, {
        id: crypto.randomUUID(), app, path, ws: wsRef.current, floating: false,
        title: app === 'editor' && path ? basename(path) : d.title,
        x: 80 + n * 30, y: 60 + n * 28, w: d.w, h: d.h, z: ++z.current, state: 'normal' as const,
      }]
    })
    setDrawer(false)
  }
  const upd = (id: string, f: (w: W) => W) => setWins((all) => all.map((w) => (w.id === id ? f(w) : w)))
  const close = (id: string) => setWins((all) => all.filter((w) => w.id !== id))
  const min = (id: string) => upd(id, (w) => ({ ...w, state: 'min' }))
  const max = (id: string) => upd(id, (w) => ({ ...w, state: w.state === 'max' ? 'normal' : 'max', z: ++z.current }))
  // タイル→フロート化は「今表示中のタイル矩形」をそのまま引き継ぐ(ワープしない)
  const toggleFloat = (id: string, cur?: Rect) =>
    upd(id, (w) =>
      !w.floating && cur
        ? { ...w, floating: true, x: cur.x, y: cur.y, w: cur.w, h: cur.h, z: ++z.current }
        : { ...w, floating: !w.floating, z: ++z.current },
    )
  const move = (id: string, x: number, y: number) => upd(id, (w) => ({ ...w, x, y }))
  const resize = (id: string, w_: number, h_: number) => upd(id, (w) => ({ ...w, w: w_, h: h_ }))
  const sendToWs = (id: string, n: number) => { upd(id, (w) => ({ ...w, ws: n })); setMenu(null) }
  const taskClick = (w: W) => upd(w.id, (x) => ({ ...x, state: 'normal', z: ++z.current }))
  function swap(a: string, b: string) {
    setWins((all) => {
      const ia = all.findIndex((w) => w.id === a)
      const ib = all.findIndex((w) => w.id === b)
      if (ia < 0 || ib < 0) return all
      const c = [...all]
      ;[c[ia], c[ib]] = [c[ib], c[ia]]
      return c
    })
  }

  // gutter(リサイズ) と tiled窓ドラッグ(スワップ) の共通ポインタ処理
  useEffect(() => {
    const moveH = (e: PointerEvent) => {
      if (gdrag.current) {
        const rect = mainRef.current!.getBoundingClientRect()
        const g = gdrag.current
        const ratio = g.v ? (e.clientX - rect.left - g.ax) / g.aw : (e.clientY - rect.top - g.ay) / g.ah
        setRatios((r) => {
          const c = [...r]
          c[g.i] = clamp(ratio, 0.15, 0.85)
          return c
        })
      } else if (tdrag.current) {
        const dx = e.clientX - tdrag.current.sx
        const dy = e.clientY - tdrag.current.sy
        // 閾値を超えて初めてゴースト化(=クリックはクリックのまま・ボタン操作を殺さない)
        if (tdrag.current.active || Math.hypot(dx, dy) > 5) {
          tdrag.current.active = true
          setDragging(true)
          setTghost({ id: tdrag.current.id, dx, dy })
        }
      }
    }
    const upH = (e: PointerEvent) => {
      // 実際に動いた(ghost化した)時だけスワップ判定。クリックは無視。
      if (tdrag.current && tdrag.current.active) {
        const t = tdrag.current
        const el = (document.elementFromPoint(e.clientX, e.clientY) as Element | null)?.closest('[data-winid]')
        const tid = el?.getAttribute('data-winid')
        if (tid && tid !== t.id) swap(t.id, tid)
      }
      gdrag.current = null
      tdrag.current = null
      setTghost(null)
      setDragging(false)
    }
    window.addEventListener('pointermove', moveH)
    window.addEventListener('pointerup', upH)
    return () => {
      window.removeEventListener('pointermove', moveH)
      window.removeEventListener('pointerup', upH)
    }
  }, [])

  async function pickWallpaper(file: File) {
    await setWallpaper(file)
    const u = await getWallpaperUrl()
    setWp(u)
    if (u) setAccent(await sampleAccent(u))
  }
  function resetWallpaper() {
    clearWallpaper()
    setWp(undefined)
    setAccent('#d4d4d4')
  }

  function bodyOf(w: W) {
    if (w.app === 'terminal') return <Terminal onOpen={(p) => openApp('editor', p)} />
    if (w.app === 'files') return <Files onOpen={(p) => openApp('editor', p)} />
    if (w.app === 'editor' && w.path) return <Editor path={w.path} />
    if (w.app === 'browser') return <Browser />
    if (w.app === 'settings') return <Settings hasWallpaper={!!wallpaper} onPick={pickWallpaper} onReset={resetWallpaper} fx={fx} onToggleFx={setFx} />
    return null
  }

  const occupied = new Set(wins.map((w) => w.ws))
  const here = wins.filter((w) => w.ws === ws)
  const shown = here.filter((w) => w.state !== 'min')
  const focusedId = shown.length ? [...shown].sort((a, b) => b.z - a.z)[0].id : ''
  const activeTitle = shown.find((w) => w.id === focusedId)?.title ?? ''

  const tiledIds = shown.filter((w) => !w.floating && w.state !== 'max').map((w) => w.id)
  const tileMap: Record<string, Rect> = {}
  const guts: Gut[] = []
  layout({ x: GAP, y: GAP, w: Math.max(1, size.w - 2 * GAP), h: Math.max(1, size.h - DOCK - GAP) }, tiledIds, ratios, 0, tileMap, guts)
  function geomOf(w: W): Rect {
    if (w.state === 'max') return { x: 0, y: 0, w: size.w, h: size.h }
    if (w.floating) return { x: w.x, y: w.y, w: w.w, h: w.h }
    const r = tileMap[w.id]
    return r ? { x: r.x + GAP / 2, y: r.y + GAP / 2, w: r.w - GAP, h: r.h - GAP } : { x: w.x, y: w.y, w: w.w, h: w.h }
  }

  const grab = useRef<{ sy: number } | null>(null)
  const stateRef = useRef({ wins, ws })
  stateRef.current = { wins, ws }

  return (
    <div
      className={`relative h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100 ${fx ? 'fx' : ''} ${dragging ? 'select-none' : ''}`}
      onClick={() => {
        if (menu) setMenu(null)
        if (deskMenu) setDeskMenu(null)
      }}
    >
      {/* 壁紙 = 画面全体の背景(バーの裏まで届く=バーが本当に透ける) */}
      {wallpaper ? (
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${wallpaper})` }} />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 to-neutral-950" />
      )}

      <div className="relative z-10 flex h-full flex-col">
      <Bar ws={ws} setWs={setWs} occupied={occupied} title={activeTitle} accent={accent} onLock={() => setLocked(true)} />

      <main ref={mainRef} className="relative min-h-0 flex-1 overflow-hidden">
        {/* デスクトップ操作面(右クリック/長押し)。壁紙は背面なので透明な操作レイヤーだけ置く */}
        <div
          className="absolute inset-0"
          onContextMenu={(e) => {
            e.preventDefault()
            setDeskMenu({ x: e.clientX, y: e.clientY })
          }}
          onPointerDown={(e) => {
            if (e.pointerType === 'mouse') return
            const x = e.clientX, y = e.clientY
            longPress.current = window.setTimeout(() => setDeskMenu({ x, y }), 500)
          }}
          onPointerUp={() => clearTimeout(longPress.current)}
          onPointerMove={() => clearTimeout(longPress.current)}
        />

        <input ref={wpInput} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && pickWallpaper(e.target.files[0])} />

        <DesktopIcons
          items={[
            ...APPS.map((a) => ({ id: a.id as string, name: a.name, Icon: a.Icon })),
            // Desktopフォルダの中身も画面にアイコンとして出す(画面とフォルダを一致させる)
            ...(vfs.exists('/home/user/Desktop') ? vfs.ls('/home/user/Desktop').map((n) => {
              const p = `/home/user/Desktop/${n}`
              return { id: p, name: n, Icon: (vfs.isDir(p) ? IconFolder : IconText) as IconC }
            }) : []),
          ]}
          onOpen={(id) => {
            if (APPS.some((a) => a.id === id)) openApp(id as AppId)
            else if (vfs.isDir(id)) openApp('files')
            else openApp('editor', id)
          }}
        />

        {/* 窓 */}
        {shown.map((w) => (
          <Win
            key={w.id}
            win={w}
            geom={geomOf(w)}
            tiled={!w.floating && w.state !== 'max'}
            focused={w.id === focusedId}
            accent={accent}
            dragOffset={tghost?.id === w.id ? { dx: tghost.dx, dy: tghost.dy } : undefined}
            onClose={() => close(w.id)}
            onMin={() => min(w.id)}
            onMax={() => max(w.id)}
            onToggleFloat={() => toggleFloat(w.id, geomOf(w))}
            onFocus={() => focus(w.id)}
            onMove={(x, y) => move(w.id, x, y)}
            onResize={(ww, hh) => resize(w.id, ww, hh)}
            onMenu={(x, y) => setMenu({ x, y, id: w.id })}
            onTileDown={(x, y) => {
              focus(w.id)
              tdrag.current = { id: w.id, sx: x, sy: y, active: false }
            }}
          >
            {bodyOf(w)}
          </Win>
        ))}

        {/* リサイズ用 gutter (タイル境界) */}
        {!tghost &&
          guts.map((g) => (
            <div
              key={g.i}
              onPointerDown={() => {
                gdrag.current = g
                setDragging(true)
              }}
              style={{ left: g.x, top: g.y, width: g.w, height: g.h }}
              className={`absolute z-20 ${g.v ? 'cursor-col-resize' : 'cursor-row-resize'} hover:bg-white/20`}
            />
          ))}

        {/* 右クリックメニュー */}
        {menu && (
          <div style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()} className="glass absolute z-50 w-44 rounded-xl p-1 text-xs">
            <button
              onClick={() => {
                const tw = shown.find((w) => w.id === menu.id)
                toggleFloat(menu.id, tw ? geomOf(tw) : undefined)
                setMenu(null)
              }}
              className="block w-full rounded px-2 py-1 text-left text-neutral-300 hover:bg-white/10"
            >
              フロート / タイル 切替
            </button>
            <div className="px-2 pt-1 text-[10px] text-neutral-600">ワークスペースへ送る</div>
            <div className="flex flex-wrap gap-1 px-1 pb-1">
              {WORKSPACES.map((n) => (
                <button key={n} onClick={() => sendToWs(menu.id, n)} className="grid h-6 w-6 place-items-center rounded text-neutral-300 hover:bg-white/10">{n}</button>
              ))}
            </div>
            <button onClick={() => (close(menu.id), setMenu(null))} className="block w-full rounded px-2 py-1 text-left text-red-300 hover:bg-red-500/20">閉じる</button>
          </div>
        )}

        {/* デスクトップ右クリック/長押しメニュー */}
        {deskMenu && (
          <div style={{ left: deskMenu.x, top: deskMenu.y }} onClick={(e) => e.stopPropagation()} className="glass absolute z-50 w-44 rounded-xl p-1 text-xs">
            <div className="px-2 pt-0.5 pb-1 text-[10px] text-neutral-500">アプリを開く</div>
            {APPS.map((a) => (
              <button key={a.id} onClick={() => { openApp(a.id); setDeskMenu(null) }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-neutral-200 hover:bg-white/10">
                <a.Icon className="h-3.5 w-3.5" />{a.name}
              </button>
            ))}
            <div className="my-1 h-px bg-white/10" />
            <button onClick={() => { wpInput.current?.click(); setDeskMenu(null) }} className="block w-full rounded-lg px-2 py-1 text-left text-neutral-200 hover:bg-white/10">壁紙を変更</button>
            <button onClick={() => { localStorage.removeItem('nexus.icons'); location.reload() }} className="block w-full rounded-lg px-2 py-1 text-left text-neutral-200 hover:bg-white/10">アイコンを整列</button>
          </div>
        )}

        {/* アプリドロワー */}
        {drawer && (
          <div className="absolute inset-0 z-40 bg-neutral-950/70 backdrop-blur" onClick={() => setDrawer(false)}>
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2" onClick={(e) => e.stopPropagation()}>
              <div className="glass grid grid-cols-4 gap-3 rounded-2xl p-5">
                {APPS.map((a) => (
                  <button key={a.id} onClick={() => openApp(a.id)} className="flex w-20 flex-col items-center gap-2 rounded-lg p-2 hover:bg-white/10">
                    <span className="glass-pill grid h-12 w-12 place-items-center rounded-xl"><a.Icon className="h-6 w-6 text-neutral-100" /></span>
                    <span className="text-[11px] text-neutral-300">{a.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ドック */}
        <div
          onPointerDown={(e) => (grab.current = { sy: e.clientY })}
          onPointerMove={(e) => {
            if (grab.current && grab.current.sy - e.clientY > 30) {
              setDrawer(true)
              grab.current = null
            }
          }}
          onPointerUp={() => (grab.current = null)}
          className="glass absolute bottom-2 left-1/2 z-30 flex max-w-[92vw] -translate-x-1/2 items-center gap-1 rounded-2xl px-2 py-1.5"
        >
          <button onClick={() => setDrawer(true)} title="アプリ一覧 (上にドラッグでも)" className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-lg hover:bg-white/15">⊞</button>
          {APPS.map((a) => (
            <button key={a.id} onClick={() => openApp(a.id)} title={a.name} className="grid h-9 w-9 place-items-center rounded-lg text-neutral-200 hover:bg-white/10"><a.Icon className="h-5 w-5" /></button>
          ))}
          {here.length > 0 && <span className="mx-1 h-6 w-px bg-neutral-700" />}
          {here.map((w) => (
            <button key={w.id} onClick={() => taskClick(w)} title={w.title} className={`max-w-28 truncate rounded-lg px-2 py-1.5 text-[11px] hover:bg-white/10 ${w.state === 'min' ? 'text-neutral-500' : 'text-neutral-200'}`}>{w.title}</button>
          ))}
        </div>
      </main>
      </div>

      {locked && <LockScreen wallpaper={wallpaper} onUnlock={() => setLocked(false)} />}
    </div>
  )
}
