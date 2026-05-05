import type { Kline } from './mexc'

export type AnomalyResult = {
  hasAnomaly: boolean
  type: 'none' | 'volume_spike' | 'price_pump' | 'price_dump' | 'volatility_surge'
  severity: 'low' | 'medium' | 'high'
  message: string
  zScore: number
  details: {
    currentVolume: number
    avgVolume: number
    volumeZScore: number
    currentMove: number   // % change last candle
    avgMove: number
    priceZScore: number
    atr: number
    currentRange: number
  }
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function std(arr: number[], m?: number): number {
  const mu = m ?? mean(arr)
  return Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - mu, 2), 0) / arr.length)
}

export function detectAnomaly(klines: Kline[], lookback = 50): AnomalyResult {
  if (klines.length < lookback + 1) {
    return { hasAnomaly: false, type: 'none', severity: 'low', message: '', zScore: 0, details: {} as AnomalyResult['details'] }
  }

  const window = klines.slice(-lookback - 1, -1) // lookback candles before last
  const last = klines[klines.length - 1]

  // Volume Z-score
  const volumes = window.map((k) => k.volume)
  const avgVol = mean(volumes)
  const stdVol = std(volumes, avgVol) || 1
  const volumeZScore = (last.volume - avgVol) / stdVol

  // Price move Z-score (% change per candle)
  const moves = window.map((k) => Math.abs((k.close - k.open) / k.open) * 100)
  const avgMove = mean(moves)
  const stdMove = std(moves, avgMove) || 0.001
  const currentMove = Math.abs((last.close - last.open) / last.open) * 100
  const priceZScore = (currentMove - avgMove) / stdMove

  // ATR for volatility
  const ranges = window.map((k) => k.high - k.low)
  const atr = mean(ranges)
  const currentRange = last.high - last.low

  const details = {
    currentVolume: last.volume,
    avgVolume: avgVol,
    volumeZScore,
    currentMove,
    avgMove,
    priceZScore,
    atr,
    currentRange,
  }

  // Anomaly detection thresholds
  const priceUp = last.close > last.open

  if (volumeZScore > 4 && priceZScore > 3) {
    return {
      hasAnomaly: true,
      type: priceUp ? 'price_pump' : 'price_dump',
      severity: 'high',
      message: `Extreme ${priceUp ? 'pump' : 'dump'} detected — volume ${volumeZScore.toFixed(1)}σ, move ${priceZScore.toFixed(1)}σ above normal`,
      zScore: Math.max(volumeZScore, priceZScore),
      details,
    }
  }

  if (volumeZScore > 3) {
    return {
      hasAnomaly: true,
      type: 'volume_spike',
      severity: volumeZScore > 5 ? 'high' : 'medium',
      message: `Volume spike ${volumeZScore.toFixed(1)}σ above average — prediction reliability reduced`,
      zScore: volumeZScore,
      details,
    }
  }

  if (priceZScore > 3) {
    return {
      hasAnomaly: true,
      type: 'volatility_surge',
      severity: priceZScore > 5 ? 'high' : 'medium',
      message: `Volatility surge — price move ${currentMove.toFixed(2)}% vs avg ${avgMove.toFixed(2)}%`,
      zScore: priceZScore,
      details,
    }
  }

  return { hasAnomaly: false, type: 'none', severity: 'low', message: '', zScore: 0, details }
}
