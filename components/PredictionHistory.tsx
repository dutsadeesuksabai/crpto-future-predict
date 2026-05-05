'use client'

import type { Prediction } from '@/lib/supabase'
import { format } from 'date-fns'

interface Props {
  predictions: Prediction[]
}

export function PredictionHistory({ predictions }: Props) {
  if (predictions.length === 0) {
    return (
      <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
        <div className="text-gray-400 font-semibold mb-2">Prediction History</div>
        <div className="text-gray-600 text-sm text-center py-6">No saved predictions yet.</div>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
      <div className="text-gray-400 font-semibold mb-4">Prediction History</div>
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {predictions.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between bg-gray-800/50 rounded-xl px-3 py-2 text-xs"
          >
            <div className="flex items-center gap-2">
              <span className={`font-bold ${p.direction === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                {p.direction === 'up' ? '▲' : '▼'} {p.timeframe}
              </span>
              <span className="text-gray-500">{p.symbol.replace('USDT', '')}</span>
            </div>
            <div className="text-center">
              <div className="text-gray-400">${Number(p.price_at_prediction).toLocaleString()}</div>
              {p.actual_price && (
                <div className={Number(p.actual_price) > Number(p.price_at_prediction) ? 'text-green-500' : 'text-red-500'}>
                  → ${Number(p.actual_price).toLocaleString()}
                </div>
              )}
            </div>
            <div className="text-right">
              <div
                className={`font-bold px-2 py-0.5 rounded-full text-xs ${
                  p.result === 'correct'
                    ? 'bg-green-900/50 text-green-400'
                    : p.result === 'incorrect'
                      ? 'bg-red-900/50 text-red-400'
                      : 'bg-gray-700 text-gray-400'
                }`}
              >
                {p.result || 'pending'}
              </div>
              <div className="text-gray-600 mt-0.5">
                {p.created_at ? format(new Date(p.created_at), 'HH:mm:ss') : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
