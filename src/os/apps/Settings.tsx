import { useRef, useState } from 'react'
import { vfs } from '../vfs'
import { exportToFile, importFromFile } from '../../backup'

// 設定。壁紙・ガラス。壁紙の実体取得/保存は親(App)が持つ。
export function Settings({
  hasWallpaper,
  onPick,
  onReset,
  fx,
  onToggleFx,
}: {
  hasWallpaper: boolean
  onPick: (file: File) => void
  onReset: () => void
  fx: boolean
  onToggleFx: (v: boolean) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const importInput = useRef<HTMLInputElement>(null)
  const [logMax, setLogMax] = useState(() => vfs.logMax())
  const [busy, setBusy] = useState(false)

  async function doExport() {
    setBusy(true)
    try {
      await exportToFile()
    } catch (e) {
      alert('エクスポート失敗: ' + e)
    } finally {
      setBusy(false)
    }
  }
  async function doImport(file: File) {
    if (!confirm('このファイルの内容を今の倉庫にマージします。よろしいですか？')) return
    setBusy(true)
    try {
      const r = await importFromFile(file, 'merge')
      alert(`取り込み完了: items ${r.items} / blobs ${r.blobs}\n再読み込みします。`)
      location.reload()
    } catch (e) {
      alert('インポート失敗: ' + e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-4 p-4 text-sm">
      <div>
        <div className="mb-2 text-neutral-400">壁紙</div>
        <div className="flex gap-2">
          <button
            onClick={() => input.current?.click()}
            className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
          >
            画像を選ぶ
          </button>
          {hasWallpaper && (
            <button
              onClick={onReset}
              className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800"
            >
              リセット
            </button>
          )}
          <input
            ref={input}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
          />
        </div>
      </div>
      <div>
        <div className="mb-2 text-neutral-400">液体ガラス</div>
        <button
          onClick={() => onToggleFx(!fx)}
          className={`flex items-center gap-2 rounded border px-3 py-1.5 text-xs ${fx ? 'border-white/30 bg-white/15 text-white' : 'border-neutral-700 text-neutral-300'}`}
        >
          <span className={`inline-block h-3 w-3 rounded-full ${fx ? 'bg-emerald-400' : 'bg-neutral-600'}`} />
          {fx ? 'ON（フル液体ガラス）' : 'OFF（軽量）'}
        </button>
        <p className="mt-1 text-[11px] text-neutral-600">全端末で既定ON（モバイル/iPadも統合）。重ければOFFに。</p>
      </div>

      <div>
        <div className="mb-2 text-neutral-400">作業ログの保存件数</div>
        <div className="flex items-center gap-3">
          <input
            type="range" min={1} max={10} value={logMax}
            onChange={(e) => { const n = Number(e.target.value); setLogMax(n); vfs.setLogMax(n) }}
            className="flex-1 accent-neutral-300"
          />
          <span className="w-10 tabular-nums text-neutral-300">{logMax} 件</span>
        </div>
        <p className="mt-1 text-[11px] text-neutral-600">変更/起動の履歴を <span className="font-mono">/home/user/.log</span> に最大この件数まで。重ければ少なめに（既定3）。</p>
      </div>

      <div>
        <div className="mb-2 text-neutral-400">データ（バックアップ / アプリ移行）</div>
        <div className="flex gap-2">
          <button
            onClick={doExport}
            disabled={busy}
            className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
          >
            エクスポート
          </button>
          <button
            onClick={() => importInput.current?.click()}
            disabled={busy}
            className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
          >
            インポート
          </button>
          <input
            ref={importInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
          />
        </div>
        <p className="mt-1 text-[11px] text-neutral-600">
          倉庫(items)＋実体(blobs)＋壁紙を1ファイルに梱包。別アプリ(Tauri)や端末へ移すときはこれで運ぶ。
        </p>
      </div>

      <div className="mt-2 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-neutral-600">
        <div className="text-neutral-400">NEXUS OS</div>
        <div>Arch + Hyprland 再現（Web・ローカルのみ）</div>
        <div className="mt-1">液体ガラスの着想: <a href="https://github.com/bea4dev/ShojiWM" target="_blank" rel="noopener" className="text-neutral-400 hover:underline">ShojiWM</a> / waybar: <a href="https://github.com/JaKooLit" target="_blank" rel="noopener" className="text-neutral-400 hover:underline">JaKooLit</a></div>
        <div className="mt-1">© {new Date().getFullYear()} mirai — built with Claude Code</div>
      </div>
    </div>
  )
}
