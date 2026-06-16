import { useEffect, useRef, useState } from 'react'
import { basename, resolve, useVfs, vfs } from '../vfs'

// kitty風ターミナル。仮想FS上で実際に動く(ls/cd/cat/mkdir/touch/rm/echo/open…)。
const HELP = `使えるコマンド:
  ls [path]        一覧
  cd <path>        移動
  pwd              現在地
  cat <file>       中身表示
  echo <text> > f  書き込み
  mkdir <dir>      フォルダ作成
  touch <file>     空ファイル
  rm <path>        削除
  open <file>      エディタで開く
  clear            画面消去
  neofetch         システム情報`

export function Terminal({ onOpen }: { onOpen?: (path: string) => void }) {
  useVfs()
  const [cwd, setCwd] = useState('/home/user')
  const [lines, setLines] = useState<string[]>(['NEXUS OS — kitty. `help` で使い方。'])
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => endRef.current?.scrollIntoView(), [lines])

  function run(raw: string) {
    const out = (s: string) => setLines((l) => [...l, s])
    out(`user@nexus:${cwd}$ ${raw}`)
    const t = raw.trim()
    if (!t) return
    // echo text > file
    const redir = t.match(/^echo\s+(.*?)\s*>\s*(\S+)$/)
    if (redir) {
      vfs.writeFile(resolve(cwd, redir[2]), redir[1] + '\n')
      return
    }
    const [cmd, ...args] = t.split(/\s+/)
    const a0 = args[0] ? resolve(cwd, args[0]) : cwd
    switch (cmd) {
      case 'help':
        out(HELP)
        break
      case 'ls':
        out(vfs.isDir(a0) ? vfs.ls(a0).join('  ') || '(空)' : `ls: ${args[0]}: ない`)
        break
      case 'pwd':
        out(cwd)
        break
      case 'cd':
        if (!args[0]) setCwd('/home/user')
        else if (vfs.isDir(a0)) setCwd(a0)
        else out(`cd: ${args[0]}: フォルダがない`)
        break
      case 'cat':
        out(vfs.isFile(a0) ? vfs.read(a0) : `cat: ${args[0]}: ない`)
        break
      case 'echo':
        out(args.join(' '))
        break
      case 'mkdir':
        if (args[0]) vfs.mkdir(a0)
        break
      case 'touch':
        if (args[0] && !vfs.exists(a0)) vfs.writeFile(a0, '')
        break
      case 'rm':
        if (vfs.exists(a0)) vfs.rm(a0)
        else out(`rm: ${args[0]}: ない`)
        break
      case 'open':
        if (vfs.isFile(a0)) onOpen?.(a0)
        else out(`open: ${args[0]}: ファイルがない`)
        break
      case 'clear':
        setLines([])
        break
      case 'neofetch':
        out('  NEXUS OS  (Arch + Hyprland 再現)\n  WM: tiling/float  Shell: kitty  FS: vfs(local)')
        break
      default:
        out(`${cmd}: コマンドがない (help)`)
    }
  }

  return (
    <div className="flex h-full flex-col bg-transparent p-2 font-mono text-[12.5px] text-neutral-200">
      <div className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap">
        {lines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="flex items-center gap-1 pt-1 text-emerald-400">
        <span className="shrink-0">{`user@nexus:${basename(cwd) || '/'}$`}</span>
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              run(input)
              setInput('')
            }
          }}
          className="w-full bg-transparent text-neutral-100 focus:outline-none"
        />
      </div>
    </div>
  )
}
