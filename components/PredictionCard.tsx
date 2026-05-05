'use client'

import type { PredictionResult } from '@/lib/predictor'

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

const TIER_STYLES: Record<Tier, {
  card: string
  border: string
  badge: string
  badgeText: string
  glow: string
  label: string
  labelColor: string
  icon: string
}> = {
  ultra: {
    card: 'bg-gradient-to-b from-purple-950/80 via-gray-900 to-gray-900',
    border: 'border-purple-500',
    badge: 'bg-gradient-to-r from-purple-600 to-pink-600',
    badgeText: 'text-white',
    glow: '0 0 32px rgba(168,85,247,0.45), 0 0 8px rgba(168,85,247,0.3)',
    label: 'ULTRA SIGNAL 🔥',
    labelColor: 'text-purple-300',
    icon: '🔥',
  },
  strong: {
    card: 'bg-gradient-to-b from-amber-950/60 via-gray-900 to-gray-900',
    border: 'border-amber-400',
    badge: 'bg-gradient-to-r from-amber-500 to-orange-500',
    badgeText: 'text-white',
    glow: '0 0 24px rgba(245,158,11,0.40), 0 0 6px rgba(245,158,11,0.25)',
    label: 'STRONG SIGNAL ⚡',
    labelColor: 'text-amber-300',
    icon: '⚡',
  },
  good: {
    card: 'bg-gradient-to-b from-emerald-950/40 via-gray-900 to-gray-900',
    border: 'border-emerald-500',
    badge: 'bg-emerald-600',
    badgeText: 'text-white',
    glow: '0 0 16px rgba(16,185,129,0.30)',
    label: 'GOOD SIGNAL ✓',
    labelColor: 'text-emerald-400',
    icon: '✓',
  },
  normal: {
    card: 'bg-gray-900',
    border: '',
    badge: 'bg-gray-700',
    badgeText: 'text-gray-300',
    glow: 'none',
    label: 'WEAK SIGNAL',
    labelColor: 'text-gray-500',
    icon: '~',
  },
}

function ConfidenceRing({ conf, isUp }: { conf: number; isUp: boolean }) {
  const r = 32
  const circ = 2 * Math.PI * r
  const pct = conf / 100
  const tier = getTier(conf)
  const strokeColor =
    tier === 'ultra' ? '#a855f7' :
    tier === 'strong' ? '#f59e0b' :
    tier === 'good' ? '#10b981' :
    isUp ? '#22c55e' : '#ef4444'

  return (
    <svg width={80} height={80} className="relative">
      {/* Track */}
      <circle cx={40} cy={40} r={r} fill="none" stroke="#1f2937" strokeWidth={5} />
      {/* Progress */}
      <circle
        cx={40} cy={40} r={r} fill="none"
        stroke={strokeColor} strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
        strokeDashoffset={circ * 0.25}
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      {/* Center text */}
      <text x={40} y={36} textAnchor="middle" fontSize={13} fontWeight="bold" fill={strokeColor}>{conf.toFixed(0)}</text>
      <text x={40} y={48} textAnchor="middle" fontSize={8} fill="#6b7280">%</text>
      {/* Direction arrow */}
      {isUp ? (
        <polygon points="40,24 35,30 45,30" fill={strokeColor} opacity={0.8} />
      ) : (
        <polygon points="40,56 35,50 45,50" fill={strokeColor} opacity={0.8} />
      )}
    </svg>
  )
}

