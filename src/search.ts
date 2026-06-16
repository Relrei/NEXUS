import type { Item } from './db'

function norm(s: string): string {
  return (s || '').normalize('NFKC').toLowerCase()
}

function haystack(it: Item): string {
  return norm([it.title, it.content, it.url ?? '', it.tags.join(' '), it.fileName ?? ''].join('\n'))
}

// 日本語は語境界が無いので substring 一致(漢字1字でも拾う)。
// 空白区切りの全タームを含むものだけを残し、見出し一致を優先して並べる。
export function searchItems(items: Item[], query: string): Item[] {
  const q = norm(query).trim()
  if (!q) return [...items].sort((a, b) => b.updatedAt - a.updatedAt)
  const terms = q.split(/\s+/).filter(Boolean)
  const scored: { it: Item; score: number }[] = []
  for (const it of items) {
    const hay = haystack(it)
    const title = norm(it.title)
    let ok = true
    let score = 0
    for (const term of terms) {
      if (!hay.includes(term)) {
        ok = false
        break
      }
      if (title.includes(term)) score += 10
      score += 1
    }
    if (ok) scored.push({ it, score })
  }
  scored.sort((a, b) => b.score - a.score || b.it.updatedAt - a.it.updatedAt)
  return scored.map((s) => s.it)
}
