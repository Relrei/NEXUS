import { useEffect, useState } from 'react'

// ロック画面。個人機なのでパスワードは任意(localStorageに任意設定)。未設定なら誰でも解除。
export function LockScreen({ wallpaper, onUnlock }: { wallpaper?: string; onUnlock: () => void }) {
  const [now, setNow] = useState(() => new Date())
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)
  const saved = localStorage.getItem('nexus.lockpw') || ''
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const p2 = (n: number) => n.toString().padStart(2, '0')

  function unlock() {
    if (!saved || pw === saved) onUnlock()
    else {
      setErr(true)
      setPw('')
    }
  }

  return (
    <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center">
      {wallpaper ? (
        <div className="absolute inset-0 scale-110 bg-cover bg-center blur-xl" style={{ backgroundImage: `url(${wallpaper})` }} />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 to-neutral-950" />
      )}
      <div className="absolute inset-0 bg-neutral-950/40" />

      <div className="relative z-10 mb-10 text-center">
        <div className="text-7xl font-light tracking-tight text-white tabular-nums drop-shadow">
          {`${p2(now.getHours())}:${p2(now.getMinutes())}`}
        </div>
        <div className="mt-1 text-sm text-neutral-300">
          {`${now.getMonth() + 1}月${now.getDate()}日 (${['日', '月', '火', '水', '木', '金', '土'][now.getDay()]})`}
        </div>
      </div>

      <div className="glass relative z-10 w-72 rounded-2xl p-6 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-white/15 text-2xl">🙂</div>
        <div className="mb-4 text-sm text-neutral-100">user</div>
        {saved ? (
          <input
            type="password"
            autoFocus
            value={pw}
            onChange={(e) => {
              setPw(e.target.value)
              setErr(false)
            }}
            onKeyDown={(e) => e.key === 'Enter' && unlock()}
            placeholder="パスワード"
            className={`mb-3 w-full rounded-full bg-white/10 px-4 py-2 text-center text-sm text-white placeholder:text-neutral-400 focus:outline-none ${
              err ? 'ring-1 ring-red-400' : ''
            }`}
          />
        ) : (
          <p className="mb-3 text-[11px] text-neutral-400">パスワード未設定（誰でも解除できます）</p>
        )}
        <button onClick={unlock} className="glass-pill w-full rounded-full py-2 text-sm text-white hover:bg-white/15">
          ロック解除
        </button>
      </div>
    </div>
  )
}
