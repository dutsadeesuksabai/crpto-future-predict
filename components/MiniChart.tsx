'use client'

import { useMemo } from 'react'
import type { Kline } from '@/lib/mexc'
import type { IndicatorSet } from '@/lib/indicators'
import type { PredictionResult } from '@/lib/predictor'

interface Props {
  klines: Kline[]
  height?: number
  indicators?: IndicatorSet
  prediction10m?: PredictionResult
  prediction30m?: PredictionResult
}

function emaLine(values: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const out: number[] = [values[0]]
  for (let i = 1; i < values.length; i++) out.push(values[i] * k + out[i - 1] * (1 - k))
  return out
}

function bbLines(closes: number[], period = 20, std = 2): { upper: number[]; lower: number[] } {
  const upper: number[] = []
  const lower: number[] = []
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { upper.push(closes[i]); lower.push(closes[i]); continue }
    const slice = closes.slice(i - period + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b) / period
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period
    const sd = Math.sqrt(variance)
    upper.push(mean + std * sd)
    lower.push(mean - std * sd)
  }
  return { upper, lower }
}

function rsiHistory(closes: number[], period = 14): number[] {
  const rsi: number[] = new Array(period).fill(50)
  const changes = closes.slice(1).map((c, i) => c - closes[i])
  const gains = changes.map((c) => (c > 0 ? c : 0))
  const losses = changes.map((c) => (c < 0 ? -c : 0))
  let avgG = gains.slice(0, period).reduce((a, b) => a + b) / period
  let avgL = losses.slice(0, period).reduce((a, b) => a + b) / period
  rsi.push(avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL))
  for (let i = period; i < changes.length; i++) {
    avgG = (avgG * (period - 1) + gains[i]) / period
    avgL = (avgL * (period - 1) + losses[i]) / period
    rsi.push(avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL))
  }
  return rsi
}

