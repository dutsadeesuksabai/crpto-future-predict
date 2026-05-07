/**
 * Historical Backtesting Engine
 *
 * Simulates predictions over a historical kline window and measures accuracy.
 * NOTE: Historical simulation cannot include Order Book, Funding Rate, Fear&Greed
 * or MTF data — those are real-time only. Results reflect indicator-only accuracy.
 */

import type { Kline } from './mexc'
import type { Strategy } from './strategies'
import { computeAllIndicators } from './indicators'
import { predict } from './predictor'

// ── Types ─────────────────────────────────────────────────────────────────────

export type BacktestTick = {
  idx: number            // position in klines array
  timestamp: number
  price: number          // price at prediction point
  priceFwd: number       // price at target time
  hour: number           // UTC hour (0-23)
  predictedDir: 'up' | 'down'
  actualDir: 'up' | 'down'
  correct: boolean
  confidence: number
  signalQuality: number
  filtersPassed: number  // 0-6
  consensusRatio: number
  bullScore: number
  pnlPct: number         // directional P&L %
}

export type TierStats = {
  total: number
  correct: number
  accuracy: number
  avgConfidence: number
  avgPnl: number
}

export type BacktestSummary = {
  total: number
  correct: number
  accuracy: number          // %
  avgConfidence: number
  avgQuality: number
  totalPnlPct: number       // cumulative directional P&L
  avgPnlPct: number
  sharpe: number            // simplified: mean/std of returns
  maxDrawdown: number       // max equity drop (%)
  profitFactor: number      // gross wins / gross losses

  byConfidence: Record<string, TierStats>   // '51-60', '60-70', '70-80', '80-90', '90+'
  byQuality: Record<string, TierStats>      // 'pure', 'clean', 'mixed', 'noisy'
  byDirection: Record<string, TierStats>    // 'up', 'down'
  byFilterCount: Record<number, TierStats>  // 0, 1, 2, 3, 4, 5, 6
  byHour: Record<number, { total: number; correct: number; accuracy: number }>

  equityCurve: number[]     // cumulative P&L at each tick
  bestCondition: string     // human-readable best performing filter
  worstCondition: string
}

export type BacktestResult = {
  symbol: string
  strategyId: string
  timeframeMin: number
  periodDays: number
  runAt: number
  summary: BacktestSummary
  ticks: BacktestTick[]
}

// ── Helper ────────────────────────────────────────────────────────────────────

function makeTierStats(): TierStats {
  return { total: 0, correct: 0, accuracy: 0, avgConfidence: 0, avgPnl: 0 }
}

function finalizeTierStats(t: TierStats & { _sumConf: number; _sumPnl: number }): TierStats {
  t.accuracy = t.total > 0 ? (t.correct / t.total) * 100 : 0
  t.avgConfidence = t.total > 0 ? t._sumConf / t.total : 0
  t.avgPnl = t.total > 0 ? t._sumPnl / t.total : 0
  return t
}

function qualityBucket(q: number): string {
  if (q >= 80) return 'pure'
  if (q >= 65) return 'clean'
  if (q >= 50) return 'mixed'
  return 'noisy'
}

function confBucket(c: number): string {
  if (c >= 90) return '90+'
  if (c >= 80) return '80-90'
  if (c >= 70) return '70-80'
  if (c >= 60) return '60-70'
  return '51-60'
}

// ── Core Backtester ────────────────────────────────────────────────────────────

/**
 * Run a full backtest simulation over `klines`.
 *
 * @param klines      Full historical klines (lookback + test window + fwd buffer)
 * @param timeframeMin  Prediction horizon in minutes (10 or 30)
 * @param strategy    Strategy to use for prediction
 * @param lookback    How many candles to use as input window (default 200)
 * @param step        How many candles between each prediction (default = timeframeMin)
 */
