'use client'

import type { IndicatorSet } from '@/lib/indicators'

interface Props {
  indicators: IndicatorSet
  label: string
}

function Gauge({ value, min = 0, max = 100, label, reverse = false }: {
  value: number; min?: number; max?: number; label: string; reverse?: boolean
}) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
  const isBullish = reverse ? pct < 50 : pct > 50
  const color = pct > 70 ? (reverse ? 'text-red-400' : 'text-green-400')
    : pct < 30 ? (reverse ? 'text-green-400' : 'text-red-400')
    : 'text-yellow-400'

  return (
    <div className="bg-gray-800/50 rounded-xl p-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-gray-500 text-xs">{label}</span>
        <span className={`text-xs font-bold ${color}`}>{value.toFixed(1)}</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-1.5">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isBullish ? 'bg-green-500' : 'bg-red-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function IndicatorPanel({ indicators, label }: Props) {
  return (
    <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
      <div className="text-gray-400 text-sm font-semibold mb-3">{label} Indicators</div>
      <div className="grid grid-cols-2 gap-2">
        <Gauge value={indicators.rsi} label="RSI (14)" />
        <Gauge value={indicators.stochRSI} label="Stoch RSI" />
        <Gauge value={indicators.bbPosition} label="BB Position" reverse />
        <Gauge value={indicators.emaCross} label="EMA Cross" />
        <Gauge value={indicators.volumeScore} label="Volume" />
        <Gauge value={indicators.momentum} label="Momentum" />
      </div>
      <div className="mt-3 pt-3 border-t border-gray-800 grid grid-cols-2 gap-2 text-xs">
        <div className="text-gray-600">
          MACD: <span className={indicators.macd > indicators.macdSignal ? 'text-green-400' : 'text-red-400'}>
            {indicators.macdHistogram > 0 ? '+' : ''}{indicators.macdHistogram.toFixed(4)}
          </span>
        </div>
        <div className="text-gray-600">
          ATR: <span className="text-gray-300">{indicators.atr.toFixed(2)}</span>
        </div>
        <div className="text-gray-600">
          BB Upper: <span className="text-gray-300">${indicators.bbUpper.toFixed(2)}</span>
        </div>
        <div className="text-gray-600">
          BB Lower: <span className="text-gray-300">${indicators.bbLower.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}
