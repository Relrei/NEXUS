import { useRef, useState } from 'react'

// 簡易ブラウザ。Google は iframe 埋め込みを許す特別URL(?igu=1)で表示できる。
// 他サイトは X-Frame-Options で弾かれることがあるので、その時は新規タブで開くボタンを出す。
const HOME = 'https://www.google.com/webhp?igu=1'

function normalize(input: string): string {
  const t = input.trim()
  if (!t) return HOME
  if (/^https?:\/\//.test(t)) return t
  if (/\.\w{2,}($|\/)/.test(t) && !t.includes(' ')) return `https://${t}`
  // 検索語 → Google検索(iframe許可URL)
  return `https://www.google.com/search?igu=1&q=${encodeURIComponent(t)}`
}

export function Browser() {
  const [url, setUrl] = useState(HOME)
  const [input, setInput] = useState('')
  const frame = useRef<HTMLIFrameElement>(null)

  function go() {
    setUrl(normalize(input))
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-white/10 px-2 py-1">
        <button onClick={() => setUrl(HOME)} title="ホーム(Google)" className="rounded px-2 py-0.5 text-xs text-neutral-300 hover:bg-white/10">⌂</button>
        <button onClick={() => frame.current && (frame.current.src = url)} title="再読込" className="rounded px-2 py-0.5 text-xs text-neutral-300 hover:bg-white/10">⟳</button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && go()}
          placeholder="検索 または URL（Google）"
          className="mx-1 flex-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
        />
        <button onClick={() => window.open(url, '_blank', 'noopener')} title="新規タブで開く" className="rounded px-2 py-0.5 text-xs text-neutral-300 hover:bg-white/10">↗</button>
      </div>
      <iframe
        ref={frame}
        src={url}
        title="browser"
        className="min-h-0 flex-1 bg-white"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
      />
    </div>
  )
}