export function runBacktest(
  klines: Kline[],
  timeframeMin: 10 | 30,
  strategy: Strategy,
  lookback = 200,
  step?: number,
): BacktestResult {
  const stepSize = step ?? timeframeMin
  const ticks: BacktestTick[] = []

  // We need at least lookback + timeframeMin candles
  const minLen = lookback + timeframeMin
  if (klines.length < minLen) {
    throw new Error(`Need at least ${minLen} candles, got ${klines.length}`)
  }

  // ── Run prediction at each step position ─────────────────────────────────
  for (let i = lookback; i <= klines.length - timeframeMin; i += stepSize) {
    const window = klines.slice(i - lookback, i)
    const fwdCandle = klines[i + timeframeMin - 1]
    if (!fwdCandle) break

    const indicators = computeAllIndicators(window)
    const result = predict(indicators, {}, strategy)

    const price = klines[i - 1].close
    const priceFwd = fwdCandle.close
    const actualDir: 'up' | 'down' = priceFwd > price ? 'up' : 'down'
    const correct = result.direction === actualDir
    const dirMul = result.direction === 'up' ? 1 : -1
    const pnlPct = ((priceFwd - price) / price) * 100 * dirMul
    const hour = new Date(klines[i - 1].openTime).getUTCHours()
    const filtersPassed = Object.values(result.filters).filter(Boolean).length

    ticks.push({
      idx: i,
      timestamp: klines[i - 1].openTime,
      price,
      priceFwd,
      hour,
      predictedDir: result.direction,
      actualDir,
      correct,
      confidence: result.confidence,
      signalQuality: result.signalQuality,
      filtersPassed,
      consensusRatio: result.consensusRatio,
      bullScore: result.bullScore,
      pnlPct,
    })
  }

  // ── Compute summary ──────────────────────────────────────────────────────
  const summary = computeSummary(ticks, strategy.id)

  const periodMs = klines[klines.length - 1].closeTime - klines[lookback - 1].openTime
  const periodDays = periodMs / 86_400_000

  return {
    symbol: '',  // filled by caller
    strategyId: strategy.id,
    timeframeMin,
    periodDays,
    runAt: Date.now(),
    summary,
    ticks,
  }
}

