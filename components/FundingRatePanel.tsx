'use client'

import type { FundingData } from '@/lib/funding'

const SIGNAL_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  strongly_bullish: { color: 'text-green-400', bg: 'bg-green-900/40', label: 'Shorts overcrowded → Bullish' },
  bullish:          { color: 'text-green-400', bg: 'bg-green-900/20', label: 'Slight short bias → Bullish' },
  neutral:          { color: 'text-gray-400',  bg: 'bg-gray-800/40',  label: 'Balanced funding' },
  bearish:          { color: 'text-red-400',   bg: 'bg-red-900/20',   label: 'Slight long bias → Bearish' },
  strongly_bearish: { color: 'text-red-400',   bg: 'bg-red-900/40',   label: 'Longs overcrowded → Bearish' },
}

export function FundingRatePanel({ fr }: { fr: FundingData }) {
  const s = SIGNAL_STYLES[fr.signal]
  const pct = fr.fundingRatePct
  const isPos = pct >= 0
  const nextTime = fr.nextFundingTime ? new Date(fr.nextFundingTime).toLocaleTimeString() : '—'

  // Bar: -0.2% to +0.2% range
  const barPct = Math.max(0, Math.min(100, 50 + (pct / 0.2) * 50))

  return (
    <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-xs font-semibold">Funding Rate (Futures)</span>
        <span className={`text-xs font-bold ${s.color}`}>
          {isPos ? '+' : ''}{pct.toFixed(4)}%
        </span>
      </div>

      {/* Sentiment bar */}
      <div className="relative mb-3">
        <div className="w-full bg-gray-800 rounded-full h-2.5">
          <div
            className={`absolute top-0 h-full rounded-full transition-all duration-500 ${isPos ? 'bg-red-500' : 'bg-green-500'}`}
            style={isPos
              ? { left: '50%', width: `${barPct - 50}%` }
              : { left: `${barPct}%`, width: `${50 - barPct}%` }
            }
          />
          <div className="absolute top-0 left-1/2 w-px h-full bg-gray-600" />
        </div>
        <div className="flex justify-between text-xs text-gray-600 mt-1">
          <span>Shorts pay (bullish)</span>
          <span>Longs pay (bearish)</span>
        </div>
      </div>

      <div className={`text-xs ${s.color} ${s.bg} rounded-lg px-3 py-1.5 mb-2`}>{s.label}</div>

      <div className="flex justify-between text-xs text-gray-600">
        <span>Next funding: <span className="text-gray-400">{nextTime}</span></span>
        <span>Signal score: <span className="text-gray-400">{fr.score}/100</span></span>
      </div>
    </div>
  )
}
