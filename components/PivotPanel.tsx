'use client'

import { useState } from 'react'
import type { LevelData, PivotLevel } from '@/lib/levels'
import { nearestLevel, distancePct } from '@/lib/levels'
import { fmtPrice } from '@/lib/targets'

interface Props {
  levels: LevelData
  currentPrice: number
}

function LevelRow({ level, currentPrice }: { level: PivotLevel; currentPrice: number }) {
  const dist   = distancePct(currentPrice, level.price)
  const isNear = Math.abs(dist) < 0.5
  const color  = level.type === 'resistance' ? 'text-red-400'
               : level.type === 'support'    ? 'text-green-400'
               : 'text-amber-400'
  const bg     = isNear ? 'bg-gray-700/60 border-l-2 border-amber-500' : ''
  return (
    <div className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-xs ${bg}`}>
      <span className={`font-bold w-10 ${color}`}>{level.label}</span>
      <span className="font-mono text-gray-300">${fmtPrice(level.price)}</span>
      <span className={`text-right w-16 ${dist >= 0 ? 'text-green-500' : 'text-red-500'} font-medium`}>
        {dist >= 0 ? '+' : ''}{dist.toFixed(2)}%
      </span>
    </div>
  )
}

export function PivotPanel({ levels, currentPrice }: Props) {
  const [mode, setMode] = useState<'classic' | 'fibonacci' | 'swing'>('classic')

  const activeList = mode === 'classic' ? levels.classic
                   : mode === 'fibonacci' ? levels.fibonacci
                   : levels.swingLevels

  const { above, below } = nearestLevel(currentPrice, activeList)

  // Daily range context
  const dayRange = ((levels.dailyHigh - levels.dailyLow) / levels.dailyLow) * 100
  const dayPos   = levels.dailyHigh !== levels.dailyLow
    ? ((currentPrice - levels.dailyLow) / (levels.dailyHigh - levels.dailyLow)) * 100 : 50

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-bold text-white">Pivot Points</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Daily range: {dayRange.toFixed(2)}% · H ${fmtPrice(levels.dailyHigh)} / L ${fmtPrice(levels.dailyLow)}
          </div>
        </div>
        <div className="flex gap-1">
          {(['classic', 'fibonacci', 'swing'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`text-xs px-2 py-1 rounded-lg transition-colors capitalize ${
                mode === m ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {m === 'fibonacci' ? 'Fib' : m === 'swing' ? 'S/R' : 'Classic'}
            </button>
          ))}
        </div>
      </div>

      {/* Daily position bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Low ${fmtPrice(levels.dailyLow)}</span>
          <span className="text-amber-400 font-medium">
            Now ${fmtPrice(currentPrice)} ({dayPos.toFixed(0)}% of day range)
          </span>
          <span>High ${fmtPrice(levels.dailyHigh)}</span>
        </div>
        <div className="relative w-full h-2 bg-gray-800 rounded-full overflow-hidden">
          <div className="absolute top-0 h-full bg-gradient-to-r from-green-800 to-red-800 rounded-full" style={{ width: '100%' }} />
          <div className="absolute top-0 h-full w-1 bg-white rounded-full shadow-lg"
            style={{ left: `${Math.max(0, Math.min(98, dayPos))}%` }} />
        </div>
      </div>

      {/* Nearest levels callout */}
      {(above || below) && (
        <div className="flex gap-2 mb-3 text-xs">
          {above && (
            <div className="flex-1 bg-red-900/20 border border-red-900/50 rounded-lg px-3 py-2">
              <div className="text-gray-500 mb-0.5">Next Resistance</div>
              <div className="text-red-400 font-bold">{above.label} ${fmtPrice(above.price)}</div>
              <div className="text-red-500/70 text-xs">+{distancePct(currentPrice, above.price).toFixed(2)}%</div>
            </div>
          )}
          {below && (
            <div className="flex-1 bg-green-900/20 border border-green-900/50 rounded-lg px-3 py-2">
              <div className="text-gray-500 mb-0.5">Next Support</div>
              <div className="text-green-400 font-bold">{below.label} ${fmtPrice(below.price)}</div>
              <div className="text-green-500/70 text-xs">{distancePct(currentPrice, below.price).toFixed(2)}%</div>
            </div>
          )}
        </div>
      )}

      {/* All levels */}
      <div className="space-y-0.5 max-h-60 overflow-y-auto">
        {[...activeList]
          .sort((a, b) => b.price - a.price)
          .map((level) => (
            <LevelRow key={level.label} level={level} currentPrice={currentPrice} />
          ))}
        {activeList.length === 0 && (
          <div className="text-center text-gray-600 text-xs py-4">No levels available</div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-3 mt-3 pt-2 border-t border-gray-800 text-xs">
        <span className="flex items-center gap-1 text-red-400">
          <span className="w-2 h-2 rounded-full bg-red-400" /> Resistance
        </span>
        <span className="flex items-center gap-1 text-amber-400">
          <span className="w-2 h-2 rounded-full bg-amber-400" /> Pivot
        </span>
        <span className="flex items-center gap-1 text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-400" /> Support
        </span>
        <span className="ml-auto text-gray-600">Highlighted = within 0.5%</span>
      </div>
    </div>
  )
}