export function PredictionCard({ timeframe, prediction, symbol, onSave, saving, saved }: Props) {
  const isUp = prediction.direction === 'up'
  const conf = prediction.confidence
  const tier = getTier(conf)
  const ts = TIER_STYLES[tier]
  const dirColor = isUp ? (tier === 'normal' ? '#22c55e' : undefined) : (tier === 'normal' ? '#ef4444' : undefined)

  // Override direction color for non-normal tiers
  const accentColor =
    tier === 'ultra' ? '#c084fc' :
    tier === 'strong' ? '#fbbf24' :
    tier === 'good' ? '#34d399' :
    isUp ? '#22c55e' : '#ef4444'

  return (
    <div
      className={`${ts.card} rounded-2xl p-5 border-2 ${ts.border || (isUp ? 'border-green-900' : 'border-red-900')} relative overflow-hidden transition-all duration-500`}
      style={{ boxShadow: ts.glow !== 'none' ? ts.glow : undefined }}
    >
      {/* Animated pulse bg for ultra/strong */}
      {(tier === 'ultra' || tier === 'strong') && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none animate-pulse"
          style={{
            background: tier === 'ultra'
              ? 'radial-gradient(ellipse at top, rgba(168,85,247,0.12) 0%, transparent 70%)'
              : 'radial-gradient(ellipse at top, rgba(245,158,11,0.10) 0%, transparent 70%)',
          }}
        />
      )}

      {/* Signal tier badge */}
      {tier !== 'normal' && (
        <div className={`absolute top-3 right-3 ${ts.badge} ${ts.badgeText} text-xs font-black px-2.5 py-1 rounded-full tracking-wide`}>
          {ts.label}
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
      <div
        className="rounded-xl py-3 px-4 mb-4 flex items-center justify-between"
        style={{
          background: isUp
            ? `linear-gradient(135deg, rgba(34,197,94,0.18) 0%, rgba(16,185,129,0.08) 100%)`
            : `linear-gradient(135deg, rgba(239,68,68,0.18) 0%, rgba(220,38,38,0.08) 100%)`,
          border: `1px solid ${accentColor}30`,
        }}
      >
        <div>
          <div className="text-xs text-gray-500 mb-0.5">Expected direction</div>
          <div className="text-xl font-black flex items-center gap-2" style={{ color: accentColor }}>
            {isUp ? '▲ BULLISH' : '▼ BEARISH'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500 mb-0.5">Confidence</div>
          <div className="font-black text-lg" style={{ color: accentColor }}>{conf.toFixed(1)}%</div>
          <div className={`text-xs font-semibold ${ts.labelColor}`}>{ts.label}</div>
        </div>
      </div>

      {/* Bull/Bear bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Bear {prediction.bearScore.toFixed(0)}%</span>
          <span>Bull {prediction.bullScore.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden relative">
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
            style={{
              width: `${prediction.bullScore}%`,
              background: prediction.bullScore >= 75
                ? `linear-gradient(90deg, #22c55e, ${accentColor})`
                : '#22c55e',
            }}
          />
          {/* Center line */}
          <div className="absolute left-1/2 top-0 w-px h-full bg-gray-600" />
        </div>
      </div>

      {/* Signals */}
      <div className="space-y-1 mb-4">
        {prediction.signals.map((s) => (
          <div key={s.name} className="flex items-center gap-2 text-xs">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.bullish ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-gray-500 w-28 truncate">{s.name}</span>
            <div className="flex-1 bg-gray-800/80 rounded-full h-1">
              <div
                className={`h-full rounded-full transition-all duration-500 ${s.bullish ? 'bg-green-500' : 'bg-red-500'}`}
                style={{ width: `${Math.max(5, Math.min(100, s.value))}%`, opacity: 0.8 }}
              />
            </div>
            <span className={`text-right flex-shrink-0 ${s.bullish ? 'text-green-400' : 'text-red-400'} font-medium`}
              style={{ width: 60, fontSize: 10 }}>
              {s.interpretation.length > 9 ? s.interpretation.slice(0, 9) + '…' : s.interpretation}
            </span>
          </div>
        ))}
      </div>

      {/* Save button */}
      <button
        onClick={onSave}
        disabled={saving || saved}
        className={`w-full py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
          saved
            ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
            : saving
              ? 'bg-gray-800 text-gray-500 cursor-wait'
              : 'text-white cursor-pointer hover:opacity-90 active:scale-95'
        }`}
        style={!saved && !saving ? {
          background: `linear-gradient(90deg, #2563eb, ${accentColor}60)`,
          border: `1px solid ${accentColor}40`,
        } : {}}
      >
        {saved ? '✓ Saved to Supabase' : saving ? 'Saving...' : 'Save Prediction'}
      </button>
    </div>
  )
}
