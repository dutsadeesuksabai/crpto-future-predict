'use client'

import type { MTFConsensus } from '@/lib/multitimeframe'

const TF_LABELS: Record<string, string> = { '1m': '1 Min', '5m': '5 Min', '15m': '15 Min', '1h': '1 Hour' }

export function MultitimeframePanel({ mtf }: { mtf: MTFConsensus }) {
  const isUp = mtf.dominantDirection === 'up'
  const agreeColor = mtf.agreement >= 75 ? 'text-green-400' : mtf.agreement >= 50 ? 'text-yellow-400' : 'text-orange-400'

  return (
    <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-xs font-semibold">Multi-Timeframe Consensus</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${agreeColor}`}>{mtf.agreement.toFixed(0)}% agree</span>
          <span className={`text-xs font-black px-2 py-0.5 rounded-full ${isUp ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
            {isUp ? '▲ BULL' : '▼ BEAR'}
          </span>
        </div>
      </div>

      {/* Agreement bar */}
      <div className="w-full bg-red-900/30 rounded-full h-2 mb-4 overflow-hidden">
        <div
          className="h-full bg-green-600 rounded-full transition-all duration-700"
          style={{ width: `${mtf.overallBullScore}%` }}
        />
      </div>

      {/* Per-timeframe grid */}
      <div className="grid grid-cols-4 gap-2">
        {mtf.timeframes.map((t) => {
          const up = t.prediction.direction === 'up'
          const conf = t.prediction.confidence
          const confColor = conf >= 80 ? 'text-amber-400' : conf >= 65 ? 'text-green-400' : 'text-gray-400'
          return (
            <div
              key={t.tf}
              className={`rounded-xl p-2 text-center border ${up ? 'border-green-800/60 bg-green-900/10' : 'border-red-800/60 bg-red-900/10'}`}
            >
              <div className="text-gray-500 text-xs mb-1">{TF_LABELS[t.tf]}</div>
              <div className={`text-sm font-black ${up ? 'text-green-400' : 'text-red-400'}`}>{up ? '▲' : '▼'}</div>
              <div className={`text-xs font-bold ${confColor}`}>{conf.toFixed(0)}%</div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-between text-xs text-gray-600 mt-3">
        <span>Bull: {mtf.consensusUp}/4 TF</span>
        <span>Bear: {mtf.consensusDown}/4 TF</span>
        <span>Overall: {mtf.overallBullScore.toFixed(0)}%</span>
      </div>
    </div>
  )
}
