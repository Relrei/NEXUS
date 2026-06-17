import { useEffect, useRef, useState } from 'react'
import { basename, resolve, useVfs, vfs } from '../vfs'

// kitty風ターミナル。仮想FS上で実際に動く実用端末。
// cwd/履歴(↑↓・localStorage)/Tab補完/bash風コマンドを備える。
const HOME = '/home/user'
const HIST_KEY = 'nexus.term.history'
const HIST_MAX = 100
const ALIAS_KEY = 'nexus.term.alias'

function loadAlias(): Record<string, string> {
  try { const s = JSON.parse(localStorage.getItem(ALIAS_KEY) || 'null'); if (s && typeof s === 'object') return s } catch { /* ignore */ }
  return {}
}

const HELP = `使えるコマンド:
  ls [-l] [path]      一覧 (-l で詳細: 種別/サイズ/更新日時)
  cd [path]           移動 (cd / cd .. / cd - / cd でホーム)
  pwd                 現在地
  cat <file>          中身表示
  echo <text>         表示 (> file で書込 / >> file で追記)
  mkdir <dir>         フォルダ作成
  touch <file>        空ファイル作成 / 更新時刻更新
  rm [-r] <path>      削除 (-r で再帰)
  mv <src> <dst>      移動 / 改名
  cp [-r] <src> <dst> コピー (-r でディレクトリ再帰)
  tree [path]         ツリー表示
  head/tail [-n N] f  先頭/末尾 N 行 (既定 10)
  wc <file>           行/語/文字数
  grep <語> [path]    中身を再帰検索 (行つきヒット)
  find <名> [path]    名前でパスを再帰検索
  alias [name=cmd]    別名の登録/一覧 (unalias で削除)
  open <file>         エディタで開く
  date / whoami       日時 / ユーザー名
  clear (Ctrl+L)      画面消去   (Ctrl+R 履歴検索)
  neofetch            システム情報
  help                この一覧`

// ~ 表記でcwdを短縮表示
function tilde(p: string): string {
  if (p === HOME) return '~'
  if (p.startsWith(HOME + '/')) return '~' + p.slice(HOME.length)
  return p
}

