import { useEffect, useRef, useState } from 'react'
import { vfs } from '../vfs'

// テキストエディタ。仮想FSのファイルをその場編集→自動保存(履歴は残さない)。
// Ctrl+S=即保存(ブラウザ保存ダイアログ抑止)、Ctrl+Z/Shift+Zはtextareaのネイティブundo/redo。
export function Editor({ path }: { path: string }) {
  const [text, setText] = useState(() => vfs.read(path))
  const [saved, setSaved] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      // 空のまま & 未作成なら保存しない(何も書かれなかったノートを残さない)
      if (text === '' && !vfs.exists(path)) return
      vfs.writeFile(path, text, false)
    }, 350)
    return () => clearTimeout(t)
  }, [text, path])

  function save() {
    vfs.writeFile(path, ref.current?.value ?? text, false)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1200)
  }

  return (
    <div className="relative h-full w-full">
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault()
            e.stopPropagation()
            save()
          }
        }}
        placeholder="（空のファイル）"
        className="h-full w-full resize-none bg-transparent p-3 font-mono text-[13px] leading-relaxed text-neutral-200 focus:outline-none"
      />
      {saved && (
        <div className="pointer-events-none absolute right-2 bottom-2 rounded bg-emerald-500/80 px-2 py-0.5 text-[11px] text-white">保存しました</div>
      )}
    </div>
  )
}
