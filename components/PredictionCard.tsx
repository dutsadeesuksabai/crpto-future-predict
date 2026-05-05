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

export function PredictionCard({ timeframe, prediction, symbol, currentPrice, onSave, saving, saved }: Props) {
  const isUp = prediction.direction === 'up'
  const conf = prediction.confidence

  const confidenceColor =
    conf >= 70 ? 'text-green-400' : conf >= 55 ? 'text-yellow-400' : 'text-orange-400'
  const barColor = isUp ? 'bg-green-500' : 'bg-red-500'

  return (
    <div className={`bg-gray-900 rounded-2xl p-5 border-2 ${isUp ? 'border-green-800' : 'border-red-800'}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-gray-400 text-sm">Prediction</span>
          <div className="text-white font-bold text-lg">{symbol.replace('USDT', '')} in {timeframe}</div>
        </div>
        <div className={`text-4xl font-black ${isUp ? 'text-green-400' : 'text-red-400'}`}>
          {isUp ? '▲' : '▼'}
        </div>
      </div>

      <div className={`text-center py-3 rounded-xl mb-4 ${isUp ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
        <div className={`text-2xl font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
          {isUp ? 'LIKELY UP' : 'LIKELY DOWN'}
        </div>
        <div className={`text-sm ${confidenceColor} font-semibold`}>
          Confidence: {conf.toFixed(1)}%
        </div>
      </div>

      {/* Bull/Bear bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Bear {prediction.bearScore.toFixed(0)}%</span>
          <span>Bull {prediction.bullScore.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-red-900/40 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-green-600 rounded-full transition-all duration-500"
            style={{ width: `${prediction.bullScore}%` }}
          />
        </div>
      </div>

      {/* Signals */}
      <div className="space-y-1.5 mb-4">
        {prediction.signals.map((s) => (
          <div key={s.name} className="flex items-center justify-between text-xs">
            <span className="text-gray-500 w-32 truncate">{s.name}</span>
            <div className="flex items-center gap-2 flex-1">
              <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                <div
                  className={`h-full rounded-full ${s.bullish ? 'bg-green-600' : 'bg-red-600'}`}
                  style={{ width: `${s.value > 100 ? 50 : s.value < 0 ? 50 : s.value}%` }}
                />
              </div>
              <span className={`w-16 text-right ${s.bullish ? 'text-green-400' : 'text-red-400'}`}>
                {s.interpretation.length > 10 ? s.interpretation.substring(0, 10) + '..' : s.interpretation}
              </span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onSave}
        disabled={saving || saved}
        className={`w-full py-2 rounded-xl text-sm font-semibold transition-colors ${
          saved
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : saving
              ? 'bg-gray-700 text-gray-400 cursor-wait'
              : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
        }`}
      >
        {saved ? 'Saved to Supabase' : saving ? 'Saving...' : 'Save Prediction'}
      </button>
    </div>
  )
}
