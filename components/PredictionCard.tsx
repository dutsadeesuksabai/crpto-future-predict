'use client'

import type { PredictionResult } from '@/lib/predictor'
import { getStrategy } from '@/lib/strategies'

interface Props {
  timeframe: '10m' | '30m'
  prediction: PredictionResult
  symbol: string
  currentPrice: number
  onSave?: () => void
  saving?: boolean
  saved?: boolean
}

type Tier = 'ultra' | 'strong' | 'good' | 'normal'

function getTier(conf: number): Tier {
  if (conf >= 90) return 'ultra'
  if (conf >= 80) return 'strong'
  if (conf >= 75) return 'good'
  return 'normal'
}

const TIER_META: Record<Tier, {
  labelUp: string
  labelDown: string
  labelColor: string
  glowAlpha: number
  bgUp: string
  bgDown: string
}> = {
  ultra: {
    labelUp: 'ULTRA ขึ้น 🔥', labelDown: 'ULTRA ลง 🔥',
    labelColor: 'text-white', glowAlpha: 0.55,
    bgUp:   'bg-gradient-to-b from-green-950/70 via-gray-900 to-gray-900',
    bgDown: 'bg-gradient-to-b from-red-950/70 via-gray-900 to-gray-900',
  },
  strong: {
    labelUp: 'STRONG ขึ้น ⚡', labelDown: 'STRONG ลง ⚡',
    labelColor: 'text-white', glowAlpha: 0.40,
    bgUp:   'bg-gradient-to-b from-green-950/50 via-gray-900 to-gray-900',
    bgDown: 'bg-gradient-to-b from-red-950/50 via-gray-900 to-gray-900',
  },
  good: {
    labelUp: 'GOOD ขึ้น ✓', labelDown: 'GOOD ลง ✓',
    labelColor: 'text-white', glowAlpha: 0.25,
    bgUp:   'bg-gradient-to-b from-green-950/30 via-gray-900 to-gray-900',
    bgDown: 'bg-gradient-to-b from-red-950/30 via-gray-900 to-gray-900',
  },
  normal: {
    labelUp: 'SIGNAL', labelDown: 'SIGNAL',
    labelColor: 'text-gray-400', glowAlpha: 0,
    bgUp: 'bg-gray-900', bgDown: 'bg-gray-900',
  },
}

/** Signal quality → color + label */
function qualityMeta(q: number) {
  if (q >= 80) return { color: '#a855f7', label: 'Pure', bar: 'bg-purple-500' }
  if (q >= 65) return { color: '#22c55e', label: 'Clean', bar: 'bg-green-500' }
  if (q >= 50) return { color: '#f59e0b', label: 'Mixed', bar: 'bg-amber-500' }
  return { color: '#6b7280', label: 'Noisy', bar: 'bg-gray-500' }
}

function ConfidenceRing({ conf, isUp }: { conf: number; isUp: boolean }) {
  const r = 32
  const circ = 2 * Math.PI * r
  const pct = conf / 100
  const strokeColor = isUp ? '#22c55e' : '#ef4444'
  return (
    <svg width={80} height={80} className="relative">
      <circle cx={40} cy={40} r={r} fill="none" stroke="#1f2937" strokeWidth={5} />
      <circle cx={40} cy={40} r={r} fill="none" stroke={strokeColor} strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
        strokeDashoffset={circ * 0.25}
        style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      <text x={40} y={36} textAnchor="middle" fontSize={13} fontWeight="bold" fill={strokeColor}>{conf.toFixed(0)}</text>
      <text x={40} y={48} textAnchor="middle" fontSize={8} fill="#6b7280">%</text>
      {isUp
        ? <polygon points="40,24 35,30 45,30" fill={strokeColor} opacity={0.8} />
        : <polygon points="40,56 35,50 45,50" fill={strokeColor} opacity={0.8} />}
    </svg>
  )
}

