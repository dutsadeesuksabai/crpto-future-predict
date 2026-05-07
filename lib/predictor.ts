import type { IndicatorSet } from './indicators'
import type { Strategy } from './strategies'

export type Signal = {
  name: string
  value: number         // raw display value
  score: number         // 0-100 (100=max bullish, 0=max bearish, 50=neutral)
  interpretation: string
  weight: number        // effective weight after gates applied
  bullish: boolean      // score > 50
}

export type PredictionFilters = {
  trendStrong: boolean      // ADX ≥ 20 — market is trending not ranging
  volumeConfirmed: boolean  // volume supports the predicted direction
  consensusClean: boolean   // ≥ 60% of weighted signals agree
  noStrongConflict: boolean // no extreme counter-signal (e.g. RSI 85 on bullish)
  candleAligned: boolean    // recent candle bodies confirm direction
  noDivergence: boolean     // no RSI divergence against direction
}

export type PredictionResult = {
  direction: 'up' | 'down'
  confidence: number
  bullScore: number
  bearScore: number
  signals: Signal[]
  // Quality metrics
  signalQuality: number    // 0-100: overall signal purity score
  consensusRatio: number   // 0-1: fraction of weighted signals agreeing
  adxStrength: number      // ADX value (trend strength)
  filters: PredictionFilters
  strategyId: string       // which strategy produced this prediction
}

export type ExtraSignals = {
  orderBook?: number
  fundingRate?: number
  fearGreed?: number
  mtfConsensus?: number
}

/**
 * Smooth oscillator → bullish score.
 * val ∈ [0,100], oversold zone → high bullish, overbought zone → low bullish.
 * Returns 0-100 where 100 = extremely bullish, 0 = extremely bearish, 50 = neutral.
 */
function osc(val: number, oversold = 30, overbought = 70): number {
  const v = Math.max(0, Math.min(100, val))
  if (v <= oversold) {
    // Oversold: 0→100, oversold→85
    return 85 + ((oversold - v) / oversold) * 15
  }
  if (v >= overbought) {
    // Overbought: overbought→15, 100→0
    return ((100 - v) / (100 - overbought)) * 15
  }
  // Neutral zone: linear 85 → 15
  return 85 - ((v - oversold) / (overbought - oversold)) * 70
}

/**
 * Curved confidence: maps a weighted bull score [0,100] to a confidence [51,95].
 * Uses power curve so moderate signals stay low (60-70%) and only very strong
 * consensus pushes into 80-90%+ territory.
 */
function curveConfidence(bullScore: number): number {
  const distance = Math.abs(bullScore - 50) // 0-50
  const norm = distance / 50                // 0-1
  const curved = Math.pow(norm, 0.8)        // power curve (gentler than linear)
  return 50 + curved * 45                   // 50-95
}