function fmtDate(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function loadHistory(): string[] {
  try {
    const s = JSON.parse(localStorage.getItem(HIST_KEY) || 'null')
    if (Array.isArray(s)) return s.filter((x) => typeof x === 'string')
  } catch {
    /* ignore */
  }
  return []
}

export function Terminal({ onOpen }: { onOpen?: (path: string) => void }) {
  useVfs()
  const [cwd, setCwd] = useState(HOME)
  const prevCwd = useRef(HOME) // cd - 用
  const [lines, setLines] = useState<string[]>(['NEXUS OS — kitty. `help` で使い方。'])
  const [input, setInput] = useState('')
  const histRef = useRef<string[]>(loadHistory())
  const histIdx = useRef<number>(histRef.current.length) // 末尾=新規入力
  const draft = useRef('') // 履歴閲覧前の未送信入力を退避
  const aliasRef = useRef<Record<string, string>>(loadAlias())
  const search = useRef<{ active: boolean; q: string }>({ active: false, q: '' }) // Ctrl+R 履歴検索
  const [searchUi, setSearchUi] = useState('') // 検索中の表示
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => endRef.current?.scrollIntoView(), [lines])

  function pushHistory(cmd: string) {
    const h = histRef.current
    if (cmd && h[h.length - 1] !== cmd) {
      h.push(cmd)
      while (h.length > HIST_MAX) h.shift()
      try {
        localStorage.setItem(HIST_KEY, JSON.stringify(h))
      } catch {
        /* ignore */
      }
    }
    histIdx.current = h.length
  }

  // ディレクトリの再帰コピー (vfsにcpが無いので自前)
  function copyRecursive(src: string, dst: string) {
    if (vfs.isFile(src)) {
      vfs.writeFile(dst, vfs.read(src))
      return
    }
    vfs.mkdir(dst)
    for (const name of vfs.ls(src)) {
      copyRecursive(`${src}/${name}`, dst === '/' ? `/${name}` : `${dst}/${name}`)
    }
  }

  // tree 描画
  function treeLines(p: string, prefix: string, acc: string[]) {
    const names = vfs.ls(p)
    names.forEach((name, i) => {
      const last = i === names.length - 1
      const child = p === '/' ? `/${name}` : `${p}/${name}`
      const isDir = vfs.isDir(child)
      acc.push(`${prefix}${last ? '└── ' : '├── '}${name}${isDir ? '/' : ''}`)
      if (isDir) treeLines(child, prefix + (last ? '    ' : '│   '), acc)
    })
  }

  function run(raw: string) {
    const out = (s: string) => setLines((l) => [...l, s])
    out(`user@nexus ${tilde(cwd)} $ ${raw}`)
    const t = raw.trim()
    if (!t) return

    // リダイレクト: echo ... > file / >> file
    const redir = t.match(/^echo\s+(.*?)\s*(>>?)\s*(\S+)$/)
    if (redir) {
      const [, text, op, file] = redir
      const fp = resolve(cwd, file)
      const body = text + '\n'
      if (op === '>>') vfs.writeFile(fp, (vfs.isFile(fp) ? vfs.read(fp) : '') + body)
      else vfs.writeFile(fp, body)
      return
    }

    // alias 展開(先頭トークンのみ・1段)
    let line = t
    const first = t.split(/\s+/)[0]
    if (aliasRef.current[first]) line = aliasRef.current[first] + t.slice(first.length)

    const tokens = line.split(/\s+/)
    const cmd = tokens[0]
    const rest = tokens.slice(1)
    // フラグと位置引数を分離
    const flags = rest.filter((x) => x.startsWith('-'))
    const args = rest.filter((x) => !x.startsWith('-'))
    const hasFlag = (f: string) => flags.some((fl) => fl.includes(f))
    const a0 = args[0] ? resolve(cwd, args[0]) : cwd

    switch (cmd) {
      case 'help':
        out(HELP)
        break

      case 'ls': {
        if (!vfs.exists(a0)) {
          out(`ls: ${args[0] ?? ''}: No such file or directory`)
          break
        }
        const names = vfs.isDir(a0) ? vfs.ls(a0) : [basename(a0)]
        if (hasFlag('l')) {
          const rows = names.map((name) => {
            const cp = vfs.isDir(a0) ? (a0 === '/' ? `/${name}` : `${a0}/${name}`) : a0
            const st = vfs.stat(cp)
            const type = st?.dir ? 'd' : '-'
            const size = String(st?.size ?? 0).padStart(6)
            const date = st ? fmtDate(st.mt) : ''
            return `${type} ${size}  ${date}  ${name}${st?.dir ? '/' : ''}`
          })
          out(rows.join('\n') || '(空)')
        } else {
          out(names.map((n) => (vfs.isDir(a0) && vfs.isDir(`${a0}/${n}`) ? n + '/' : n)).join('  ') || '(空)')
        }
        break
      }

      case 'pwd':
        out(cwd)
        break

      case 'cd': {
        let target: string
        if (!args[0]) target = HOME
        else if (args[0] === '-') target = prevCwd.current
        else target = a0
        if (!vfs.exists(target)) {
          out(`cd: no such file or directory: ${args[0]}`)
        } else if (!vfs.isDir(target)) {
          out(`cd: not a directory: ${args[0]}`)
        } else {
          prevCwd.current = cwd
          setCwd(target)
        }
        break
      }

      case 'cat':
        if (!args[0]) out('cat: missing operand')
        else if (vfs.isFile(a0)) out(vfs.read(a0).replace(/\n$/, '') || '')
        else if (vfs.isDir(a0)) out(`cat: ${args[0]}: Is a directory`)
        else out(`cat: ${args[0]}: No such file or directory`)
        break

      case 'echo':
        out(rest.join(' '))
        break

      case 'mkdir':
        if (!args[0]) out('mkdir: missing operand')
        else if (vfs.exists(a0)) out(`mkdir: ${args[0]}: File exists`)
        else vfs.mkdir(a0)
        break

      case 'touch':
        if (!args[0]) out('touch: missing operand')
        else if (vfs.isDir(a0)) out(`touch: ${args[0]}: Is a directory`)
        else vfs.writeFile(a0, vfs.isFile(a0) ? vfs.read(a0) : '')
        break

      case 'rm':
        if (!args[0]) out('rm: missing operand')
        else if (!vfs.exists(a0)) out(`rm: ${args[0]}: No such file or directory`)
        else if (vfs.isDir(a0) && !hasFlag('r')) out(`rm: ${args[0]}: is a directory`)
        else vfs.rm(a0)
        break

      case 'mv': {
        if (args.length < 2) {
          out('mv: missing operand')
          break
        }
        const src = resolve(cwd, args[0])
        const dst = resolve(cwd, args[1])
        if (!vfs.exists(src)) {
          out(`mv: ${args[0]}: No such file or directory`)
          break
        }
        if (vfs.isDir(dst)) {
          // dst ディレクトリの中へ移動
          vfs.move(src, dst)
        } else if (vfs.parentOf(src) === vfs.parentOf(dst)) {
          // 同じ親 → 改名
          vfs.rename(src, basename(dst))
        } else {
          // 別ディレクトリへ移動 + 改名
          vfs.move(src, vfs.parentOf(dst))
          if (basename(src) !== basename(dst)) {
            const moved = vfs.parentOf(dst) === '/' ? `/${basename(src)}` : `${vfs.parentOf(dst)}/${basename(src)}`
            vfs.rename(moved, basename(dst))
          }
        }
        break
      }

      case 'cp': {
        if (args.length < 2) {
          out('cp: missing operand')
          break
        }
        const src = resolve(cwd, args[0])
        let dst = resolve(cwd, args[1])
        if (!vfs.exists(src)) {
          out(`cp: ${args[0]}: No such file or directory`)
          break
        }
        if (vfs.isDir(src) && !hasFlag('r')) {
          out(`cp: ${args[0]}: is a directory (use -r)`)
          break
        }
        // dst が既存ディレクトリなら、その中へ同名でコピー
        if (vfs.isDir(dst)) dst = dst === '/' ? `/${basename(src)}` : `${dst}/${basename(src)}`
        copyRecursive(src, dst)
        break
      }

      case 'tree': {
        const root = a0
        if (!vfs.isDir(root)) {
          out(`tree: ${args[0] ?? ''}: not a directory`)
          break
        }
        const acc: string[] = [tilde(root)]
        treeLines(root, '', acc)
        out(acc.join('\n'))
        break
      }

      case 'head':
      case 'tail': {
        const nFlag = rest.find((x) => /^-n$/.test(x))
        let n = 10
        const idx = rest.indexOf('-n')
        if (nFlag && idx >= 0 && rest[idx + 1]) n = parseInt(rest[idx + 1], 10) || 10
        const file = args.find((x) => !/^\d+$/.test(x))
        const fp = file ? resolve(cwd, file) : ''
        if (!file) out(`${cmd}: missing operand`)
        else if (!vfs.isFile(fp)) out(`${cmd}: ${file}: No such file or directory`)
        else {
          const all = vfs.read(fp).replace(/\n$/, '').split('\n')
          const sel = cmd === 'head' ? all.slice(0, n) : all.slice(-n)
          out(sel.join('\n'))
        }
        break
      }

      case 'wc':
        if (!args[0]) out('wc: missing operand')
        else if (!vfs.isFile(a0)) out(`wc: ${args[0]}: No such file or directory`)
        else {
          const c = vfs.read(a0)
          const lineN = c === '' ? 0 : c.replace(/\n$/, '').split('\n').length
          const wordN = c.trim() === '' ? 0 : c.trim().split(/\s+/).length
          out(`${lineN} ${wordN} ${c.length} ${args[0]}`)
        }
        break

      case 'grep': {
        const term = rest[0]
        if (!term) { out('grep: 使い方: grep <語> [path]'); break }
        const root = rest[1] ? resolve(cwd, rest[1]) : cwd
        const tl = term.toLowerCase()
        const targets = vfs.isFile(root) ? [root] : [root, ...vfs.subtree(root)]
        const hits: string[] = []
        for (const p of targets) {
          if (!vfs.isFile(p)) continue
          vfs.read(p).split('\n').forEach((l, i) => {
            if (l.toLowerCase().includes(tl)) hits.push(`${tilde(p)}:${i + 1}: ${l.trim()}`)
          })
        }
        out(hits.length ? hits.slice(0, 200).join('\n') : `grep: 「${term}」に一致なし`)
        break
      }

      case 'find': {
        const name = rest[0]
        if (!name) { out('find: 使い方: find <名> [path]'); break }
        const nl = name.toLowerCase()
        const root = rest[1] ? resolve(cwd, rest[1]) : cwd
        const all = [root, ...vfs.subtree(root)].filter((p) => basename(p).toLowerCase().includes(nl))
        out(all.length ? all.map(tilde).join('\n') : `find: 「${name}」に一致なし`)
        break
      }

      case 'alias': {
        if (rest.length === 0) {
          const entries = Object.entries(aliasRef.current)
          out(entries.length ? entries.map(([k, v]) => `alias ${k}='${v}'`).join('\n') : '(別名なし)')
          break
        }
        const m = rest.join(' ').match(/^([^=]+)=(.+)$/)
        if (!m) { out("alias: 使い方: alias name='cmd'"); break }
        aliasRef.current[m[1].trim()] = m[2].replace(/^['"]|['"]$/g, '').trim()
        try { localStorage.setItem(ALIAS_KEY, JSON.stringify(aliasRef.current)) } catch { /* ignore */ }
        break
      }

      case 'unalias':
        if (!rest[0]) out('unalias: missing operand')
        else { delete aliasRef.current[rest[0]]; try { localStorage.setItem(ALIAS_KEY, JSON.stringify(aliasRef.current)) } catch { /* ignore */ } }
        break

      case 'open':
        if (!args[0]) out('open: missing operand')
        else if (vfs.isFile(a0)) onOpen?.(a0)
        else out(`open: ${args[0]}: No such file or directory`)
        break

      case 'date':
        out(new Date().toString())
        break

      case 'whoami':
        out('user')
        break

      case 'clear':
        setLines([])
        break

      case 'neofetch':
        out('  NEXUS OS  (Arch + Hyprland 再現)\n  WM: tiling/float  Shell: kitty  FS: vfs(local)')
        break

      default:
        out(`${cmd}: command not found (help)`)
    }
  }

  // Tab補完: 最後のトークンを cwd / 指定ディレクトリ内で前方一致補完
  function complete() {
    const m = input.match(/(\S*)$/)
    const frag = m ? m[1] : ''
    // frag のディレクトリ部分とプレフィックスを分離
    const slash = frag.lastIndexOf('/')
    const dirPart = slash >= 0 ? frag.slice(0, slash + 1) : ''
    const pre = slash >= 0 ? frag.slice(slash + 1) : frag
    const dir = dirPart ? resolve(cwd, dirPart) : cwd
    if (!vfs.isDir(dir)) return
    const cands = vfs.ls(dir).filter((n) => n.startsWith(pre))
    if (cands.length === 0) return
    if (cands.length === 1) {
      const full = vfs.isDir(dir === '/' ? `/${cands[0]}` : `${dir}/${cands[0]}`)
      const replacement = dirPart + cands[0] + (full ? '/' : '')
      setInput(input.slice(0, input.length - frag.length) + replacement)
    } else {
      // 共通プレフィックスまで伸ばす + 候補列挙
      let common = cands[0]
      for (const c of cands) {
        while (!c.startsWith(common)) common = common.slice(0, -1)
      }
      if (common.length > pre.length) {
        setInput(input.slice(0, input.length - frag.length) + dirPart + common)
      }
      setLines((l) => [...l, `user@nexus ${tilde(cwd)} $ ${input}`, cands.join('  ')])
    }
  }

  // Ctrl+R: 履歴を後方一致でインクリメンタル検索
  function historyMatch(q: string): string {
    if (!q) return ''
    const h = histRef.current
    for (let i = h.length - 1; i >= 0; i--) if (h[i].includes(q)) return h[i]
    return ''
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // 履歴検索モード中の処理
    if (search.current.active) {
      if (e.key === 'Escape') { e.preventDefault(); search.current = { active: false, q: '' }; setSearchUi(''); return }
      if (e.key === 'Enter') { e.preventDefault(); const hit = historyMatch(search.current.q); search.current = { active: false, q: '' }; setSearchUi(''); if (hit) { setInput(hit) }; return }
      if (e.key === 'Backspace') { e.preventDefault(); search.current.q = search.current.q.slice(0, -1); setSearchUi(search.current.q); return }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { e.preventDefault(); search.current.q += e.key; setSearchUi(search.current.q); return }
    }
    if (e.key === 'r' && e.ctrlKey) { e.preventDefault(); search.current = { active: true, q: '' }; setSearchUi(''); return }
    if (e.key === 'Enter') {
      run(input)
      pushHistory(input.trim())
      setInput('')
      draft.current = ''
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const h = histRef.current
      if (histIdx.current === h.length) draft.current = input
      if (histIdx.current > 0) {
        histIdx.current -= 1
        setInput(h[histIdx.current])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const h = histRef.current
      if (histIdx.current < h.length) {
        histIdx.current += 1
        setInput(histIdx.current === h.length ? draft.current : h[histIdx.current])
      }
    } else if (e.key === 'Tab') {
      e.preventDefault()
      complete()
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      setLines([])
    }
  }

  return (
    <div
      className="h-full overflow-auto bg-transparent p-2 font-mono text-[12.5px] text-neutral-200"
      onClick={() => inputRef.current?.focus()}
    >
      {/* 上から流れる: 出力 → そのすぐ後にプロンプト(入力)。下部固定にしない。 */}
      <div className="whitespace-pre-wrap">
        {lines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
      <div className="flex items-center gap-1 text-neutral-400">
        <span className="shrink-0 text-neutral-300">
          {search.current.active ? `(履歴検索)'${searchUi}' → ${historyMatch(searchUi) || '…'}` : `user@nexus ${tilde(cwd)} $`}
        </span>
        <input
          ref={inputRef}
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoComplete="off"
          className="w-full bg-transparent text-neutral-100 focus:outline-none"
        />
      </div>
      <div ref={endRef} />
    </div>
  )
}