export function PredictionCard({ timeframe, prediction, symbol, onSave, saving, saved }: Props) {
  const isUp    = prediction.direction === 'up'
  const conf    = prediction.confidence
  const tier    = getTier(conf)
  const tm      = TIER_META[tier]
  const quality = qualityMeta(prediction.signalQuality ?? 50)
  const strat   = getStrategy(prediction.strategyId ?? 'balanced')

  const borderColor = isUp ? '#22c55e' : '#ef4444'
  const glowColor   = isUp ? `rgba(34,197,94,${tm.glowAlpha})` : `rgba(239,68,68,${tm.glowAlpha})`
  const boxShadow   = tm.glowAlpha > 0
    ? `0 0 20px ${glowColor}, 0 0 40px ${glowColor.replace(String(tm.glowAlpha), String(tm.glowAlpha * 0.4))}, inset 0 0 0 2px ${borderColor}`
    : `inset 0 0 0 2px ${borderColor}`

  const badgeBg   = isUp ? 'bg-green-600' : 'bg-red-600'
  const accentColor = isUp ? '#22c55e' : '#ef4444'
  const badgeLabel = isUp ? tm.labelUp : tm.labelDown
  const cardBg     = isUp ? tm.bgUp : tm.bgDown

  // Filter dots data
  const filters = prediction.filters ?? {}
  const filterList = [
    { key: 'trendStrong',      icon: '📈', label: 'Trend' },
    { key: 'volumeConfirmed',  icon: '📊', label: 'Volume' },
    { key: 'consensusClean',   icon: '🎯', label: 'Consensus' },
    { key: 'noStrongConflict', icon: '🚫', label: 'No conflict' },
    { key: 'candleAligned',    icon: '🕯', label: 'Candles' },
    { key: 'noDivergence',     icon: '↗', label: 'No div.' },
  ] as const

  return (
    <div className={`${cardBg} rounded-2xl p-5 relative overflow-hidden transition-all duration-500`}
      style={{ boxShadow }}>

      {/* Animated pulse bg for ultra/strong */}
      {(tier === 'ultra' || tier === 'strong') && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none animate-pulse" style={{
          background: isUp
            ? `radial-gradient(ellipse at top, rgba(34,197,94,${tier === 'ultra' ? 0.12 : 0.08}) 0%, transparent 70%)`
            : `radial-gradient(ellipse at top, rgba(239,68,68,${tier === 'ultra' ? 0.12 : 0.08}) 0%, transparent 70%)`,
        }} />
      )}

      {/* Signal tier badge */}
      {tier !== 'normal' && (
        <div className={`absolute top-3 right-3 ${badgeBg} text-white text-xs font-black px-2.5 py-1 rounded-full tracking-wide`}>
          {badgeLabel}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-gray-500 text-xs mb-0.5">Prediction · {timeframe}</div>
          <div className="text-white font-bold text-base">{symbol.replace('USDT', '')}/USDT</div>
        </div>
        <ConfidenceRing conf={conf} isUp={isUp} />
      </div>

      {/* Direction banner */}
      <div className="rounded-xl py-3 px-4 mb-3 flex items-center justify-between" style={{
        background: isUp
          ? `linear-gradient(135deg, rgba(34,197,94,0.18) 0%, rgba(16,185,129,0.08) 100%)`
          : `linear-gradient(135deg, rgba(239,68,68,0.18) 0%, rgba(220,38,38,0.08) 100%)`,
        border: `1px solid ${accentColor}30`,
      }}>
        <div>
          <div className="text-xs text-gray-500 mb-0.5">ทิศทาง</div>
          <div className="text-xl font-black" style={{ color: accentColor }}>
            {isUp ? '▲ ขึ้น' : '▼ ลง'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500 mb-0.5">Confidence</div>
          <div className="font-black text-lg" style={{ color: accentColor }}>{conf.toFixed(1)}%</div>
          <div className={`text-xs font-semibold ${tm.labelColor}`}>{badgeLabel}</div>
        </div>
      </div>

      {/* Signal Quality Bar */}
      <div className="mb-3 bg-gray-800/60 rounded-xl px-3 py-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500 font-medium">Signal Quality</span>
          <span className="text-xs font-bold" style={{ color: quality.color }}>
            {quality.label} {prediction.signalQuality ?? 0}/100
          </span>
        </div>
        {/* Quality bar */}
        <div className="w-full bg-gray-700 rounded-full h-1.5 mb-2">
          <div className={`h-full rounded-full transition-all duration-700 ${quality.bar}`}
            style={{ width: `${prediction.signalQuality ?? 0}%` }} />
        </div>
        {/* Filter dots */}
        <div className="flex items-center gap-1 flex-wrap">
          {filterList.map(({ key, icon, label }) => {
            const passed = filters[key as keyof typeof filters] ?? false
            return (
              <span key={key} title={label}
                className={`text-xs px-1.5 py-0.5 rounded-md border transition-colors ${
                  passed
                    ? 'bg-green-900/40 border-green-800 text-green-400'
                    : 'bg-gray-800 border-gray-700 text-gray-600'
                }`}>
                {icon}
              </span>
            )
          })}
          <span className="ml-auto text-xs text-gray-600">
            ADX {prediction.adxStrength ?? 0} · {Math.round((prediction.consensusRatio ?? 0.5) * 100)}% agree
          </span>
        </div>
      </div>

      {/* Bull/Bear bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Bear {prediction.bearScore.toFixed(0)}%</span>
          <span>Bull {prediction.bullScore.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden relative">
          <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
            style={{ width: `${prediction.bullScore}%`, background: '#22c55e' }} />
          <div className="absolute left-1/2 top-0 w-px h-full bg-gray-600" />
        </div>
      </div>

      {/* Signals list */}
      <div className="space-y-1 mb-4">
        {prediction.signals.map((s) => (
          <div key={s.name} className="flex items-center gap-2 text-xs">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.bullish ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-gray-500 w-28 truncate">{s.name}</span>
            <div className="flex-1 bg-gray-800/80 rounded-full h-1">
              <div
                className={`h-full rounded-full transition-all duration-500 ${s.bullish ? 'bg-green-500' : 'bg-red-500'}`}
                style={{ width: `${Math.max(5, Math.min(100, Math.abs(s.score - 50) * 2))}%`, opacity: 0.8 }}
              />
            </div>
            <span className={`text-right flex-shrink-0 ${s.bullish ? 'text-green-400' : 'text-red-400'} font-medium`}
              style={{ width: 60, fontSize: 10 }}>
              {s.interpretation.length > 9 ? s.interpretation.slice(0, 9) + '…' : s.interpretation}
            </span>
          </div>
        ))}
      </div>

      {/* Strategy tag */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-600">สูตร:</span>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: `${strat.accentColor}22`, color: strat.accentColor }}>
          {strat.emoji} {strat.name}
        </span>
      </div>

      {/* Save button */}
      <button onClick={onSave} disabled={saving || saved}
        className={`w-full py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
          saved ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
               : saving ? 'bg-gray-800 text-gray-500 cursor-wait'
               : 'text-white cursor-pointer hover:opacity-90 active:scale-95'
        }`}
        style={!saved && !saving ? {
          background: isUp ? `linear-gradient(90deg, #166534, #22c55e60)` : `linear-gradient(90deg, #7f1d1d, #ef444460)`,
          border: `1px solid ${accentColor}40`,
        } : {}}>
        {saved ? '✓ Saved to Supabase' : saving ? 'Saving...' : 'Save Prediction'}
      </button>
    </div>
  )
}