export function predict(ind: IndicatorSet, extra: ExtraSignals = {}, strategy?: Strategy): PredictionResult {

  // ── STRATEGY WEIGHT MULTIPLIERS ─────────────────────────────────────────────
  const wm = strategy?.weightMult ?? {
    oscillators: 1, trend: 1, volume: 1, momentum: 1, vwap: 1,
    divergence: 1, fundingRate: 1, fearGreed: 1, mtf: 1,
  }
  const stratId = strategy?.id ?? 'balanced'

  // ── GATE MODIFIERS ──────────────────────────────────────────────────────────

  // ADX gate: trend signals (MACD, EMA) are unreliable in ranging market
  const adx = ind.adx ?? 20
  const adxGate = adx >= 30 ? 1.0
                : adx >= 20 ? 0.6 + (adx - 20) / 10 * 0.4
                : 0.4  // ranging market — trend signals count less

  // Volume gate: if volume is neutral (no directional conviction), reduce weights
  const volNeutral = ind.volumeScore >= 44 && ind.volumeScore <= 56
  const volGate = volNeutral ? 0.75 : 1.0

  // BB squeeze gate: in squeeze, breakout direction is unknown
  const bbBW = ind.bbBandwidth ?? 2
  const inSqueeze = bbBW < 1.2
  const squeezeGate = inSqueeze ? 0.65 : 1.0

  // ── BUILD SIGNALS ───────────────────────────────────────────────────────────

  const signals: Signal[] = []

  // RSI — mean-reversion oscillator (weight 18)
  {
    const score = osc(ind.rsi, 30, 70)
    const note  = ind.rsi < 22 ? 'Extreme oversold' : ind.rsi < 35 ? 'Oversold'
                : ind.rsi > 78 ? 'Extreme overbought' : ind.rsi > 65 ? 'Overbought' : 'Neutral'
    signals.push({ name: 'RSI', value: Math.round(ind.rsi * 10) / 10, score, interpretation: note, weight: 18 * wm.oscillators, bullish: score > 50 })
  }

  // MACD — trend-following (weight 20, gated by ADX)
  {
    const normHist = ind.atr > 0 ? ind.macdHistogram / ind.atr : 0
    const score    = Math.max(0, Math.min(100, 50 + normHist * 160))
    const note     = normHist > 0.12 ? 'Strong bullish' : normHist > 0.02 ? 'Bullish'
                   : normHist < -0.12 ? 'Strong bearish' : normHist < -0.02 ? 'Bearish' : 'Flat'
    signals.push({ name: 'MACD', value: Math.round(ind.macdHistogram * 10000) / 10000, score, interpretation: note, weight: 20 * adxGate * wm.trend, bullish: score > 50 })
  }

  // Bollinger Bands — mean-reversion / volatility (weight 14, reduced in squeeze)
  {
    const score = osc(ind.bbPosition, 20, 80)
    const note  = ind.bbPosition < 12 ? 'Extreme oversold' : ind.bbPosition < 30 ? 'Near lower band'
                : ind.bbPosition > 88 ? 'Extreme overbought' : ind.bbPosition > 70 ? 'Near upper band' : 'Mid-range'
    signals.push({ name: 'Bollinger Bands', value: Math.round(ind.bbPosition * 10) / 10, score, interpretation: note, weight: 14 * squeezeGate * wm.oscillators, bullish: score > 50 })
  }

  // StochRSI — short-term momentum oscillator (weight 14)
  {
    const score = osc(ind.stochRSI, 20, 80)
    const note  = ind.stochRSI < 10 ? 'Extreme oversold' : ind.stochRSI < 25 ? 'Oversold'
                : ind.stochRSI > 90 ? 'Extreme overbought' : ind.stochRSI > 75 ? 'Overbought' : 'Neutral'
    signals.push({ name: 'StochRSI', value: Math.round(ind.stochRSI * 10) / 10, score, interpretation: note, weight: 14 * wm.oscillators, bullish: score > 50 })
  }

  // EMA Cross — trend structure (weight 18, gated by ADX)
  {
    const score = ind.emaCross
    const note  = ind.emaCross > 78 ? 'Strong bull align' : ind.emaCross > 58 ? 'Bull alignment'
                : ind.emaCross < 22 ? 'Strong bear align' : ind.emaCross < 42 ? 'Bear alignment' : 'Neutral cross'
    signals.push({ name: 'EMA Cross 9/21/50', value: Math.round(ind.emaCross * 10) / 10, score, interpretation: note, weight: 18 * adxGate * wm.trend, bullish: score > 50 })
  }

  // Volume — directional volume (weight 10, uses vol gate)
  {
    const score = ind.volumeScore
    const note  = ind.volumeScore > 65 ? 'High bull volume' : ind.volumeScore > 55 ? 'Above avg'
                : ind.volumeScore < 35 ? 'High bear volume' : ind.volumeScore < 45 ? 'Below avg' : 'Normal'
    signals.push({ name: 'Volume', value: Math.round(ind.volumeScore * 10) / 10, score, interpretation: note, weight: 10 * volGate * wm.volume, bullish: score > 50 })
  }

  // Price Momentum (weight 10)
  {
    const score = ind.momentum
    const note  = ind.momentum > 68 ? 'Strong upward' : ind.momentum > 55 ? 'Upward'
                : ind.momentum < 32 ? 'Strong downward' : ind.momentum < 45 ? 'Downward' : 'Neutral'
    signals.push({ name: 'Momentum', value: Math.round(ind.momentum * 10) / 10, score, interpretation: note, weight: 10 * wm.momentum, bullish: score > 50 })
  }

  // VWAP position — institutional reference price (weight 12)
  {
    const score = osc(ind.vwapPosition, 30, 70)
    const note  = ind.vwapPosition > 72 ? 'Well above VWAP' : ind.vwapPosition > 55 ? 'Above VWAP'
                : ind.vwapPosition < 28 ? 'Well below VWAP' : 'Below VWAP'
    signals.push({ name: 'VWAP', value: Math.round(ind.vwapPosition * 10) / 10, score, interpretation: note, weight: 12 * wm.vwap, bullish: score > 50 })
  }

  // Candle Pattern — body momentum (weight 10)
  {
    const score = ind.candleStrength
    const note  = ind.candleStrength > 70 ? 'Strong bull candles' : ind.candleStrength > 55 ? 'Bull candles'
                : ind.candleStrength < 30 ? 'Strong bear candles' : ind.candleStrength < 45 ? 'Bear candles' : 'Doji / indecision'
    signals.push({ name: 'Candle Pattern', value: Math.round(ind.candleStrength * 10) / 10, score, interpretation: note, weight: 10 * wm.momentum, bullish: score > 50 })
  }

  // RSI Divergence — early reversal warning (weight 12 when detected)
  if (ind.rsiDivergence !== 0) {
    const bullDiv = ind.rsiDivergence > 0
    signals.push({
      name: 'RSI Divergence',
      value: ind.rsiDivergence,
      score: bullDiv ? 80 : 20,
      interpretation: bullDiv ? 'Bullish divergence' : 'Bearish divergence',
      weight: 12 * wm.divergence,
      bullish: bullDiv,
    })
  }

  // Order Book Imbalance (weight 18)
  if (extra.orderBook !== undefined) {
    const note = extra.orderBook > 65 ? 'Strong bid pressure' : extra.orderBook < 35 ? 'Strong ask pressure' : 'Balanced book'
    signals.push({ name: 'Order Book', value: Math.round(extra.orderBook * 10) / 10, score: extra.orderBook, interpretation: note, weight: 18 * wm.volume, bullish: extra.orderBook > 50 })
  }

  // Funding Rate — contrarian (weight 12)
  if (extra.fundingRate !== undefined) {
    const note = extra.fundingRate > 70 ? 'Shorts overcrowded' : extra.fundingRate < 30 ? 'Longs overcrowded' : 'Neutral funding'
    signals.push({ name: 'Funding Rate', value: Math.round(extra.fundingRate * 10) / 10, score: extra.fundingRate, interpretation: note, weight: 12 * wm.fundingRate, bullish: extra.fundingRate > 50 })
  }

  // Fear & Greed — macro sentiment (weight 8)
  if (extra.fearGreed !== undefined) {
    const note = extra.fearGreed >= 80 ? 'Extreme Fear (buy)' : extra.fearGreed >= 60 ? 'Fear zone'
               : extra.fearGreed <= 20 ? 'Extreme Greed (sell)' : extra.fearGreed <= 40 ? 'Greed zone' : 'Neutral sentiment'
    signals.push({ name: 'Fear & Greed', value: Math.round(extra.fearGreed * 10) / 10, score: extra.fearGreed, interpretation: note, weight: 8 * wm.fearGreed, bullish: extra.fearGreed > 50 })
  }

  // Multi-timeframe Consensus — structural confirmation (weight 22)
  if (extra.mtfConsensus !== undefined) {
    const note = extra.mtfConsensus > 72 ? 'All TFs bullish' : extra.mtfConsensus < 28 ? 'All TFs bearish' : 'Mixed timeframes'
    signals.push({ name: 'MTF Consensus', value: Math.round(extra.mtfConsensus * 10) / 10, score: extra.mtfConsensus, interpretation: note, weight: 22 * wm.mtf, bullish: extra.mtfConsensus > 50 })
  }

  // ── WEIGHTED SCORE ──────────────────────────────────────────────────────────

  const totalWeight = signals.reduce((a, s) => a + s.weight, 0)
  const weightedBull = signals.reduce((a, s) => a + s.score * s.weight, 0) / totalWeight

  const direction: 'up' | 'down' = weightedBull >= 50 ? 'up' : 'down'
  const bullScore = weightedBull
  const bearScore = 100 - bullScore

  // ── CONSENSUS RATIO ─────────────────────────────────────────────────────────

  const agreeWeight = signals
    .filter((s) => s.bullish === (direction === 'up'))
    .reduce((a, s) => a + s.weight, 0)
  const consensusRatio = agreeWeight / totalWeight  // 0.5 to ~1.0

  // ── FILTER CHECKS ───────────────────────────────────────────────────────────

  const trendStrong      = adx >= 20
  const volumeConfirmed  = direction === 'up' ? ind.volumeScore >= 48 : ind.volumeScore <= 52
  const consensusClean   = consensusRatio >= (strategy?.consensusMin ?? 0.60)
  const noStrongConflict = direction === 'up' ? ind.rsi < 80 && ind.stochRSI < 88
                                               : ind.rsi > 20 && ind.stochRSI > 12
  const candleAligned    = direction === 'up' ? ind.candleStrength >= 42 : ind.candleStrength <= 58
  const noDivergence     = ind.rsiDivergence === 0 || (direction === 'up' && ind.rsiDivergence > 0) || (direction === 'down' && ind.rsiDivergence < 0)

  const filters: PredictionFilters = { trendStrong, volumeConfirmed, consensusClean, noStrongConflict, candleAligned, noDivergence }
  const filtersPassed = Object.values(filters).filter(Boolean).length  // 0-6

  // ── CONFIDENCE CALCULATION ──────────────────────────────────────────────────

  let confidence = curveConfidence(weightedBull)

  // Consensus modifier (most important — weak consensus = unreliable signal)
  if (consensusRatio >= 0.80) confidence += 4
  else if (consensusRatio >= 0.70) confidence += 2
  else if (consensusRatio < 0.58) confidence -= 8
  else if (consensusRatio < 0.54) confidence -= 14  // nearly 50/50 split

  // ADX modifier (trending market = more reliable)
  if (adx >= 35) confidence += 3
  else if (adx < 15) confidence -= 5   // choppy market

  // RSI divergence bonus
  if (ind.rsiDivergence !== 0) {
    const divAgreement = (direction === 'up' && ind.rsiDivergence > 0) || (direction === 'down' && ind.rsiDivergence < 0)
    if (divAgreement)  confidence += 5   // divergence confirms direction
    else               confidence -= 8   // divergence opposes direction
  }

  // Strong counter-signal veto
  if (!noStrongConflict) confidence -= 8  // RSI/StochRSI extreme against direction

  // Volume with no conviction
  if (!volumeConfirmed) confidence -= 3

  // BB squeeze: direction uncertain
  if (inSqueeze) confidence -= 6

  // Candle bodies opposing signal
  if (!candleAligned) confidence -= 4

  // MTF agreement bonus (structural confirmation is very reliable)
  if (extra.mtfConsensus !== undefined) {
    const mtfAgree = direction === 'up' ? extra.mtfConsensus : 100 - extra.mtfConsensus
    if (mtfAgree >= 72) confidence += 4
    else if (mtfAgree <= 35) confidence -= 6
  }

  // Order book strong agreement bonus
  if (extra.orderBook !== undefined) {
    const obAgree = direction === 'up' ? extra.orderBook : 100 - extra.orderBook
    if (obAgree >= 70) confidence += 3
  }

  // Strategy confidence adjustment (applied before clamp)
  confidence += strategy?.confidenceAdj ?? 0

  // Hard clamp: require all 6 filters to get above 90% (also capped by strategy.maxConfidence)
  const strategyMax = strategy?.maxConfidence ?? 95
  const filterMax   = filtersPassed >= 6 ? 95 : filtersPassed >= 5 ? 90 : filtersPassed >= 4 ? 85 : filtersPassed >= 3 ? 79 : 73
  const maxConf     = Math.min(strategyMax, filterMax)
  confidence = Math.max(51, Math.min(maxConf, confidence))

  // ── SIGNAL QUALITY SCORE (0-100) ─────────────────────────────────────────────

  // Quality = how "clean" the signal is: strong consensus + filters passing + trend context
  const qualityConsensus = Math.max(0, (consensusRatio - 0.50) / 0.50 * 50)  // 0-50 pts
  const qualityFilters   = (filtersPassed / 6) * 35                           // 0-35 pts
  const qualityADX       = Math.min(15, adx / 2)                              // 0-15 pts
  const signalQuality    = Math.min(100, Math.round(qualityConsensus + qualityFilters + qualityADX))

  return {
    direction,
    confidence: Math.round(confidence * 10) / 10,
    bullScore:  Math.round(bullScore * 10)  / 10,
    bearScore:  Math.round(bearScore * 10)  / 10,
    signals,
    signalQuality,
    consensusRatio: Math.round(consensusRatio * 100) / 100,
    adxStrength:    Math.round(adx),
    filters,
    strategyId: stratId,
  }
}
