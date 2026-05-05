import type { IndicatorSet } from './indicators'

export type PredictionResult = {
  direction: 'up' | 'down'
  confidence: number // 0-100
  bullScore: number
  bearScore: number
  signals: Signal[]
}

export type Signal = {
  name: string
  value: number
  interpretation: string
  weight: number
  bullish: boolean
}

export type ExtraSignals = {
  orderBook?: number    // 0-100 score
  fundingRate?: number  // 0-100 score
  fearGreed?: number    // 0-100 score
  mtfConsensus?: number // 0-100 score
}

export function predict(ind: IndicatorSet, extra: ExtraSignals = {}): PredictionResult {
  const signals: Signal[] = []

  // RSI signal (weight 20)
  const rsiSignal = (() => {
    if (ind.rsi < 30) return { bullish: true, strength: 80, note: 'Oversold' }
    if (ind.rsi < 40) return { bullish: true, strength: 60, note: 'Leaning bullish' }
    if (ind.rsi > 70) return { bullish: false, strength: 80, note: 'Overbought' }
    if (ind.rsi > 60) return { bullish: false, strength: 60, note: 'Leaning bearish' }
    return { bullish: true, strength: 50, note: 'Neutral' }
  })()
  signals.push({
    name: 'RSI',
    value: Math.round(ind.rsi * 10) / 10,
    interpretation: rsiSignal.note,
    weight: 20,
    bullish: rsiSignal.bullish,
  })

  // MACD signal (weight 22)
  const macdBullish = ind.macd > ind.macdSignal
  const macdStrength = Math.abs(ind.macdHistogram) > 0 ? 65 : 50
  signals.push({
    name: 'MACD',
    value: Math.round(ind.macdHistogram * 10000) / 10000,
    interpretation: macdBullish ? 'MACD above signal' : 'MACD below signal',
    weight: 22,
    bullish: macdBullish,
  })

  // Bollinger Bands signal (weight 15)
  const bbBullish = ind.bbPosition < 30
  const bbNote =
    ind.bbPosition < 20
      ? 'Near lower band (oversold)'
      : ind.bbPosition > 80
        ? 'Near upper band (overbought)'
        : 'Mid-range'
  signals.push({
    name: 'Bollinger Bands',
    value: Math.round(ind.bbPosition * 10) / 10,
    interpretation: bbNote,
    weight: 15,
    bullish: ind.bbPosition < 50,
  })

  // StochRSI (weight 15)
  const stochBullish = ind.stochRSI < 20
  const stochNote =
    ind.stochRSI < 20
      ? 'Oversold'
      : ind.stochRSI > 80
        ? 'Overbought'
        : 'Neutral'
  signals.push({
    name: 'Stochastic RSI',
    value: Math.round(ind.stochRSI * 10) / 10,
    interpretation: stochNote,
    weight: 15,
    bullish: ind.stochRSI < 50,
  })

  // EMA Cross (weight 18)
  const emaBullish = ind.emaCross > 50
  signals.push({
    name: 'EMA Cross (9/21/50)',
    value: Math.round(ind.emaCross * 10) / 10,
    interpretation: emaBullish ? 'Bullish alignment' : 'Bearish alignment',
    weight: 18,
    bullish: emaBullish,
  })

  // Volume (weight 10)
  const volBullish = ind.volumeScore > 50
  signals.push({
    name: 'Volume Analysis',
    value: Math.round(ind.volumeScore * 10) / 10,
    interpretation: ind.volumeScore > 60 ? 'High bullish volume' : ind.volumeScore < 40 ? 'High bearish volume' : 'Normal volume',
    weight: 10,
    bullish: volBullish,
  })

  // Momentum (weight 10)
  const momBullish = ind.momentum > 50
  signals.push({
    name: 'Price Momentum',
    value: Math.round(ind.momentum * 10) / 10,
    interpretation: ind.momentum > 60 ? 'Strong upward momentum' : ind.momentum < 40 ? 'Strong downward momentum' : 'Neutral',
    weight: 10,
    bullish: momBullish,
  })

  // Order Book Imbalance (weight 18, high reliability)
  if (extra.orderBook !== undefined) {
    const obBullish = extra.orderBook > 50
    signals.push({
      name: 'Order Book',
      value: Math.round(extra.orderBook * 10) / 10,
      interpretation: extra.orderBook > 65 ? 'Strong bid pressure' : extra.orderBook < 35 ? 'Strong ask pressure' : 'Balanced book',
      weight: 18,
      bullish: obBullish,
    })
  }

  // Funding Rate (weight 12, contrarian)
  if (extra.fundingRate !== undefined) {
    const frBullish = extra.fundingRate > 50
    signals.push({
      name: 'Funding Rate',
      value: Math.round(extra.fundingRate * 10) / 10,
      interpretation: extra.fundingRate > 70 ? 'Shorts overcrowded' : extra.fundingRate < 30 ? 'Longs overcrowded' : 'Neutral funding',
      weight: 12,
      bullish: frBullish,
    })
  }

  // Fear & Greed (weight 8, macro contrarian)
  if (extra.fearGreed !== undefined) {
    const fgBullish = extra.fearGreed > 50
    signals.push({
      name: 'Fear & Greed',
      value: Math.round(extra.fearGreed * 10) / 10,
      interpretation: extra.fearGreed >= 80 ? 'Extreme Fear (buy)' : extra.fearGreed >= 60 ? 'Fear zone' : extra.fearGreed <= 20 ? 'Extreme Greed (sell)' : extra.fearGreed <= 40 ? 'Greed zone' : 'Neutral sentiment',
      weight: 8,
      bullish: fgBullish,
    })
  }

  // Multi-timeframe consensus (weight 20 when available)
  if (extra.mtfConsensus !== undefined) {
    const mtfBullish = extra.mtfConsensus > 50
    signals.push({
      name: 'MTF Consensus',
      value: Math.round(extra.mtfConsensus * 10) / 10,
      interpretation: extra.mtfConsensus > 70 ? 'All TFs bullish' : extra.mtfConsensus < 30 ? 'All TFs bearish' : 'Mixed timeframes',
      weight: 20,
      bullish: mtfBullish,
    })
  }

  // Weighted score calculation
  const totalWeight = signals.reduce((a, s) => a + s.weight, 0)
  const bullScore =
    signals.reduce((acc, s) => {
      const score = s.bullish ? s.weight : 0
      return acc + score
    }, 0) / totalWeight * 100

  const bearScore = 100 - bullScore

  // Add noise dampening for extreme values
  const normalizedBull = Math.max(10, Math.min(90, bullScore))

  const direction: 'up' | 'down' = normalizedBull >= 50 ? 'up' : 'down'
  const confidence = direction === 'up' ? normalizedBull : bearScore

  return {
    direction,
    confidence: Math.round(confidence * 10) / 10,
    bullScore: Math.round(bullScore * 10) / 10,
    bearScore: Math.round(bearScore * 10) / 10,
    signals,
  }
}
