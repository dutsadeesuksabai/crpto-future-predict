'use client'

import { useState, useEffect } from 'react'
import type { CalibrationData } from '@/lib/calibration'
import type { SignalHealth } from '@/lib/signalhealth'

function CalibrationChart({ buckets }: { buckets: CalibrationData['buckets'] }) {
  const valid = buckets.filter((b) => b.total >= 3)
  if (valid.length < 2) return (
    <div className="text-gray-600 text-xs text-center py-4">
      Need more data ({valid.length}/3 buckets filled)
    </div>
  )

  return (
    <div className="space-y-1.5 mt-2">
      {valid.map((b) => {
        const err = b.calibrationError
        const over = err > 5
        const under = err < -5
        return (
          <div key={b.range} className="flex items-center gap-2 text-xs">
            <span className="text-gray-600 w-12 text-right">{b.range}%</span>
            <div className="flex-1 relative h-3 bg-gray-800 rounded-full overflow-hidden">
              {/* Expected line */}
              <div className="absolute top-0 h-full bg-blue-900/60 rounded-full" style={{ width: `${b.expectedAccuracy}%` }} />
              {/* Actual */}
              <div
                className={`absolute top-0 h-full rounded-full ${over ? 'bg-orange-500' : under ? 'bg-blue-500' : 'bg-green-500'}`}
                style={{ width: `${b.actualAccuracy}%`, opacity: 0.8 }}
              />
            </div>
            <span className={`w-10 text-right font-medium ${over ? 'text-orange-400' : under ? 'text-blue-400' : 'text-green-400'}`}>
              {b.actualAccuracy.toFixed(0)}%
            </span>
            <span className="text-gray-600 w-10 text-right">n={b.total}</span>
          </div>
        )
      })}
      <div className="flex gap-3 text-xs text-gray-600 mt-2 pt-2 border-t border-gray-800">
        <span><span className="inline-block w-2 h-2 bg-blue-900/60 rounded-full mr-1" />Expected</span>
        <span><span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1" />Actual (calibrated)</span>
        <span><span className="inline-block w-2 h-2 bg-orange-500 rounded-full mr-1" />Over-confident</span>
      </div>
    </div>
  )
}

function SignalHealthBar({ s }: { s: SignalHealth['signals'][number] }) {
  const color = s.status === 'reliable' ? 'bg-green-500' : s.status === 'average' ? 'bg-yellow-500' : s.status === 'weak' ? 'bg-red-500' : 'bg-gray-600'
  const textColor = s.status === 'reliable' ? 'text-green-400' : s.status === 'average' ? 'text-yellow-400' : s.status === 'weak' ? 'text-red-400' : 'text-gray-500'

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-500 w-32 truncate">{s.name}</span>
      <div className="flex-1 bg-gray-800 rounded-full h-1.5">
        <div className={`h-full rounded-full ${color}`}
          style={{ width: s.total >= 5 ? `${s.accuracy}%` : '5%', opacity: s.total < 5 ? 0.3 : 1 }} />
      </div>
      <span className={`w-20 text-right ${textColor}`}>
        {s.total < 5 ? 'No data' : `${s.accuracy.toFixed(0)}% (${s.total})`}
      </span>
    </div>
  )
}

export function CalibrationPanel({ symbol }: { symbol: string }) {
  const [data, setData] = useState<{ calibration: CalibrationData; signalHealth: SignalHealth } | null>(null)
  const [tab, setTab] = useState<'calibration' | 'health'>('health')

  useEffect(() => {
    fetch(`/api/calibration?symbol=${symbol}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
  }, [symbol])

  return (
    <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-xs font-semibold">Model Intelligence</span>
        <div className="flex gap-1">
          {(['health', 'calibration'] as const).map((t) => (
            <button key={t}
              onClick={() => setTab(t)}
              className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              {t === 'health' ? 'Signal Health' : 'Calibration'}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-4 bg-gray-800 rounded animate-pulse" />)}</div>
      ) : tab === 'health' ? (
        <div>
          <div className="flex justify-between text-xs text-gray-600 mb-3">
            <span>Based on {data.signalHealth.dataPoints} predictions</span>
            <span>Overall: <span className={data.signalHealth.overallAccuracy >= 55 ? 'text-green-400' : 'text-yellow-400'}>
              {data.signalHealth.overallAccuracy.toFixed(1)}%
            </span></span>
          </div>
          <div className="space-y-1.5">
            {data.signalHealth.signals.map((s) => <SignalHealthBar key={s.name} s={s} />)}
          </div>
        </div>
      ) : (
        <div>
          <div className={`text-xs rounded-lg px-3 py-2 mb-3 ${
            data.calibration.isWellCalibrated ? 'bg-green-900/20 text-green-400' : 'bg-yellow-900/20 text-yellow-400'
          }`}>
            {data.calibration.recommendation}
          </div>
          <CalibrationChart buckets={data.calibration.buckets} />
        </div>
      )}
    </div>
  )
}
