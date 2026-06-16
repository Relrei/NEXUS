import { useEffect, useState } from 'react'
import { vfs } from '../vfs'

// テキストエディタ。仮想FSのファイルをその場編集→自動保存。
export function Editor({ path }: { path: string }) {
  const [text, setText] = useState(() => vfs.read(path))

  useEffect(() => {
    const t = setTimeout(() => vfs.writeFile(path, text), 350)
    return () => clearTimeout(t)
  }, [text, path])

  return (
    <textarea
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder="（空のファイル）"
      className="h-full w-full resize-none bg-transparent p-3 font-mono text-[13px] leading-relaxed text-neutral-200 focus:outline-none"
    />
  )
}
