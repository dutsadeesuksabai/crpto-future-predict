'use client'

import { useState, useCallback } from 'react'
import type { BacktestResult, BacktestSummary, TierStats } from '@/lib/backtester'
import { STRATEGIES } from '@/lib/strategies'

// ── Types from API ─────────────────────────────────────────────────────────────

type ComparisonRow = {
  strategyId: string
  name: string
  emoji: string
  accentColor: string
  '10m': { accuracy: number; total: number; sharpe: number; totalPnl: number; profitFactor: number } | null
  '30m': { accuracy: number; total: number; sharpe: number; totalPnl: number; profitFactor: number } | null
}

type SimResponse = {
  symbol: string
  days: number
  klineCount: number
  runAt: number
  comparison: ComparisonRow[]
  results: Record<string, Record<number, BacktestResult>>
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function AccuracyBadge({ acc, total }: { acc: number; total: number }) {
  const color = acc >= 60 ? '#22c55e' : acc >= 53 ? '#f59e0b' : '#ef4444'
  return (
    <div className="text-center">
      <div className="text-lg font-black" style={{ color }}>{acc.toFixed(1)}%</div>
      <div className="text-xs text-gray-600">n={total}</div>
    </div>
  )
}

function MiniEquityCurve({ curve, color }: { curve: number[]; color: string }) {
  if (curve.length < 2) return null
  const min = Math.min(...curve, 0)
  const max = Math.max(...curve, 0.001)
  const range = max - min || 1
  const w = 80, h = 28
  const pts = curve.map((v, i) => `${(i / (curve.length - 1)) * w},${h - ((v - min) / range) * h}`)
  const zeroY = h - ((0 - min) / range) * h

  return (
    <svg width={w} height={h} className="block">
      <line x1={0} y1={zeroY} x2={w} y2={zeroY} stroke="#374151" strokeWidth={0.5} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.5} opacity={0.8} />
    </svg>
  )
}

