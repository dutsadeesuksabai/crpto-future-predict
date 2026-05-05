'use client'

import type { FearGreedData } from '@/lib/feargreed'

const COLOR_MAP: Record<string, { arc: string; text: string; bg: string }> = {
  'Extreme Fear': { arc: '#22c55e', text: 'text-green-400', bg: 'bg-green-900/30' },
  'Fear':         { arc: '#86efac', text: 'text-green-300', bg: 'bg-green-900/20' },
  'Neutral':      { arc: '#fbbf24', text: 'text-yellow-400', bg: 'bg-yellow-900/20' },
  'Greed':        { arc: '#f97316', text: 'text-orange-400', bg: 'bg-orange-900/20' },
  'Extreme Greed':{ arc: '#ef4444', text: 'text-red-400', bg: 'bg-red-900/30' },
}

export function FearGreedWidget({ fg }: { fg: FearGreedData }) {
  const c = COLOR_MAP[fg.classification] ?? COLOR_MAP['Neutral']
  const v = fg.value
  // Arc gauge: semi-circle, 0=fear left, 100=greed right
  const r = 36
  const circ = Math.PI * r   // semi-circle
  const pct = v / 100
  const strokeDash = `${circ * pct} ${circ * (1 - pct)}`

  return (
    <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex flex-col items-center">
      <div className="text-gray-400 text-xs font-semibold mb-3 w-full">Fear & Greed Index</div>

      {/* Semi-circle gauge */}
      <svg width={100} height={56} viewBox="-5 -5 110 60">
        {/* Track */}
        <path d="M 5,50 A 45,45 0 0 1 95,50" fill="none" stroke="#1f2937" strokeWidth={8} strokeLinecap="round" />
        {/* Progress */}
        <path
          d="M 5,50 A 45,45 0 0 1 95,50"
          fill="none"
          stroke={c.arc}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${pct * 141.4} 141.4`}
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        {/* Value */}
        <text x={50} y={44} textAnchor="middle" fontSize={18} fontWeight="bold" fill={c.arc}>{v}</text>
      </svg>

      <div className={`text-xs font-bold mt-1 px-3 py-1 rounded-full ${c.bg} ${c.text}`}>
        {fg.classification}
      </div>

      <div className="flex justify-between w-full mt-2 text-xs text-gray-600">
        <span>Fear (buy)</span>
        <span>Greed (sell)</span>
      </div>

      <div className={`text-xs ${c.text} mt-2 text-center`}>
        {fg.signal.includes('bullish') ? '→ Contrarian: Buy zone' :
         fg.signal.includes('bearish') ? '→ Contrarian: Caution' : '→ Neutral macro'}
      </div>
    </div>
  )
}
