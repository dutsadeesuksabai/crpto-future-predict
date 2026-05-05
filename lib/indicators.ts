import type { Kline } from './mexc'

// RSI calculation
export function calculateRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50
  const changes = closes.slice(1).map((c, i) => c - closes[i])
  const gains = changes.map((c) => (c > 0 ? c : 0))
  const losses = changes.map((c) => (c < 0 ? -c : 0))

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period

  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period
  }

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

// EMA calculation
export function calculateEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const ema: number[] = [values[0]]
  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k))
  }
  return ema
}

// MACD calculation
export function calculateMACD(closes: number[]): {
  macd: number
  signal: number
  histogram: number
} {
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 }
  const ema12 = calculateEMA(closes, 12)
  const ema26 = calculateEMA(closes, 26)
  const macdLine = ema12.map((v, i) => v - ema26[i])
  const signalLine = calculateEMA(macdLine.slice(macdLine.length - 9), 9)
  const macd = macdLine[macdLine.length - 1]
  const signal = signalLine[signalLine.length - 1]
  return { macd, signal, histogram: macd - signal }
}

// Bollinger Bands
export function calculateBollinger(
  closes: number[],
  period = 20,
  stdDev = 2
): { upper: number; middle: number; lower: number; position: number } {
  const slice = closes.slice(-period)
  const middle = slice.reduce((a, b) => a + b, 0) / period
  const variance = slice.reduce((a, b) => a + Math.pow(b - middle, 2), 0) / period
  const std = Math.sqrt(variance)
  const upper = middle + stdDev * std
  const lower = middle - stdDev * std
  const current = closes[closes.length - 1]
  // position: 0 = at lower band, 100 = at upper band
  const position = upper === lower ? 50 : ((current - lower) / (upper - lower)) * 100
  return { upper, middle, lower, position }
}

// Stochastic RSI
export function calculateStochRSI(closes: number[], period = 14): number {
  const rsiValues: number[] = []
  for (let i = period; i <= closes.length; i++) {
    rsiValues.push(calculateRSI(closes.slice(i - period - 1, i), period))
  }
  if (rsiValues.length < period) return 50
  const slice = rsiValues.slice(-period)
  const min = Math.min(...slice)
  const max = Math.max(...slice)
  if (max === min) return 50
  return ((rsiValues[rsiValues.length - 1] - min) / (max - min)) * 100
}

// Volume analysis
export function calculateVolumeScore(klines: Kline[]): number {
  const recent = klines.slice(-20)
  const avgVolume = recent.reduce((a, b) => a + b.volume, 0) / recent.length
  const lastVolume = klines[klines.length - 1].volume
  const lastClose = klines[klines.length - 1].close
  const prevClose = klines[klines.length - 2].close
  const priceUp = lastClose > prevClose

  // High volume with price increase = bullish; high volume with decrease = bearish
  const volumeRatio = lastVolume / avgVolume
  if (volumeRatio > 1.5) return priceUp ? 70 : 30
  if (volumeRatio > 1.0) return priceUp ? 60 : 40
  return 50
}

// Price momentum (rate of change)
export function calculateMomentum(closes: number[], period = 10): number {
  if (closes.length < period + 1) return 50
  const current = closes[closes.length - 1]
  const past = closes[closes.length - 1 - period]
  const roc = ((current - past) / past) * 100
  // Normalize to 0-100 (assume ±5% is extreme)
  return Math.max(0, Math.min(100, 50 + roc * 10))
}

// ATR (Average True Range) for volatility
export function calculateATR(klines: Kline[], period = 14): number {
  if (klines.length < period + 1) return 0
  const trs: number[] = []
  for (let i = 1; i < klines.length; i++) {
    const hl = klines[i].high - klines[i].low
    const hc = Math.abs(klines[i].high - klines[i - 1].close)
    const lc = Math.abs(klines[i].low - klines[i - 1].close)
    trs.push(Math.max(hl, hc, lc))
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period
}

// EMA cross signal
export function calculateEMACross(closes: number[]): number {
  const ema9 = calculateEMA(closes, 9)
  const ema21 = calculateEMA(closes, 21)
  const ema50 = calculateEMA(closes, 50)
  const last = closes.length - 1

  let score = 50
  if (ema9[last] > ema21[last]) score += 15
  else score -= 15
  if (ema21[last] > ema50[last]) score += 10
  else score -= 10
  // Recent cross detection
  if (ema9[last - 1] < ema21[last - 1] && ema9[last] > ema21[last]) score += 10 // golden cross
  if (ema9[last - 1] > ema21[last - 1] && ema9[last] < ema21[last]) score -= 10 // death cross

  return Math.max(0, Math.min(100, score))
}

export type IndicatorSet = {
  rsi: number
  macd: number
  macdSignal: number
  macdHistogram: number
  bbPosition: number
  bbUpper: number
  bbLower: number
  stochRSI: number
  volumeScore: number
  momentum: number
  emaCross: number
  atr: number
  currentPrice: number
}

export function computeAllIndicators(klines: Kline[]): IndicatorSet {
  const closes = klines.map((k) => k.close)
  const rsi = calculateRSI(closes)
  const { macd, signal, histogram } = calculateMACD(closes)
  const bb = calculateBollinger(closes)
  const stochRSI = calculateStochRSI(closes)
  const volumeScore = calculateVolumeScore(klines)
  const momentum = calculateMomentum(closes)
  const emaCross = calculateEMACross(closes)
  const atr = calculateATR(klines)

  return {
    rsi,
    macd,
    macdSignal: signal,
    macdHistogram: histogram,
    bbPosition: bb.position,
    bbUpper: bb.upper,
    bbLower: bb.lower,
    stochRSI,
    volumeScore,
    momentum,
    emaCross,
    atr,
    currentPrice: closes[closes.length - 1],
  }
}