function TierRow({ label, stats, metric = 'accuracy' }: { label: string; stats: TierStats; metric?: string }) {
  if (!stats || stats.total < 3) return null
  const color = stats.accuracy >= 60 ? '#22c55e' : stats.accuracy >= 53 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-500 w-24 truncate shrink-0">{label}</span>
      <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden relative">
        <div className="absolute inset-y-0 left-0 bg-gray-700" style={{ width: '50%' }} />
        <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${stats.accuracy}%`, background: color }} />
      </div>
      <span className="text-gray-400 w-12 text-right font-medium shrink-0" style={{ color }}>
        {stats.accuracy.toFixed(0)}%
      </span>
      <span className="text-gray-600 w-8 text-right shrink-0">n={stats.total}</span>
    </div>
  )
}

function HourHeatmap({ byHour }: { byHour: Record<number, { total: number; correct: number; accuracy: number }> }) {
  const hours = Array.from({ length: 24 }, (_, i) => i)
  return (
    <div>
      <div className="text-xs text-gray-600 mb-1.5">Accuracy by UTC hour (darker = more trades)</div>
      <div className="grid grid-cols-12 gap-0.5">
        {hours.map((h) => {
          const d = byHour[h]
          const acc = d?.accuracy ?? 0
          const n = d?.total ?? 0
          const color = n === 0 ? '#1f2937'
            : acc >= 65 ? `rgba(34,197,94,${Math.min(1, 0.3 + n / 20)})`
            : acc >= 55 ? `rgba(245,158,11,${Math.min(1, 0.3 + n / 20)})`
            : `rgba(239,68,68,${Math.min(1, 0.3 + n / 20)})`
          return (
            <div key={h} title={`${h}:00 UTC — acc ${acc.toFixed(0)}% (n=${n})`}
              className="flex flex-col items-center gap-0.5 cursor-default">
              <div className="w-full rounded-sm" style={{ height: 16, background: color }} />
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
    { label: 'Accuracy', value: `${s.accuracy.toFixed(1)}%`, color: s.accuracy >= 60 ? '#22c55e' : s.accuracy >= 53 ? '#f59e0b' : '#ef4444' },
    { label: 'Signals', value: String(s.total), color: '#9ca3af' },
    { label: 'Total P&L', value: `${s.totalPnlPct >= 0 ? '+' : ''}${s.totalPnlPct.toFixed(2)}%`, color: s.totalPnlPct >= 0 ? '#22c55e' : '#ef4444' },
    { label: 'Sharpe', value: s.sharpe.toFixed(2), color: s.sharpe >= 0.5 ? '#22c55e' : s.sharpe >= 0 ? '#f59e0b' : '#ef4444' },
    { label: 'Profit Factor', value: s.profitFactor.toFixed(2), color: s.profitFactor >= 1.3 ? '#22c55e' : s.profitFactor >= 1 ? '#f59e0b' : '#ef4444' },
    { label: 'Max Drawdown', value: `-${s.maxDrawdown.toFixed(2)}%`, color: s.maxDrawdown > 5 ? '#ef4444' : '#f59e0b' },
    { label: 'Avg Conf', value: `${s.avgConfidence.toFixed(1)}%`, color: '#9ca3af' },
    { label: 'Avg Quality', value: `${s.avgQuality.toFixed(1)}`, color: '#9ca3af' },
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

// ── Main Panel ─────────────────────────────────────────────────────────────────

type DetailView = { stratId: string; tf: 10 | 30 }

export function BacktestRunnerPanel({ symbol }: { symbol: string }) {
  const [tab, setTab] = useState<'simulation' | 'live'>('simulation')
  const [days, setDays] = useState(1)
  const [selectedStratIds, setSelectedStratIds] = useState<string[]>(STRATEGIES.map((s) => s.id))
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<SimResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [detailView, setDetailView] = useState<DetailView | null>(null)
  const [activeDetailTab, setActiveDetailTab] = useState<'breakdown' | 'equity' | 'hours'>('breakdown')

  // ── Live backtest state (from saved predictions) ──────────────────────────
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

  // Run simulation
  const runSim = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setDetailView(null)
    setProgress(`Fetching ${days}d of ${symbol} klines…`)

    try {
      setProgress('Running predictions on historical data…')
      const params = new URLSearchParams({
        symbol,
        days: String(days),
        strategies: selectedStratIds.join(','),
      })
      const res = await fetch(`/api/backtest/simulate?${params}`)
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error ?? `HTTP ${res.status}`)
      }
      const data: SimResponse = await res.json()
      setResult(data)
      setProgress('')
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [symbol, days, selectedStratIds])

  // ── Detail view for a specific strategy + timeframe ──────────────────────
  const detailResult: BacktestResult | null =
    detailView ? result?.results?.[detailView.stratId]?.[detailView.tf] ?? null : null

  const strat = STRATEGIES.find((s) => s.id === detailView?.stratId)

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      {/* Panel Header + Tabs */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <span className="text-gray-300 text-sm font-bold">📊 Backtest &amp; Analysis</span>
        <div className="flex gap-1">
          {(['simulation', 'live'] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); if (t === 'live') fetchLive(symbol, liveHours) }}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {t === 'simulation' ? '⏱ Simulation' : '📈 Live Tracking'}
            </button>
          ))}
        </div>
      </div>

      {/* ── SIMULATION TAB ──────────────────────────────────────────────── */}
      {tab === 'simulation' && (
        <div className="p-4">
          {/* Controls */}
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <div className="text-xs text-gray-600 mb-1">Period</div>
              <div className="flex gap-1">
                {[0.5, 1, 2, 3].map((d) => (
                  <button key={d} onClick={() => setDays(d)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${days === d ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                    {d < 1 ? '12h' : `${d}d`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1">
              <div className="text-xs text-gray-600 mb-1">Strategies to test</div>
              <div className="flex flex-wrap gap-1">
                {STRATEGIES.map((s) => {
                  const sel = selectedStratIds.includes(s.id)
                  return (
                    <button key={s.id}
                      onClick={() => setSelectedStratIds((prev) =>
                        sel ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                      )}
                      className="text-xs px-2 py-1 rounded-lg transition-all border"
                      style={{
                        background: sel ? `${s.accentColor}22` : 'rgba(31,41,55,1)',
                        borderColor: sel ? s.accentColor : 'rgba(55,65,81,1)',
                        color: sel ? s.accentColor : '#6b7280',
                      }}>
                      {s.emoji} {s.name}
                    </button>
                  )
                })}
              </div>
            </div>

            <button onClick={runSim} disabled={loading || selectedStratIds.length === 0}
              className={`text-sm px-5 py-2 rounded-xl font-bold transition-all ${
                loading ? 'bg-gray-700 text-gray-500 cursor-wait' : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95'
              }`}>
              {loading ? '⏳ Running…' : '▶ Run Simulation'}
            </button>
          </div>

          {/* Progress */}
          {loading && progress && (
            <div className="flex items-center gap-2 text-xs text-blue-400 mb-3">
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              {progress}
            </div>
          )}

          {/* Error */}
          {error && <div className="text-red-400 text-xs bg-red-900/20 rounded-xl px-4 py-3 mb-3">{error}</div>}

          {/* ── Results ─────────────────────────────────────────────────── */}
          {result && !detailView && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500">
                  {result.klineCount} candles · {result.days}d · {result.comparison.length} strategies
                </span>
                <span className="text-xs text-gray-600">{new Date(result.runAt).toLocaleTimeString()}</span>
              </div>

              {/* ── Strategy Comparison Table ────────────────────────── */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-600 border-b border-gray-800">
                      <th className="text-left py-2 pr-3 font-medium">Strategy</th>
                      <th className="text-center py-2 px-2 font-medium" colSpan={3}>10-minute</th>
                      <th className="text-center py-2 px-2 font-medium" colSpan={3}>30-minute</th>
                    </tr>
                    <tr className="text-gray-600 border-b border-gray-800">
                      <th />
                      <th className="text-center py-1 px-2">Accuracy</th>
                      <th className="text-center py-1 px-2">P&L%</th>
                      <th className="text-center py-1 px-2">Sharpe</th>
                      <th className="text-center py-1 px-2">Accuracy</th>
                      <th className="text-center py-1 px-2">P&L%</th>
                      <th className="text-center py-1 px-2">Sharpe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.comparison.map((row, rank) => {
                      const avg10 = row['10m']?.accuracy ?? 0
                      const avg30 = row['30m']?.accuracy ?? 0
                      const avgAcc = (avg10 + avg30) / 2
                      const isTop = rank === 0
                      return (
                        <tr key={row.strategyId}
                          className="border-b border-gray-800/50 hover:bg-gray-800/40 cursor-pointer transition-colors"
                          style={isTop ? { background: 'rgba(34,197,94,0.06)' } : {}}>
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-2">
                              {isTop && <span className="text-green-400 text-xs">🏆</span>}
                              <span style={{ color: row.accentColor }}>{row.emoji}</span>
                              <span className="text-gray-300 font-medium">{row.name}</span>
                              <span className="text-gray-600 text-xs hidden sm:block">avg {avgAcc.toFixed(0)}%</span>
                            </div>
                          </td>
                          {/* 10m */}
                          {row['10m'] ? <>
                            <td className="text-center py-2 px-2">
                              <button
                                onClick={() => setDetailView({ stratId: row.strategyId, tf: 10 })}
                                className="hover:underline"
                                style={{ color: row['10m'].accuracy >= 60 ? '#22c55e' : row['10m'].accuracy >= 53 ? '#f59e0b' : '#ef4444' }}>
                                {row['10m'].accuracy.toFixed(1)}%
                              </button>
                            </td>
                            <td className="text-center py-2 px-2" style={{ color: row['10m'].totalPnl >= 0 ? '#22c55e' : '#ef4444' }}>
                              {row['10m'].totalPnl >= 0 ? '+' : ''}{row['10m'].totalPnl.toFixed(2)}%
                            </td>
                            <td className="text-center py-2 px-2" style={{ color: row['10m'].sharpe >= 0 ? '#22c55e' : '#ef4444' }}>
                              {row['10m'].sharpe.toFixed(2)}
                            </td>
                          </> : <><td colSpan={3} className="text-center text-gray-700 py-2">—</td></>}
                          {/* 30m */}
                          {row['30m'] ? <>
                            <td className="text-center py-2 px-2">
                              <button
                                onClick={() => setDetailView({ stratId: row.strategyId, tf: 30 })}
                                className="hover:underline"
                                style={{ color: row['30m'].accuracy >= 60 ? '#22c55e' : row['30m'].accuracy >= 53 ? '#f59e0b' : '#ef4444' }}>
                                {row['30m'].accuracy.toFixed(1)}%
                              </button>
                            </td>
                            <td className="text-center py-2 px-2" style={{ color: row['30m'].totalPnl >= 0 ? '#22c55e' : '#ef4444' }}>
                              {row['30m'].totalPnl >= 0 ? '+' : ''}{row['30m'].totalPnl.toFixed(2)}%
                            </td>
                            <td className="text-center py-2 px-2" style={{ color: row['30m'].sharpe >= 0 ? '#22c55e' : '#ef4444' }}>
                              {row['30m'].sharpe.toFixed(2)}
                            </td>
                          </> : <><td colSpan={3} className="text-center text-gray-700 py-2">—</td></>}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <p className="text-gray-700 text-xs mt-3">
                ⚠ Simulation uses indicator signals only (no Order Book / Funding Rate). Click any accuracy % for full breakdown.
              </p>
            </div>
          )}

          {/* ── Detail View ──────────────────────────────────────────────── */}
          {detailView && detailResult && strat && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => setDetailView(null)}
                  className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1 bg-gray-800 px-2.5 py-1.5 rounded-lg">
                  ← Back
                </button>
                <span style={{ color: strat.accentColor }} className="text-sm font-bold">
                  {strat.emoji} {strat.name} · {detailView.tf}m
                </span>
                <span className="text-xs text-gray-600 ml-auto">{detailResult.summary.total} signals · {result?.days}d</span>
              </div>

              {/* Summary cards */}
              <div className="mb-4">
                <SummaryCards s={detailResult.summary} />
              </div>

              {/* Best / Worst condition hint */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-green-900/20 border border-green-900/40 rounded-xl px-3 py-2">
                  <div className="text-xs text-green-500 font-medium mb-0.5">✅ Best condition</div>
                  <div className="text-xs text-green-400">{detailResult.summary.bestCondition}</div>
                </div>
                <div className="bg-red-900/20 border border-red-900/40 rounded-xl px-3 py-2">
                  <div className="text-xs text-red-500 font-medium mb-0.5">⚠️ Worst condition</div>
                  <div className="text-xs text-red-400">{detailResult.summary.worstCondition}</div>
                </div>
              </div>

              {/* Detail tabs */}
              <div className="flex gap-1 mb-4">
                {(['breakdown', 'equity', 'hours'] as const).map((t) => (
                  <button key={t} onClick={() => setActiveDetailTab(t)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${activeDetailTab === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                    {t === 'breakdown' ? '📋 Breakdown' : t === 'equity' ? '📈 Equity Curve' : '🕐 By Hour'}
                  </button>
                ))}
              </div>

              {/* Breakdown tab */}
              {activeDetailTab === 'breakdown' && (
                <div className="space-y-5">
                  <div>
                    <div className="text-xs text-gray-500 font-medium mb-2">By Confidence Level</div>
                    <div className="space-y-1.5">
                      {Object.entries(detailResult.summary.byConfidence).map(([k, v]) => (
                        <TierRow key={k} label={`${k}%`} stats={v} />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 font-medium mb-2">By Signal Quality</div>
                    <div className="space-y-1.5">
                      {[
                        { k: 'pure',  label: '🟣 Pure (Q≥80)' },
                        { k: 'clean', label: '🟢 Clean (Q65-79)' },
                        { k: 'mixed', label: '🟡 Mixed (Q50-64)' },
                        { k: 'noisy', label: '⚪ Noisy (Q<50)' },
                      ].map(({ k, label }) => (
                        <TierRow key={k} label={label} stats={detailResult.summary.byQuality[k]} />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 font-medium mb-2">By Filters Passed (0–6)</div>
                    <div className="space-y-1.5">
                      {[6, 5, 4, 3, 2, 1, 0].map((f) => (
                        <TierRow key={f} label={`${f}/6 filters ✓`} stats={detailResult.summary.byFilterCount[f]} />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 font-medium mb-2">By Direction</div>
                    <div className="space-y-1.5">
                      <TierRow label="▲ ขึ้น (Long)" stats={detailResult.summary.byDirection['up']} />
                      <TierRow label="▼ ลง (Short)" stats={detailResult.summary.byDirection['down']} />
                    </div>
                  </div>
                </div>
              )}

              {/* Equity Curve tab */}
              {activeDetailTab === 'equity' && (
                <div>
                  <div className="text-xs text-gray-600 mb-3">
                    Cumulative directional P&L over simulation period (assumes 1× leverage, no fees)
                  </div>
                  <EquityCurveChart
                    curve={detailResult.summary.equityCurve}
                    color={strat.accentColor}
                    ticks={detailResult.ticks}
                  />
                </div>
              )}

              {/* Hours tab */}
              {activeDetailTab === 'hours' && (
                <div>
                  <HourHeatmap byHour={detailResult.summary.byHour} />
                  <div className="mt-4 space-y-1.5">
                    {Object.entries(detailResult.summary.byHour)
                      .filter(([, v]) => v.total >= 2)
                      .sort(([, a], [, b]) => b.accuracy - a.accuracy)
                      .slice(0, 8)
                      .map(([h, v]) => (
                        <TierRow key={h} label={`${h}:00–${(parseInt(h) + 1) % 24}:00 UTC`}
                          stats={{ total: v.total, correct: v.correct, accuracy: v.accuracy, avgConfidence: 0, avgPnl: 0 }} />
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Initial empty state */}
          {!result && !loading && !error && (
            <div className="text-center py-8 text-gray-600 text-sm">
              <div className="text-3xl mb-2">🔬</div>
              เลือก Period + Strategy แล้วกด Run Simulation<br />
              <span className="text-xs">ระบบจะดึง kline ย้อนหลัง แล้ว simulate prediction ทุก 10/30 นาที</span>
            </div>
          )}
        </div>
      )}

      {/* ── LIVE TRACKING TAB ───────────────────────────────────────────────── */}
      {tab === 'live' && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-gray-500">Predictions saved to Supabase &amp; verified</span>
            <div className="flex gap-1">
              {[12, 24, 48, 168].map((h) => (
                <button key={h} onClick={() => { setLiveHours(h); fetchLive(symbol, h) }}
                  className={`text-xs px-2 py-1 rounded-lg transition-colors ${liveHours === h ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
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
                const winColor = s.winRate >= 60 ? '#22c55e' : s.winRate >= 50 ? '#f59e0b' : '#ef4444'
                const pnlColor = s.totalPnlPct >= 0 ? '#22c55e' : '#ef4444'
                return (
                  <div key={`${s.symbol}-${s.timeframe}`} className="bg-gray-800/50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white text-xs font-bold">{s.symbol?.replace('USDT', '')} · {s.timeframe}</span>
                      <span className="text-xs font-bold" style={{ color: winColor }}>{s.winRate.toFixed(1)}% Win Rate</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div><div className="text-gray-600">Trades</div><div className="text-gray-300 font-medium">{s.total}</div></div>
                      <div><div className="text-gray-600">W/L</div><div className="text-gray-300 font-medium">{s.wins}/{s.losses}</div></div>
                      <div><div className="text-gray-600">Total P&L</div><div className="font-bold" style={{ color: pnlColor }}>{s.totalPnlPct >= 0 ? '+' : ''}{s.totalPnlPct.toFixed(2)}%</div></div>
                      <div><div className="text-gray-600">Sharpe</div><div className="font-medium" style={{ color: s.sharpeProxy >= 0 ? '#22c55e' : '#ef4444' }}>{s.sharpeProxy.toFixed(2)}</div></div>
                    </div>
                    <div className="mt-2 bg-gray-700 rounded-full h-1 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.abs(s.totalPnlPct) * 10)}%`, background: pnlColor }} />
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

// ── Equity Curve Chart ─────────────────────────────────────────────────────────

function EquityCurveChart({ curve, color, ticks }: {
  curve: number[]
  color: string
  ticks: { timestamp: number; correct: boolean; pnlPct: number }[]
}) {
  if (curve.length < 2) return <div className="text-gray-600 text-xs text-center py-4">Not enough data</div>

  const W = 600, H = 120
  const min = Math.min(...curve, 0) - 0.5
  const max = Math.max(...curve, 0) + 0.5
  const range = max - min || 1
  const zeroY = H - ((0 - min) / range) * H

  const pts = curve.map((v, i) =>
    `${(i / (curve.length - 1)) * W},${H - ((v - min) / range) * H}`
  ).join(' ')

  const fillPts = `0,${zeroY} ${pts} ${W},${zeroY}`

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" style={{ minWidth: 300 }}>
        {/* Zero line */}
        <line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke="#374151" strokeWidth={1} strokeDasharray="4,4" />

        {/* Filled area */}
        <polygon points={fillPts} fill={curve[curve.length - 1] >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)'} />

        {/* Equity line */}
        <polyline points={pts} fill="none" stroke={color} strokeWidth={2} />

        {/* Win/Loss dots */}
        {ticks.map((t, i) => {
          if (i >= curve.length) return null
          const x = (i / (curve.length - 1)) * W
          const y = H - ((curve[i] - min) / range) * H
          return (
            <circle key={i} cx={x} cy={y} r={2.5}
              fill={t.correct ? '#22c55e' : '#ef4444'} opacity={0.7} />
          )
        })}

        {/* Labels */}
        <text x={4} y={14} fontSize={9} fill="#6b7280">+{max.toFixed(2)}%</text>
        <text x={4} y={H - 4} fontSize={9} fill="#6b7280">{min.toFixed(2)}%</text>
        <text x={W - 4} y={H + 16} fontSize={9} fill="#6b7280" textAnchor="end">
          Final: {curve[curve.length - 1] >= 0 ? '+' : ''}{curve[curve.length - 1].toFixed(2)}%
        </text>
      </svg>
      <div className="flex gap-4 text-xs text-gray-600 mt-1">
        <span><span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1" />Correct prediction</span>
        <span><span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-1" />Wrong prediction</span>
        <span className="ml-auto">Assumes equal position size per trade</span>
      </div>
    </div>
  )
}

// ── Mini component used in comparison table ────────────────────────────────────
// (already defined inline above as AccuracyBadge + MiniEquityCurve)
// kept here for future use
void AccuracyBadge
void MiniEquityCurve
