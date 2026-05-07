'use client'

import { useState, useCallback } from 'react'
import type { BacktestResult, BacktestSummary, TierStats } from '@/lib/backtester'
import { STRATEGIES } from '@/lib/strategies'

// ── API types ─────────────────────────────────────────────────────────────────

type TFStats = {
  accuracy: number
  accuracyClean: number | null  // filtered to quality ≥ 65
  totalClean: number | null
  total: number
  sharpe: number
  totalPnl: number
  profitFactor: number
  avgQuality: number
}

type ComparisonRow = {
  strategyId: string
  name: string
  emoji: string
  accentColor: string
  '10m': TFStats | null
  '30m': TFStats | null
}

type SimResponse = {
  symbol: string
  days: number
  klineCount: number
  minQuality: number
  runAt: number
  comparison: ComparisonRow[]
  results: Record<string, Record<number, BacktestResult>>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function accColor(acc: number) {
  if (acc >= 62) return '#22c55e'
  if (acc >= 56) return '#a3e635'
  if (acc >= 52) return '#f59e0b'
  return '#ef4444'
}

function TierRow({ label, stats }: { label: string; stats: TierStats | undefined }) {
  if (!stats || stats.total < 3) return (
    <div className="flex items-center gap-2 text-xs opacity-40">
      <span className="text-gray-600 w-28 truncate shrink-0">{label}</span>
      <span className="text-gray-700 text-xs">n &lt; 3</span>
    </div>
  )
  const color = accColor(stats.accuracy)
  const pnlColor = stats.avgPnl >= 0 ? '#22c55e' : '#ef4444'
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-500 w-28 truncate shrink-0">{label}</span>
      <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden relative">
        <div className="absolute inset-y-0 left-0 w-1/2 bg-gray-700" />
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${stats.accuracy}%`, background: color }} />
      </div>
      <span className="w-11 text-right font-semibold shrink-0" style={{ color }}>{stats.accuracy.toFixed(0)}%</span>
      <span className="w-8 text-right text-gray-600 shrink-0">n={stats.total}</span>
      {stats.avgPnl !== 0 && (
        <span className="w-14 text-right shrink-0" style={{ color: pnlColor, fontSize: 10 }}>
          {stats.avgPnl >= 0 ? '+' : ''}{stats.avgPnl.toFixed(3)}%
        </span>
      )}
    </div>
  )
}

function HourHeatmap({ byHour }: { byHour: Record<number, { total: number; correct: number; accuracy: number }> }) {
  const hours = Array.from({ length: 24 }, (_, i) => i)
  return (
    <div>
      <div className="text-xs text-gray-600 mb-2">Accuracy by UTC hour (hover for detail)</div>
      <div className="grid grid-cols-12 gap-0.5">
        {hours.map((h) => {
          const d = byHour[h]
          const acc = d?.accuracy ?? 0
          const n = d?.total ?? 0
          const alpha = n === 0 ? 0.08 : Math.min(0.9, 0.25 + n / 15)
          const bg = n === 0 ? `rgba(55,65,81,0.3)`
            : acc >= 62 ? `rgba(34,197,94,${alpha})`
            : acc >= 54 ? `rgba(245,158,11,${alpha})`
            : `rgba(239,68,68,${alpha})`
          return (
            <div key={h} title={`${String(h).padStart(2,'0')}:00 UTC  accuracy ${acc.toFixed(0)}%  n=${n}`}
              className="flex flex-col items-center cursor-default">
              <div className="w-full rounded-sm" style={{ height: 18, background: bg }} />
              <span className="text-gray-600" style={{ fontSize: 9 }}>{h}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SummaryCards({ s }: { s: BacktestSummary }) {
  const cards = [
    { label: 'Accuracy', value: `${s.accuracy.toFixed(1)}%`, color: accColor(s.accuracy) },
    { label: 'Signals', value: String(s.total), color: '#9ca3af' },
    { label: 'Total P&L', value: `${s.totalPnlPct >= 0 ? '+' : ''}${s.totalPnlPct.toFixed(2)}%`, color: s.totalPnlPct >= 0 ? '#22c55e' : '#ef4444' },
    { label: 'Sharpe', value: s.sharpe.toFixed(2), color: s.sharpe >= 0.3 ? '#22c55e' : s.sharpe >= 0 ? '#f59e0b' : '#ef4444' },
    { label: 'Profit Factor', value: s.profitFactor.toFixed(2), color: s.profitFactor >= 1.2 ? '#22c55e' : s.profitFactor >= 1 ? '#f59e0b' : '#ef4444' },
    { label: 'Max DD', value: `-${s.maxDrawdown.toFixed(2)}%`, color: s.maxDrawdown > 5 ? '#ef4444' : '#f59e0b' },
    { label: 'Avg Conf', value: `${s.avgConfidence.toFixed(1)}%`, color: '#9ca3af' },
    { label: 'Avg Quality', value: s.avgQuality.toFixed(1), color: s.avgQuality >= 65 ? '#22c55e' : s.avgQuality >= 50 ? '#f59e0b' : '#9ca3af' },
  ]
  return (
    <div className="grid grid-cols-4 gap-2">
      {cards.map(({ label, value, color }) => (
        <div key={label} className="bg-gray-800/60 rounded-xl px-3 py-2 text-center">
          <div className="text-gray-600 text-xs mb-0.5">{label}</div>
          <div className="font-bold text-sm" style={{ color }}>{value}</div>
        </div>
      ))}
    </div>
  )
}

function EquityCurveChart({ curve, color, ticks }: {
  curve: number[]
  color: string
  ticks: { correct: boolean }[]
}) {
  if (curve.length < 2) return <div className="text-gray-600 text-xs text-center py-4">Not enough data</div>
  const W = 500, H = 100
  const min = Math.min(...curve, 0) - 0.3
  const max = Math.max(...curve, 0) + 0.3
  const range = max - min || 1
  const zeroY = H - ((0 - min) / range) * H
  const pts = curve.map((v, i) =>
    `${(i / (curve.length - 1)) * W},${H - ((v - min) / range) * H}`
  )
  const linePts = pts.join(' ')
  const fillPts = `0,${zeroY} ${linePts} ${W},${zeroY}`
  const finalPnl = curve[curve.length - 1]
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full" style={{ minWidth: 300 }}>
        <line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke="#374151" strokeWidth={1} strokeDasharray="3,3" />
        <polygon points={fillPts} fill={finalPnl >= 0 ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.07)'} />
        <polyline points={linePts} fill="none" stroke={color} strokeWidth={1.8} />
        {ticks.map((t, i) => {
          if (i >= curve.length) return null
          const x = (i / (curve.length - 1)) * W
          const y = H - ((curve[i] - min) / range) * H
          return <circle key={i} cx={x} cy={y} r={2} fill={t.correct ? '#22c55e' : '#ef4444'} opacity={0.65} />
        })}
        <text x={3} y={13} fontSize={9} fill="#6b7280">{max.toFixed(2)}%</text>
        <text x={3} y={H - 3} fontSize={9} fill="#6b7280">{min.toFixed(2)}%</text>
        <text x={W - 3} y={H + 16} fontSize={9} fill={finalPnl >= 0 ? '#22c55e' : '#ef4444'} textAnchor="end">
          {finalPnl >= 0 ? '+' : ''}{finalPnl.toFixed(2)}%
        </text>
      </svg>
      <div className="flex gap-4 text-xs text-gray-600 mt-1">
        <span><span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1" />ถูก</span>
        <span><span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-1" />ผิด</span>
        <span className="ml-auto">ไม่รวม fee · 1× leverage</span>
      </div>
    </div>
  )
}

// ── Insight banner about expected accuracy ────────────────────────────────────

function AccuracyInsight({ summary }: { summary: BacktestSummary }) {
  const pureStats  = summary.byQuality['pure']
  const cleanStats = summary.byQuality['clean']
  const high90     = summary.byConfidence['90+']

  return (
    <div className="bg-gray-800/50 rounded-xl px-4 py-3 text-xs space-y-1.5 border border-gray-700/40">
      <div className="text-gray-400 font-semibold mb-2">📐 วิเคราะห์ Indicator Accuracy</div>

      <div className="text-gray-500">
        Overall {summary.total} signals → <span style={{ color: accColor(summary.accuracy) }} className="font-bold">{summary.accuracy.toFixed(1)}%</span>
        {summary.accuracy < 53 && ' (ใกล้ random 50% เพราะ 1m noise สูง)'}
        {summary.accuracy >= 55 && ' ✓ above random baseline'}
      </div>

      {pureStats && pureStats.total >= 3 && (
        <div>
          🟣 Pure quality (Q≥80): <span style={{ color: accColor(pureStats.accuracy) }} className="font-bold">{pureStats.accuracy.toFixed(1)}%</span>
          <span className="text-gray-600"> (n={pureStats.total})</span>
          {pureStats.accuracy > summary.accuracy + 3 && <span className="text-green-500"> ↑ ดีกว่า overall {(pureStats.accuracy - summary.accuracy).toFixed(1)}%</span>}
        </div>
      )}

      {cleanStats && cleanStats.total >= 3 && (
        <div>
          🟢 Clean quality (Q≥65): <span style={{ color: accColor(cleanStats.accuracy) }} className="font-bold">{cleanStats.accuracy.toFixed(1)}%</span>
          <span className="text-gray-600"> (n={cleanStats.total})</span>
        </div>
      )}

      {high90 && high90.total >= 3 && (
        <div>
          ⚡ Confidence ≥90%: <span style={{ color: accColor(high90.accuracy) }} className="font-bold">{high90.accuracy.toFixed(1)}%</span>
          <span className="text-gray-600"> (n={high90.total})</span>
          {high90.accuracy > summary.accuracy + 3 && <span className="text-green-500"> ↑ high confidence = more reliable</span>}
        </div>
      )}

      <div className="text-gray-600 pt-1 border-t border-gray-700/30">
        Best condition: <span className="text-gray-400">{summary.bestCondition}</span>
      </div>
    </div>
  )
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

type DetailView = { stratId: string; tf: 10 | 30 }

export function BacktestRunnerPanel({ symbol }: { symbol: string }) {
  const [tab, setTab] = useState<'simulation' | 'live'>('simulation')

  // Simulation state
  const [days, setDays] = useState(1)
  const [minQuality, setMinQuality] = useState(0)  // 0 = all signals
  const [selectedStratIds, setSelectedStratIds] = useState<string[]>(STRATEGIES.map((s) => s.id))
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<SimResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [detailView, setDetailView] = useState<DetailView | null>(null)
  const [activeDetailTab, setActiveDetailTab] = useState<'breakdown' | 'equity' | 'hours'>('breakdown')
  const [showClean, setShowClean] = useState(true)  // show clean-filtered column

  // Live tracking state
  const [liveStats, setLiveStats] = useState<{ symbol: string; timeframe: string; winRate: number; total: number; wins: number; losses: number; totalPnlPct: number; sharpeProxy: number }[]>([])
  const [liveHours, setLiveHours] = useState(24)
  const [liveLoading, setLiveLoading] = useState(false)

  const fetchLive = useCallback(async (sym: string, h: number) => {
    setLiveLoading(true)
    try {
      const r = await fetch(`/api/backtest?symbol=${sym}&hours=${h}`)
      const d = await r.json()
      setLiveStats(d.stats ?? [])
    } catch { setLiveStats([]) }
    finally { setLiveLoading(false) }
  }, [])

  const runSim = useCallback(async () => {
    if (selectedStratIds.length === 0) return
    setLoading(true)
    setError(null)
    setResult(null)
    setDetailView(null)
    setProgress(`Fetching ${days}d of ${symbol} historical klines…`)

    try {
      const params = new URLSearchParams({
        symbol,
        days: String(days),
        strategies: selectedStratIds.join(','),
        minQuality: String(minQuality),
      })
      setProgress('Simulating predictions on historical candles…')
      const res = await fetch(`/api/backtest/simulate?${params}`)
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error ?? `HTTP ${res.status}`)
      }
      setResult(await res.json())
      setProgress('')
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [symbol, days, selectedStratIds, minQuality])

  // Detail result
  const detailResult: BacktestResult | null =
    detailView ? result?.results?.[detailView.stratId]?.[detailView.tf] ?? null : null
  const strat = STRATEGIES.find((s) => s.id === detailView?.stratId)

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <span className="text-gray-300 text-sm font-bold">📊 Backtest &amp; Analysis</span>
        <div className="flex gap-1">
          {(['simulation', 'live'] as const).map((t) => (
            <button key={t}
              onClick={() => { setTab(t); if (t === 'live') fetchLive(symbol, liveHours) }}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {t === 'simulation' ? '⏱ Historical Sim' : '📈 Live Tracking'}
            </button>
          ))}
        </div>
      </div>

      {/* ── SIMULATION TAB ──────────────────────────────────────────────────── */}
      {tab === 'simulation' && (
        <div className="p-4">

          {/* Controls */}
          {!detailView && (
            <div className="flex flex-wrap items-end gap-3 mb-4">
              {/* Period */}
              <div>
                <div className="text-xs text-gray-600 mb-1">Period</div>
                <div className="flex gap-1">
                  {[0.5, 1, 2, 3].map((d) => (
                    <button key={d} onClick={() => setDays(d)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg ${days === d ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                      {d < 1 ? '12h' : `${d}d`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Min Quality filter */}
              <div>
                <div className="text-xs text-gray-600 mb-1">Min Quality</div>
                <div className="flex gap-1">
                  {[0, 50, 65, 80].map((q) => (
                    <button key={q} onClick={() => setMinQuality(q)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg ${minQuality === q ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                      {q === 0 ? 'All' : q === 50 ? 'Mixed+' : q === 65 ? 'Clean+' : 'Pure'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Strategy picker */}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-600 mb-1">Strategies ({selectedStratIds.length}/{STRATEGIES.length})</div>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setSelectedStratIds(
                      selectedStratIds.length === STRATEGIES.length ? [] : STRATEGIES.map((s) => s.id)
                    )}
                    className="text-xs px-2 py-1 rounded-lg bg-gray-700 text-gray-400 hover:bg-gray-600">
                    {selectedStratIds.length === STRATEGIES.length ? 'Clear' : 'All'}
                  </button>
                  {STRATEGIES.map((s) => {
                    const sel = selectedStratIds.includes(s.id)
                    return (
                      <button key={s.id}
                        onClick={() => setSelectedStratIds((prev) =>
                          sel ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                        )}
                        className="text-xs px-2 py-1 rounded-lg border transition-all"
                        style={{
                          background: sel ? `${s.accentColor}20` : 'rgba(31,41,55,1)',
                          borderColor: sel ? s.accentColor : 'rgba(55,65,81,1)',
                          color: sel ? s.accentColor : '#6b7280',
                          fontSize: 11,
                        }}>
                        {s.emoji}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button onClick={runSim} disabled={loading || selectedStratIds.length === 0}
                className={`text-sm px-5 py-2 rounded-xl font-bold transition-all shrink-0 ${
                  loading ? 'bg-gray-700 text-gray-500 cursor-wait' : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95'
                }`}>
                {loading ? '⏳ Running…' : '▶ Run'}
              </button>
            </div>
          )}

          {/* Progress */}
          {loading && progress && (
            <div className="flex items-center gap-2 text-xs text-blue-400 mb-3">
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              {progress}
            </div>
          )}

          {error && (
            <div className="text-red-400 text-xs bg-red-900/20 rounded-xl px-4 py-3 mb-3">{error}</div>
          )}

          {/* ── Comparison Table ─────────────────────────────────────────── */}
          {result && !detailView && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">
                  {result.klineCount.toLocaleString()} candles · {result.days}d · {result.comparison.length} strategies
                  {result.minQuality > 0 && <span className="ml-2 text-indigo-400">· min Q{result.minQuality}</span>}
                </span>
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                  <input type="checkbox" checked={showClean} onChange={(e) => setShowClean(e.target.checked)} className="accent-blue-500" />
                  Show Clean accuracy
                </label>
              </div>

              {/* ── Table ──────────────────────────────────────────────── */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-gray-600 border-b border-gray-800">
                      <th className="text-left py-2 pr-3 font-medium whitespace-nowrap">Strategy</th>
                      <th className="text-center py-2 px-1 font-medium" colSpan={showClean ? 4 : 3}>10-minute</th>
                      <th className="text-center py-2 px-1 font-medium" colSpan={showClean ? 4 : 3}>30-minute</th>
                    </tr>
                    <tr className="text-gray-600 border-b border-gray-800 text-xs" style={{ fontSize: 10 }}>
                      <th />
                      <th className="text-center py-1 px-1 whitespace-nowrap">All %</th>
                      {showClean && <th className="text-center py-1 px-1 whitespace-nowrap">Clean %</th>}
                      <th className="text-center py-1 px-1">P&L</th>
                      <th className="text-center py-1 px-1">Sharpe</th>
                      <th className="text-center py-1 px-1 whitespace-nowrap">All %</th>
                      {showClean && <th className="text-center py-1 px-1 whitespace-nowrap">Clean %</th>}
                      <th className="text-center py-1 px-1">P&L</th>
                      <th className="text-center py-1 px-1">Sharpe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.comparison.map((row, rank) => {
                      const isTop = rank === 0
                      const avg10 = row['10m']?.accuracy ?? 50
                      const avg30 = row['30m']?.accuracy ?? 50
                      return (
                        <tr key={row.strategyId}
                          className="border-b border-gray-800/40 hover:bg-gray-800/30 transition-colors"
                          style={isTop ? { background: 'rgba(34,197,94,0.04)' } : {}}>
                          <td className="py-1.5 pr-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {isTop && <span className="text-yellow-400" style={{ fontSize: 10 }}>🏆</span>}
                              <span>{row.emoji}</span>
                              <span className="text-gray-300 font-medium">{row.name}</span>
                              <span className="text-gray-600 hidden sm:block" style={{ fontSize: 10 }}>
                                avg {((avg10 + avg30) / 2).toFixed(0)}%
                              </span>
                            </div>
                          </td>

                          {/* 10m */}
                          {row['10m'] ? (
                            <>
                              <td className="text-center py-1.5 px-1">
                                <button className="font-bold hover:underline"
                                  style={{ color: accColor(row['10m'].accuracy) }}
                                  onClick={() => setDetailView({ stratId: row.strategyId, tf: 10 })}>
                                  {row['10m'].accuracy.toFixed(1)}%
                                </button>
                                <div className="text-gray-700" style={{ fontSize: 9 }}>n={row['10m'].total}</div>
                              </td>
                              {showClean && (
                                <td className="text-center py-1.5 px-1">
                                  {row['10m'].accuracyClean != null ? (
                                    <>
                                      <span className="font-bold" style={{ color: accColor(row['10m'].accuracyClean) }}>
                                        {row['10m'].accuracyClean.toFixed(1)}%
                                      </span>
                                      <div className="text-gray-700" style={{ fontSize: 9 }}>n={row['10m'].totalClean}</div>
                                    </>
                                  ) : <span className="text-gray-700">—</span>}
                                </td>
                              )}
                              <td className="text-center py-1.5 px-1" style={{ color: row['10m'].totalPnl >= 0 ? '#22c55e' : '#ef4444' }}>
                                {row['10m'].totalPnl >= 0 ? '+' : ''}{row['10m'].totalPnl.toFixed(2)}%
                              </td>
                              <td className="text-center py-1.5 px-1" style={{ color: row['10m'].sharpe >= 0 ? '#22c55e' : '#ef4444' }}>
                                {row['10m'].sharpe.toFixed(2)}
                              </td>
                            </>
                          ) : <td colSpan={showClean ? 4 : 3} className="text-center text-gray-700 py-1.5">—</td>}

                          {/* 30m */}
                          {row['30m'] ? (
                            <>
                              <td className="text-center py-1.5 px-1">
                                <button className="font-bold hover:underline"
                                  style={{ color: accColor(row['30m'].accuracy) }}
                                  onClick={() => setDetailView({ stratId: row.strategyId, tf: 30 })}>
                                  {row['30m'].accuracy.toFixed(1)}%
                                </button>
                                <div className="text-gray-700" style={{ fontSize: 9 }}>n={row['30m'].total}</div>
                              </td>
                              {showClean && (
                                <td className="text-center py-1.5 px-1">
                                  {row['30m'].accuracyClean != null ? (
                                    <>
                                      <span className="font-bold" style={{ color: accColor(row['30m'].accuracyClean) }}>
                                        {row['30m'].accuracyClean.toFixed(1)}%
                                      </span>
                                      <div className="text-gray-700" style={{ fontSize: 9 }}>n={row['30m'].totalClean}</div>
                                    </>
                                  ) : <span className="text-gray-700">—</span>}
                                </td>
                              )}
                              <td className="text-center py-1.5 px-1" style={{ color: row['30m'].totalPnl >= 0 ? '#22c55e' : '#ef4444' }}>
                                {row['30m'].totalPnl >= 0 ? '+' : ''}{row['30m'].totalPnl.toFixed(2)}%
                              </td>
                              <td className="text-center py-1.5 px-1" style={{ color: row['30m'].sharpe >= 0 ? '#22c55e' : '#ef4444' }}>
                                {row['30m'].sharpe.toFixed(2)}
                              </td>
                            </>
                          ) : <td colSpan={showClean ? 4 : 3} className="text-center text-gray-700 py-1.5">—</td>}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footnotes */}
              <div className="mt-3 space-y-1 text-xs text-gray-700">
                <div>⚠ Simulation ไม่มี Order Book / Funding Rate / F&G / MTF → accuracy จริงสูงกว่า live</div>
                <div>🟢 "Clean %" = กรองเฉพาะ signal ที่มี Quality ≥ 65 → แม่นยำกว่า Overall</div>
                <div>💡 คลิกตัวเลข accuracy เพื่อดู breakdown</div>
              </div>
            </div>
          )}

          {/* ── Detail View ───────────────────────────────────────────────── */}
          {detailView && detailResult && strat && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => setDetailView(null)}
                  className="text-xs text-gray-400 hover:text-gray-200 bg-gray-800 px-3 py-1.5 rounded-lg flex items-center gap-1">
                  ← Back
                </button>
                <span style={{ color: strat.accentColor }} className="text-sm font-bold">
                  {strat.emoji} {strat.name} · {detailView.tf}m
                </span>
                <span className="text-xs text-gray-600 ml-auto">
                  {detailResult.summary.total} signals · {result?.days}d of {symbol}
                </span>
              </div>

              <div className="mb-4"><SummaryCards s={detailResult.summary} /></div>

              {/* Insight banner */}
              <div className="mb-4"><AccuracyInsight summary={detailResult.summary} /></div>

              {/* Best / Worst condition */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-green-900/15 border border-green-900/30 rounded-xl px-3 py-2">
                  <div className="text-xs text-green-500 font-medium mb-0.5">✅ Best condition</div>
                  <div className="text-xs text-green-400">{detailResult.summary.bestCondition}</div>
                </div>
                <div className="bg-red-900/15 border border-red-900/30 rounded-xl px-3 py-2">
                  <div className="text-xs text-red-500 font-medium mb-0.5">⚠ Worst condition</div>
                  <div className="text-xs text-red-400">{detailResult.summary.worstCondition}</div>
                </div>
              </div>

              {/* Detail tabs */}
              <div className="flex gap-1 mb-4">
                {(['breakdown', 'equity', 'hours'] as const).map((t) => (
                  <button key={t} onClick={() => setActiveDetailTab(t)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${activeDetailTab === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                    {t === 'breakdown' ? '📋 Breakdown' : t === 'equity' ? '📈 Equity' : '🕐 By Hour'}
                  </button>
                ))}
              </div>

              {activeDetailTab === 'breakdown' && (
                <div className="space-y-5">
                  <div>
                    <div className="text-xs text-gray-500 font-semibold mb-2">📊 By Confidence Level</div>
                    <div className="space-y-1.5">
                      {Object.entries(detailResult.summary.byConfidence).map(([k, v]) => (
                        <TierRow key={k} label={`Conf ${k}%`} stats={v} />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 font-semibold mb-2">🔮 By Signal Quality</div>
                    <div className="space-y-1.5">
                      <TierRow label="🟣 Pure  (Q≥80)" stats={detailResult.summary.byQuality['pure']} />
                      <TierRow label="🟢 Clean (Q65-79)" stats={detailResult.summary.byQuality['clean']} />
                      <TierRow label="🟡 Mixed (Q50-64)" stats={detailResult.summary.byQuality['mixed']} />
                      <TierRow label="⚪ Noisy (Q<50)" stats={detailResult.summary.byQuality['noisy']} />
                    </div>
                    <p className="text-gray-700 text-xs mt-2">
                      ถ้า Pure accuracy &gt; overall → ระบบ quality filter ใช้งานได้จริง
                    </p>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 font-semibold mb-2">🔑 By Filters Passed</div>
                    <div className="space-y-1.5">
                      {[6, 5, 4, 3, 2, 1, 0].map((f) => (
                        <TierRow key={f} label={`${f}/6 filters ✓`} stats={detailResult.summary.byFilterCount[f]} />
                      ))}
                    </div>
                    <p className="text-gray-700 text-xs mt-2">
                      ถ้า 6/6 accuracy สูงกว่า 0/6 → filter system ทำงานถูกต้อง
                    </p>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 font-semibold mb-2">↕ By Direction</div>
                    <div className="space-y-1.5">
                      <TierRow label="▲ ขึ้น (Long)" stats={detailResult.summary.byDirection['up']} />
                      <TierRow label="▼ ลง (Short)" stats={detailResult.summary.byDirection['down']} />
                    </div>
                  </div>
                </div>
              )}

              {activeDetailTab === 'equity' && (
                <EquityCurveChart
                  curve={detailResult.summary.equityCurve}
                  color={strat.accentColor}
                  ticks={detailResult.ticks}
                />
              )}

              {activeDetailTab === 'hours' && (
                <div>
                  <HourHeatmap byHour={detailResult.summary.byHour} />
                  <div className="mt-4 space-y-1.5">
                    {Object.entries(detailResult.summary.byHour)
                      .filter(([, v]) => v.total >= 3)
                      .sort(([, a], [, b]) => b.accuracy - a.accuracy)
                      .slice(0, 8)
                      .map(([h, v]) => (
                        <TierRow key={h} label={`${String(h).padStart(2,'0')}:00 UTC`}
                          stats={{ total: v.total, correct: v.correct, accuracy: v.accuracy, avgConfidence: 0, avgPnl: 0 }} />
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!result && !loading && !error && (
            <div className="text-center py-10 text-gray-600">
              <div className="text-4xl mb-3">🔬</div>
              <div className="text-sm mb-1">Historical Simulation</div>
              <div className="text-xs space-y-1 text-gray-700">
                <div>ระบบจะดึง 1m klines ย้อนหลัง แล้ว simulate prediction ทุก 10 นาที</div>
                <div>ตรวจสอบว่า strategy ไหน แม่นยำที่สุดใน 10m / 30m</div>
                <div className="text-indigo-500 mt-2">💡 เริ่มจาก 1d + All strategies แล้วกด Run</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LIVE TRACKING TAB ──────────────────────────────────────────────── */}
      {tab === 'live' && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-gray-500">Predictions saved to Supabase &amp; verified</span>
            <div className="flex gap-1">
              {[12, 24, 48, 168].map((h) => (
                <button key={h} onClick={() => { setLiveHours(h); fetchLive(symbol, h) }}
                  className={`text-xs px-2 py-1 rounded-lg ${liveHours === h ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  {h < 48 ? `${h}h` : `${h / 24}d`}
                </button>
              ))}
            </div>
          </div>

          {liveLoading ? (
            <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-16 bg-gray-800 rounded-xl animate-pulse" />)}</div>
          ) : liveStats.length === 0 ? (
            <div className="text-gray-600 text-sm text-center py-6">
              No verified predictions in last {liveHours}h.<br />
              <span className="text-xs">Save predictions and wait for them to resolve.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {liveStats.map((s) => {
                const wc = accColor(s.winRate)
                const pc = s.totalPnlPct >= 0 ? '#22c55e' : '#ef4444'
                return (
                  <div key={`${s.symbol}-${s.timeframe}`} className="bg-gray-800/50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white text-xs font-bold">{s.symbol?.replace('USDT', '')} · {s.timeframe}</span>
                      <span className="text-xs font-bold" style={{ color: wc }}>{s.winRate.toFixed(1)}% Win Rate</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div><div className="text-gray-600">Trades</div><div className="text-gray-300">{s.total}</div></div>
                      <div><div className="text-gray-600">W/L</div><div className="text-gray-300">{s.wins}/{s.losses}</div></div>
                      <div><div className="text-gray-600">Total P&L</div><div className="font-bold" style={{ color: pc }}>{s.totalPnlPct >= 0 ? '+' : ''}{s.totalPnlPct.toFixed(2)}%</div></div>
                      <div><div className="text-gray-600">Sharpe</div><div style={{ color: s.sharpeProxy >= 0 ? '#22c55e' : '#ef4444' }}>{s.sharpeProxy.toFixed(2)}</div></div>
                    </div>
                    <div className="mt-2 bg-gray-700 rounded-full h-1">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.abs(s.totalPnlPct) * 10)}%`, background: pc }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
