'use client'

import { useState, useEffect } from 'react'
import type { BacktestStats } from '@/app/api/backtest/route'

export function BacktestPanel({ symbol }: { symbol: string }) {
  const [stats, setStats] = useState<BacktestStats[]>([])
  const [hours, setHours] = useState(24)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/backtest?symbol=${symbol}&hours=${hours}`)
      .then((r) => r.json())
      .then((d) => setStats(d.stats || []))
      .catch(() => setStats([]))
      .finally(() => setLoading(false))
  }, [symbol, hours])

  return (
    <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-400 text-xs font-semibold">Backtest Simulator</span>
        <div className="flex gap-1">
          {[12, 24, 48, 168].map((h) => (
            <button key={h}
              onClick={() => setHours(h)}
              className={`text-xs px-2 py-1 rounded-lg transition-colors ${hours === h ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              {h < 48 ? `${h}h` : `${h / 24}d`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-16 bg-gray-800 rounded-xl animate-pulse" />)}
        </div>
      ) : stats.length === 0 ? (
        <div className="text-gray-600 text-sm text-center py-6">
          No completed predictions in last {hours}h.<br />
          <span className="text-xs">Save predictions and wait for them to resolve.</span>
        </div>
      ) : (
        <div className="space-y-3">
          {stats.map((s) => {
            const winColor = s.winRate >= 60 ? 'text-green-400' : s.winRate >= 50 ? 'text-yellow-400' : 'text-red-400'
            const pnlColor = s.totalPnlPct >= 0 ? 'text-green-400' : 'text-red-400'
            return (
              <div key={`${s.symbol}-${s.timeframe}`} className="bg-gray-800/50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white text-xs font-bold">{s.symbol.replace('USDT', '')} · {s.timeframe}</span>
                  <span className={`text-xs font-bold ${winColor}`}>{s.winRate.toFixed(1)}% Win Rate</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <div className="text-gray-600">Trades</div>
                    <div className="text-gray-300 font-medium">{s.total}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">W/L</div>
                    <div className="text-gray-300 font-medium">{s.wins}/{s.losses}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Total P&L</div>
                    <div className={`font-bold ${pnlColor}`}>{s.totalPnlPct >= 0 ? '+' : ''}{s.totalPnlPct.toFixed(2)}%</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Sharpe</div>
                    <div className={`font-medium ${s.sharpeProxy >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {s.sharpeProxy.toFixed(2)}
                    </div>
                  </div>
                </div>
                {/* P&L bar */}
                <div className="mt-2 bg-gray-700 rounded-full h-1 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${s.totalPnlPct >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, Math.abs(s.totalPnlPct) * 10)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