/** Compute full summary stats from ticks */
export function computeSummary(ticks: BacktestTick[], _strategyId?: string): BacktestSummary {
  if (ticks.length === 0) {
    return {
      total: 0, correct: 0, accuracy: 0, avgConfidence: 0, avgQuality: 0,
      totalPnlPct: 0, avgPnlPct: 0, sharpe: 0, maxDrawdown: 0, profitFactor: 0,
      byConfidence: {}, byQuality: {}, byDirection: {}, byFilterCount: {}, byHour: {},
      equityCurve: [], bestCondition: 'N/A', worstCondition: 'N/A',
    }
  }

  const total = ticks.length
  const correct = ticks.filter((t) => t.correct).length
  const accuracy = (correct / total) * 100

  // ── By Confidence ────────────────────────────────────────────────────────
  const byConf: Record<string, TierStats & { _sumConf: number; _sumPnl: number }> = {}
  for (const bkt of ['51-60', '60-70', '70-80', '80-90', '90+']) {
    byConf[bkt] = { ...makeTierStats(), _sumConf: 0, _sumPnl: 0 }
  }

  // ── By Quality ───────────────────────────────────────────────────────────
  const byQual: Record<string, TierStats & { _sumConf: number; _sumPnl: number }> = {
    pure: { ...makeTierStats(), _sumConf: 0, _sumPnl: 0 },
    clean: { ...makeTierStats(), _sumConf: 0, _sumPnl: 0 },
    mixed: { ...makeTierStats(), _sumConf: 0, _sumPnl: 0 },
    noisy: { ...makeTierStats(), _sumConf: 0, _sumPnl: 0 },
  }

  // ── By Direction ─────────────────────────────────────────────────────────
  const byDir: Record<string, TierStats & { _sumConf: number; _sumPnl: number }> = {
    up: { ...makeTierStats(), _sumConf: 0, _sumPnl: 0 },
    down: { ...makeTierStats(), _sumConf: 0, _sumPnl: 0 },
  }

  // ── By Filter Count ──────────────────────────────────────────────────────
  const byFilt: Record<number, TierStats & { _sumConf: number; _sumPnl: number }> = {}
  for (let f = 0; f <= 6; f++) {
    byFilt[f] = { ...makeTierStats(), _sumConf: 0, _sumPnl: 0 }
  }

  // ── By Hour ──────────────────────────────────────────────────────────────
  const byHour: Record<number, { total: number; correct: number; accuracy: number }> = {}

  // ── Equity Curve + Drawdown ───────────────────────────────────────────────
  const equityCurve: number[] = []
  let cumPnl = 0
  let peak = 0
  let maxDrawdown = 0
  let grossWin = 0
  let grossLoss = 0

  let sumConf = 0, sumQual = 0, sumPnl = 0

  for (const t of ticks) {
    sumConf += t.confidence
    sumQual += t.signalQuality
    sumPnl  += t.pnlPct

    // Equity curve
    cumPnl += t.pnlPct
    equityCurve.push(Math.round(cumPnl * 100) / 100)
    if (cumPnl > peak) peak = cumPnl
    const dd = peak - cumPnl
    if (dd > maxDrawdown) maxDrawdown = dd

    // P&L buckets
    if (t.pnlPct > 0) grossWin += t.pnlPct
    else grossLoss += Math.abs(t.pnlPct)

    // Confidence bucket
    const cb = confBucket(t.confidence)
    const bc = byConf[cb]
    bc.total++; if (t.correct) bc.correct++
    bc._sumConf += t.confidence; bc._sumPnl += t.pnlPct

    // Quality bucket
    const qb = qualityBucket(t.signalQuality)
    const bq = byQual[qb]
    bq.total++; if (t.correct) bq.correct++
    bq._sumConf += t.confidence; bq._sumPnl += t.pnlPct

    // Direction
    const bd = byDir[t.predictedDir]
    bd.total++; if (t.correct) bd.correct++
    bd._sumConf += t.confidence; bd._sumPnl += t.pnlPct

    // Filter count
    const bf = byFilt[t.filtersPassed]
    bf.total++; if (t.correct) bf.correct++
    bf._sumConf += t.confidence; bf._sumPnl += t.pnlPct

    // Hour
    if (!byHour[t.hour]) byHour[t.hour] = { total: 0, correct: 0, accuracy: 0 }
    byHour[t.hour].total++
    if (t.correct) byHour[t.hour].correct++
  }

  // Finalize all TierStats
  for (const b of Object.values(byConf)) finalizeTierStats(b)
  for (const b of Object.values(byQual)) finalizeTierStats(b)
  for (const b of Object.values(byDir)) finalizeTierStats(b)
  for (const b of Object.values(byFilt)) finalizeTierStats(b)
  for (const h of Object.values(byHour)) {
    h.accuracy = h.total > 0 ? (h.correct / h.total) * 100 : 0
  }

  // Sharpe: mean(pnls) / std(pnls)
  const pnls = ticks.map((t) => t.pnlPct)
  const avgPnl = sumPnl / total
  const pnlStd = Math.sqrt(pnls.reduce((a, b) => a + Math.pow(b - avgPnl, 2), 0) / total) || 1
  const sharpe = avgPnl / pnlStd

  // Best/worst condition
  const condCandidates = [
    ...Object.entries(byConf).filter(([, v]) => v.total >= 5).map(([k, v]) => ({ label: `Confidence ${k}%`, acc: v.accuracy })),
    ...Object.entries(byQual).filter(([, v]) => v.total >= 5).map(([k, v]) => ({ label: `Quality ${k}`, acc: v.accuracy })),
    ...Object.entries(byFilt).filter(([, v]) => v.total >= 5).map(([k, v]) => ({ label: `${k}/6 filters`, acc: v.accuracy })),
  ].filter((c) => c.acc > 0)

  condCandidates.sort((a, b) => b.acc - a.acc)
  const bestCondition  = condCandidates[0]?.label ?? 'N/A'
  const worstCondition = condCandidates[condCandidates.length - 1]?.label ?? 'N/A'

  return {
    total,
    correct,
    accuracy: Math.round(accuracy * 10) / 10,
    avgConfidence: Math.round((sumConf / total) * 10) / 10,
    avgQuality: Math.round((sumQual / total) * 10) / 10,
    totalPnlPct: Math.round(sumPnl * 100) / 100,
    avgPnlPct: Math.round(avgPnl * 1000) / 1000,
    sharpe: Math.round(sharpe * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    profitFactor: grossLoss > 0 ? Math.round((grossWin / grossLoss) * 100) / 100 : grossWin > 0 ? 99 : 0,
    byConfidence: byConf,
    byQuality: byQual,
    byDirection: byDir,
    byFilterCount: byFilt,
    byHour,
    equityCurve,
    bestCondition,
    worstCondition,
  }
}
