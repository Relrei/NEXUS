import { useRef } from 'react'

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
        <div className="mb-2 text-neutral-400">液体ガラス（フル）</div>
        <button
          onClick={() => onToggleFx(!fx)}
          className={`flex items-center gap-2 rounded border px-3 py-1.5 text-xs ${fx ? 'border-white/30 bg-white/15 text-white' : 'border-neutral-700 text-neutral-300'}`}
        >
          <span className={`inline-block h-3 w-3 rounded-full ${fx ? 'bg-emerald-400' : 'bg-neutral-600'}`} />
          {fx ? 'フル（強いblur・PC向け）' : '軽量（モバイル/iPad向け）'}
        </button>
        <p className="mt-1 text-[11px] text-neutral-600">既定はPCのみフル。重ければ軽量に。</p>
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
