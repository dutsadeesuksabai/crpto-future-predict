'use client'

import type { AnomalyResult } from '@/lib/anomaly'

const SEVERITY_STYLES = {
  high:   { bg: 'bg-red-900/40 border-red-700',    text: 'text-red-300',    icon: '⚠️' },
  medium: { bg: 'bg-orange-900/30 border-orange-700', text: 'text-orange-300', icon: '⚡' },
  low:    { bg: 'bg-yellow-900/20 border-yellow-800', text: 'text-yellow-400', icon: '⚡' },
}

export function AnomalyAlert({ anomaly }: { anomaly: AnomalyResult }) {
  if (!anomaly.hasAnomaly) return null

  const s = SEVERITY_STYLES[anomaly.severity]

  return (
    <div className={`rounded-xl border px-4 py-3 ${s.bg} flex items-start gap-3`}>
      <span className="text-lg flex-shrink-0 mt-0.5">{s.icon}</span>
      <div className="flex-1 min-w-0">
        <div className={`font-bold text-sm ${s.text} mb-0.5`}>
          {anomaly.severity.toUpperCase()} ANOMALY DETECTED
        </div>
        <div className={`text-xs ${s.text} opacity-90`}>{anomaly.message}</div>
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
          <span>Z-score: <span className="text-gray-400 font-medium">{anomaly.zScore.toFixed(1)}σ</span></span>
          <span>Vol vs avg: <span className="text-gray-400 font-medium">
            {anomaly.details.avgVolume > 0
              ? `${(anomaly.details.currentVolume / anomaly.details.avgVolume * 100).toFixed(0)}%`
              : '—'}
          </span></span>
          <span className="text-orange-500 font-medium">Prediction reliability reduced</span>
        </div>
      </div>
    </div>
  )
}