export function MiniChart({ klines, height = 160, indicators, prediction10m, prediction30m }: Props) {
  const chartData = useMemo(() => {
    if (!klines || klines.length < 2) return null
    const closes = klines.map((k) => k.close)
    const minV = Math.min(...klines.map((k) => k.low))
    const maxV = Math.max(...klines.map((k) => k.high))
    const range = maxV - minV || 1
    const W = 600
    const H = height - 10
    const xStep = W / (klines.length - 1)
    const toX = (i: number) => i * xStep
    const toY = (v: number) => H - ((v - minV) / range) * H + 5

    // Candle paths
    const upParts: string[] = [], downParts: string[] = []
    klines.forEach((k, i) => {
      const x = toX(i)
      const isUp = k.close >= k.open
      const top = toY(Math.max(k.open, k.close))
      const bot = toY(Math.min(k.open, k.close))
      const hi = toY(k.high), lo = toY(k.low)
      const p = `M${x},${hi}L${x},${lo}M${x-2},${top}L${x+2},${top}L${x+2},${bot}L${x-2},${bot}Z`
      isUp ? upParts.push(p) : downParts.push(p)
    })

    // EMA lines
    const ema9 = emaLine(closes, 9)
    const ema21 = emaLine(closes, 21)
    const ema9Path = ema9.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(v)}`).join('')
    const ema21Path = ema21.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(v)}`).join('')

    // Bollinger Bands
    const { upper, lower } = bbLines(closes)
    const bbUpperPath = upper.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(v)}`).join('')
    const bbLowerPath = lower.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(v)}`).join('')

    // Signal markers: find RSI oversold/overbought crossings
    const rsi = rsiHistory(closes)
    const signals: { x: number; y: number; type: 'buy' | 'sell' | 'warn' }[] = []
    for (let i = 1; i < klines.length; i++) {
      const r = rsi[i], rPrev = rsi[i - 1]
      if (rPrev >= 30 && r < 30) signals.push({ x: toX(i), y: toY(klines[i].low) + 12, type: 'buy' })
      if (rPrev <= 70 && r > 70) signals.push({ x: toX(i), y: toY(klines[i].high) - 12, type: 'sell' })
    }

    // MACD cross signals (last 20 candles only to avoid clutter)
    const macd12 = emaLine(closes, 12)
    const macd26 = emaLine(closes, 26)
    const macdLine = macd12.map((v, i) => v - macd26[i])
    const signal9 = emaLine(macdLine, 9)
    for (let i = Math.max(1, klines.length - 25); i < klines.length; i++) {
      const cross = macdLine[i - 1] < signal9[i - 1] && macdLine[i] > signal9[i]
      const dead  = macdLine[i - 1] > signal9[i - 1] && macdLine[i] < signal9[i]
      if (cross) signals.push({ x: toX(i), y: toY(klines[i].low) + 20, type: 'buy' })
      if (dead)  signals.push({ x: toX(i), y: toY(klines[i].high) - 20, type: 'sell' })
    }

    // BB squeeze touch (last 20)
    for (let i = Math.max(1, klines.length - 25); i < klines.length; i++) {
      if (closes[i] <= lower[i] * 1.001) signals.push({ x: toX(i), y: toY(klines[i].low) + 16, type: 'buy' })
      if (closes[i] >= upper[i] * 0.999) signals.push({ x: toX(i), y: toY(klines[i].high) - 16, type: 'sell' })
    }

    // Last price line (horizontal dashed)
    const lastPrice = closes[closes.length - 1]
    const lastY = toY(lastPrice)
    const lastX = toX(klines.length - 1)

    return {
      upPath: upParts.join(''), downPath: downParts.join(''),
      ema9Path, ema21Path, bbUpperPath, bbLowerPath,
      signals, lastY, lastX, lastPrice,
      minV, maxV, toX, toY, W, H,
    }
  }, [klines, height])

  if (!chartData) return <div className="bg-gray-800/30 rounded-2xl animate-pulse" style={{ height: height + 60 }} />

  const { upPath, downPath, ema9Path, ema21Path, bbUpperPath, bbLowerPath, signals, lastY, lastX, lastPrice, minV, maxV } = chartData

  const isUp10 = prediction10m?.direction === 'up'
  const conf10 = prediction10m?.confidence ?? 0
  const isUp30 = prediction30m?.direction === 'up'
  const conf30 = prediction30m?.confidence ?? 0

  const signalColor10 = conf10 >= 90 ? '#a855f7' : conf10 >= 80 ? '#f59e0b' : conf10 >= 75 ? '#22c55e' : '#6b7280'
  const signalColor30 = conf30 >= 90 ? '#a855f7' : conf30 >= 80 ? '#f59e0b' : conf30 >= 75 ? '#22c55e' : '#6b7280'

  return (
    <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-gray-400 text-xs font-medium">Price Chart · EMA 9/21 · Bollinger Bands · Signals</span>
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-400 inline-block rounded" />EMA9</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-400 inline-block rounded" />EMA21</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-500/60 inline-block rounded border-dashed" />BB</span>
        </div>
      </div>

      {/* Prediction badges */}
      {(prediction10m || prediction30m) && (
        <div className="flex gap-2 mb-3">
          {prediction10m && (
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
              style={{
                background: conf10 >= 90 ? 'rgba(168,85,247,0.2)' : conf10 >= 80 ? 'rgba(245,158,11,0.2)' : conf10 >= 75 ? 'rgba(34,197,94,0.15)' : 'rgba(75,85,99,0.2)',
                borderColor: signalColor10,
                color: signalColor10,
              }}
            >
              <span style={{ fontSize: 14 }}>{isUp10 ? '▲' : '▼'}</span>
              10m · {conf10.toFixed(0)}%
              {conf10 >= 90 && <span className="ml-1 animate-pulse">🔥</span>}
              {conf10 >= 80 && conf10 < 90 && <span className="ml-1">⚡</span>}
            </div>
          )}
          {prediction30m && (
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
              style={{
                background: conf30 >= 90 ? 'rgba(168,85,247,0.2)' : conf30 >= 80 ? 'rgba(245,158,11,0.2)' : conf30 >= 75 ? 'rgba(34,197,94,0.15)' : 'rgba(75,85,99,0.2)',
                borderColor: signalColor30,
                color: signalColor30,
              }}
            >
              <span style={{ fontSize: 14 }}>{isUp30 ? '▲' : '▼'}</span>
              30m · {conf30.toFixed(0)}%
              {conf30 >= 90 && <span className="ml-1 animate-pulse">🔥</span>}
              {conf30 >= 80 && conf30 < 90 && <span className="ml-1">⚡</span>}
            </div>
          )}
          {indicators && (
            <div className="ml-auto flex items-center gap-3 text-xs text-gray-600">
              <span>RSI <span className={indicators.rsi > 70 ? 'text-red-400' : indicators.rsi < 30 ? 'text-green-400' : 'text-gray-400'}>{indicators.rsi.toFixed(0)}</span></span>
              <span>MACD <span className={indicators.macdHistogram > 0 ? 'text-green-400' : 'text-red-400'}>{indicators.macdHistogram > 0 ? '+' : ''}{indicators.macdHistogram.toFixed(2)}</span></span>
            </div>
          )}
        </div>
      )}

      {/* SVG Chart */}
      <svg viewBox={`0 0 600 ${height}`} className="w-full" style={{ height }}>
        <defs>
          <linearGradient id="bbFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {[0.2, 0.4, 0.6, 0.8].map((p) => (
          <line key={p} x1={0} x2={600} y1={height * p} y2={height * p} stroke="#1f2937" strokeWidth={0.8} />
        ))}

        {/* BB fill */}
        <path d={`${bbUpperPath}L600,${height}L0,${height}Z`} fill="url(#bbFill)" />

        {/* Bollinger Bands */}
        <path d={bbUpperPath} stroke="#7c3aed" strokeWidth={0.8} fill="none" strokeDasharray="3,3" opacity={0.7} />
        <path d={bbLowerPath} stroke="#7c3aed" strokeWidth={0.8} fill="none" strokeDasharray="3,3" opacity={0.7} />

        {/* EMA lines */}
        <path d={ema21Path} stroke="#60a5fa" strokeWidth={1.2} fill="none" opacity={0.8} />
        <path d={ema9Path}  stroke="#fbbf24" strokeWidth={1.2} fill="none" opacity={0.9} />

        {/* Candles */}
        <path d={upPath}   stroke="#22c55e" strokeWidth={1.5} fill="none" />
        <path d={downPath} stroke="#ef4444" strokeWidth={1.5} fill="none" />

        {/* Last price dashed line */}
        <line x1={0} x2={lastX} y1={lastY} y2={lastY} stroke="#6b7280" strokeWidth={0.7} strokeDasharray="4,4" opacity={0.5} />
        <rect x={lastX + 2} y={lastY - 8} width={72} height={16} rx={3} fill="#1f2937" />
        <text x={lastX + 6} y={lastY + 4} fontSize={9} fill="#9ca3af">${lastPrice.toLocaleString('en', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</text>

        {/* Signal markers */}
        {signals.map((s, i) => (
          <g key={i}>
            {s.type === 'buy' ? (
              <>
                <polygon
                  points={`${s.x},${s.y - 8} ${s.x - 5},${s.y} ${s.x + 5},${s.y}`}
                  fill="#22c55e" opacity={0.9}
                />
                <circle cx={s.x} cy={s.y - 10} r={3} fill="#22c55e" opacity={0.4} />
              </>
            ) : (
              <>
                <polygon
                  points={`${s.x},${s.y + 8} ${s.x - 5},${s.y} ${s.x + 5},${s.y}`}
                  fill="#ef4444" opacity={0.9}
                />
                <circle cx={s.x} cy={s.y + 10} r={3} fill="#ef4444" opacity={0.4} />
              </>
            )}
          </g>
        ))}

        {/* Direction arrow at latest candle */}
        {prediction10m && (() => {
          const ax = lastX, ay = lastY
          const up = isUp10
          const arrowY = up ? ay - 18 : ay + 18
          const arrowColor = conf10 >= 90 ? '#a855f7' : conf10 >= 80 ? '#f59e0b' : '#22c55e'
          const opacity = conf10 >= 75 ? 1 : 0.5
          return (
            <g opacity={opacity}>
              {up ? (
                <polygon points={`${ax},${arrowY} ${ax - 7},${arrowY + 12} ${ax + 7},${arrowY + 12}`}
                  fill={arrowColor} />
              ) : (
                <polygon points={`${ax},${arrowY} ${ax - 7},${arrowY - 12} ${ax + 7},${arrowY - 12}`}
                  fill={arrowColor} />
              )}
              <circle cx={ax} cy={up ? arrowY - 6 : arrowY + 6} r={conf10 >= 90 ? 5 : 3} fill={arrowColor} opacity={0.3} />
            </g>
          )
        })()}

        {/* H/L labels */}
        <text x={4} y={12} fontSize={8} fill="#4b5563">H: {maxV.toLocaleString('en', { maximumFractionDigits: 1 })}</text>
        <text x={4} y={height - 3} fontSize={8} fill="#4b5563">L: {minV.toLocaleString('en', { maximumFractionDigits: 1 })}</text>
      </svg>

      {/* Signal legend */}
      <div className="flex gap-3 mt-2 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span className="inline-block w-0 h-0 border-l-[5px] border-r-[5px] border-b-[8px] border-l-transparent border-r-transparent border-b-green-500" />
          Buy signal
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-0 h-0 border-l-[5px] border-r-[5px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-500" />
          Sell signal
        </span>
        <span className="ml-auto text-gray-700">{signals.length} signals on chart</span>
      </div>
    </div>
  )
}
