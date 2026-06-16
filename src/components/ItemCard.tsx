import { useState } from 'react'
import type { Item } from '../db'
import { getBlobUrl } from '../db'
import { removeItem, toggleFreshness, toggleLock } from '../capture'
import {
  IconFile,
  IconFlame,
  IconImage,
  IconLink,
  IconLock,
  IconText,
  IconTrash,
  IconUnlock,
} from '../icons'

const KIND = {
  text: { icon: IconText, label: 'ノート', color: 'text-emerald-400' },
  reference: { icon: IconLink, label: 'リンク', color: 'text-sky-400' },
  media: { icon: IconImage, label: '画像', color: 'text-fuchsia-400' },
  file: { icon: IconFile, label: 'ファイル', color: 'text-amber-400' },
} as const

function timeago(t: number): string {
  const s = Math.floor((Date.now() - t) / 1000)
  if (s < 60) return 'たった今'
  if (s < 3600) return `${Math.floor(s / 60)}分前`
  if (s < 86400) return `${Math.floor(s / 3600)}時間前`
  return `${Math.floor(s / 86400)}日前`
}

function domainOf(url?: string): string {
  if (!url) return ''
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function stop(e: React.MouseEvent) {
  e.stopPropagation()
}

export function ItemCard({ item, onOpen }: { item: Item; onOpen?: (item: Item) => void }) {
  const k = KIND[item.kind]
  const KindIcon = k.icon
  const [confirmDel, setConfirmDel] = useState(false)
  const [favOk, setFavOk] = useState(true)
  const domain = domainOf(item.url)

  async function open() {
    if (onOpen) {
      onOpen(item)
      return
    }
    if (item.url) window.open(item.url, '_blank', 'noopener')
    else if (item.blobKey) {
      const url = await getBlobUrl(item.blobKey)
      if (url) window.open(url, '_blank', 'noopener')
    }
  }

  return (
    <div
      className={`group flex flex-col overflow-hidden rounded-lg border bg-neutral-800/40 transition hover:border-neutral-600 hover:bg-neutral-800/70 ${
        item.locked ? 'border-neutral-400/60' : 'border-neutral-700/60'
      }`}
    >
      <button onClick={open} className="block w-full cursor-pointer text-left">
        {item.thumb ? (
          <img src={item.thumb} alt={item.title} className="h-32 w-full object-cover" loading="lazy" />
        ) : item.kind === 'reference' ? (
          <div className="flex h-20 items-center gap-2.5 px-3">
            {favOk && domain ? (
              <img
                src={`https://icons.duckduckgo.com/ip3/${domain}.ico`}
                alt=""
                className="h-8 w-8 shrink-0 rounded"
                onError={() => setFavOk(false)}
              />
            ) : (
              <IconLink className="h-7 w-7 shrink-0 text-sky-400/70" />
            )}
            <div className="min-w-0">
              <div className="truncate text-sm text-neutral-100">{domain}</div>
              <div className="truncate text-[11px] text-neutral-500">{item.url}</div>
            </div>
          </div>
        ) : (
          <div className="px-3 py-2.5">
            <p className="line-clamp-4 text-[13px] leading-relaxed whitespace-pre-wrap text-neutral-200">
              {item.content || item.title}
            </p>
          </div>
        )}
      </button>

      <div className="mt-auto flex items-center gap-2 px-2.5 py-1.5">
        <KindIcon className={`h-3.5 w-3.5 shrink-0 ${k.color}`} />
        <span className="flex-1 truncate text-[11px] text-neutral-400">{item.title || k.label}</span>
        <span className="shrink-0 text-[10px] text-neutral-600">{timeago(item.createdAt)}</span>
      </div>

      <div className="flex items-center justify-between border-t border-neutral-800/80 px-2 py-1">
        <span className="text-[10px] text-neutral-600">
          {item.freshness === 'hot' ? 'Hot' : 'Cold'}
          {item.locked && ' · 確定'}
        </span>
        <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
          <button
            onClick={(e) => (stop(e), toggleFreshness(item))}
            title={item.freshness === 'cold' ? 'Hot(再取得対象)にする' : 'Cold(倉庫)に戻す'}
            className={`rounded p-1 hover:bg-neutral-700 ${item.freshness === 'hot' ? 'text-amber-400' : 'text-neutral-500'}`}
          >
            <IconFlame className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => (stop(e), toggleLock(item))}
            title={item.locked ? '確定を解除' : '確定(もう調べ直さない)'}
            className={`rounded p-1 hover:bg-neutral-700 ${item.locked ? 'text-neutral-100' : 'text-neutral-500'}`}
          >
            {item.locked ? <IconLock className="h-3.5 w-3.5" /> : <IconUnlock className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={(e) => (stop(e), confirmDel ? removeItem(item) : setConfirmDel(true))}
            onMouseLeave={() => setConfirmDel(false)}
            title={confirmDel ? 'もう一度で削除' : '削除'}
            className={`rounded p-1 hover:bg-neutral-700 ${confirmDel ? 'text-red-400' : 'text-neutral-500'}`}
          >
            <IconTrash className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
