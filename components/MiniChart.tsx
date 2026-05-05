'use client'

import { useMemo } from 'react'
import type { Kline } from '@/lib/mexc'

interface Props {
  klines: Kline[]
  height?: number
}

export function MiniChart({ klines, height = 120 }: Props) {
  const { path, greenPath, redPath, min, max } = useMemo(() => {
    if (!klines || klines.length < 2) return { path: '', greenPath: '', redPath: '', min: 0, max: 0 }

    const closes = klines.map((k) => k.close)
    const mins = klines.map((k) => k.low)
    const maxs = klines.map((k) => k.high)
    const minV = Math.min(...mins)
    const maxV = Math.max(...maxs)
    const range = maxV - minV || 1

    const w = 600
    const h = height - 10
    const xStep = w / (klines.length - 1)

    const toX = (i: number) => i * xStep
    const toY = (v: number) => h - ((v - minV) / range) * h + 5

    // Main line path
    const pts = closes.map((c, i) => `${toX(i)},${toY(c)}`).join(' L ')
    const linePath = `M ${pts}`

    // Candles: separate up/down
    const upParts: string[] = []
    const downParts: string[] = []
    klines.forEach((k, i) => {
      const x = toX(i)
      const isUp = k.close >= k.open
      const top = toY(Math.max(k.open, k.close))
      const bottom = toY(Math.min(k.open, k.close))
      const high = toY(k.high)
      const low = toY(k.low)
      const part = `M ${x},${high} L ${x},${low} M ${x - 2},${top} L ${x + 2},${top} L ${x + 2},${bottom} L ${x - 2},${bottom} Z `
      if (isUp) upParts.push(part)
      else downParts.push(part)
    })

    return {
      path: linePath,
      greenPath: upParts.join(''),
      redPath: downParts.join(''),
      min: minV,
      max: maxV,
    }
  }, [klines, height])

  if (!klines || klines.length < 2) {
    return <div className="bg-gray-800/30 rounded-xl animate-pulse" style={{ height }} />
  }

  const last = klines[klines.length - 1]
  const first = klines[0]
  const isUp = last.close >= first.close

  return (
    <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
      <div className="flex justify-between items-center mb-2">
        <span className="text-gray-400 text-xs">Price Chart (last 100 candles)</span>
        <div className="flex gap-3 text-xs">
          <span className="text-gray-600">H: {max.toFixed(2)}</span>
          <span className="text-gray-600">L: {min.toFixed(2)}</span>
        </div>
      </div>
      <svg viewBox={`0 0 600 ${height}`} className="w-full" style={{ height }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((p) => (
          <line
            key={p}
            x1={0} x2={600}
            y1={height * p} y2={height * p}
            stroke="#374151" strokeWidth={0.5}
          />
        ))}
        {/* Candles */}
        <path d={greenPath} stroke="#22c55e" strokeWidth={1.5} fill="none" />
        <path d={redPath} stroke="#ef4444" strokeWidth={1.5} fill="none" />
        {/* Price line */}
        <path d={path} stroke={isUp ? '#22c55e' : '#ef4444'} strokeWidth={1.5} fill="none" opacity={0.6} />
      </svg>
    </div>
  )
}
