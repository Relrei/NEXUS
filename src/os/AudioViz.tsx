import { useEffect, useRef, useState } from 'react'

// 本物の波形ビジュアライザ。マイクの音を拾った時だけ動く(無音なら平ら)。
// クリックで有効化(getUserMediaの許可)。許可しなければ静かに平らのまま。
const N = 11

export function AudioViz() {
  const [on, setOn] = useState(false)
  const [bars, setBars] = useState<number[]>(() => Array(N).fill(0.05))
  const raf = useRef(0)
  const ctxRef = useRef<AudioContext | null>(null)
  const anaRef = useRef<AnalyserNode | null>(null)

  async function enable() {
    if (on) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new AudioContext()
      const src = ctx.createMediaStreamSource(stream)
      const ana = ctx.createAnalyser()
      ana.fftSize = 64
      ana.smoothingTimeConstant = 0.75
      src.connect(ana)
      ctxRef.current = ctx
      anaRef.current = ana
      setOn(true)
    } catch {
      /* 許可されない/マイク無し → 平らのまま */
    }
  }

  useEffect(() => {
    if (!on) return
    const ana = anaRef.current!
    const buf = new Uint8Array(ana.frequencyBinCount)
    const loop = () => {
      ana.getByteFrequencyData(buf)
      const step = Math.floor(buf.length / N)
      const next: number[] = []
      for (let i = 0; i < N; i++) {
        const v = buf[i * step] / 255
        next.push(Math.max(0.04, v))
      }
      setBars(next)
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf.current)
  }, [on])

  useEffect(() => {
    return () => {
      ctxRef.current?.close()
    }
  }, [])

  return (
    <button
      onClick={enable}
      title={on ? '音声入力に反応中' : 'クリックでマイク波形を有効化'}
      className="flex h-3.5 items-end gap-[2px]"
    >
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[2px] rounded-full bg-neutral-200/80 transition-[height] duration-75"
          style={{ height: `${Math.max(8, h * 100)}%`, opacity: on ? 1 : 0.4 }}
        />
      ))}
    </button>
  )
}
