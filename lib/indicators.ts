import type { Kline } from './mexc'

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
  return 100 - 100 / (1 + avgGain / avgLoss)
}

export function calculateEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const ema: number[] = [values[0]]
  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k))
  }
  return ema
}

export function calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 }
  const ema12 = calculateEMA(closes, 12)
  const ema26 = calculateEMA(closes, 26)
  const macdLine = ema12.map((v, i) => v - ema26[i])
  const signalLine = calculateEMA(macdLine.slice(macdLine.length - 9), 9)
  const macd = macdLine[macdLine.length - 1]
  const signal = signalLine[signalLine.length - 1]
  return { macd, signal, histogram: macd - signal }
}

export function calculateBollinger(
  closes: number[],
  period = 20,
  stdDev = 2
): { upper: number; middle: number; lower: number; position: number; bandwidth: number } {
  const slice = closes.slice(-period)
  const middle = slice.reduce((a, b) => a + b, 0) / period
  const variance = slice.reduce((a, b) => a + Math.pow(b - middle, 2), 0) / period
  const std = Math.sqrt(variance)
  const upper = middle + stdDev * std
  const lower = middle - stdDev * std
  const current = closes[closes.length - 1]
  const position = upper === lower ? 50 : ((current - lower) / (upper - lower)) * 100
  const bandwidth = middle > 0 ? ((upper - lower) / middle) * 100 : 2
  return { upper, middle, lower, position, bandwidth }
}

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

export function calculateVolumeScore(klines: Kline[]): number {
  const recent = klines.slice(-20)
  const avgVolume = recent.reduce((a, b) => a + b.volume, 0) / recent.length
  const last = klines[klines.length - 1]
  const prev = klines[klines.length - 2]
  const priceUp = last.close > prev.close
  const volumeRatio = last.volume / avgVolume
  if (volumeRatio > 1.5) return priceUp ? 72 : 28
  if (volumeRatio > 1.0) return priceUp ? 60 : 40
  return 50
}

export function calculateMomentum(closes: number[], period = 10): number {
  if (closes.length < period + 1) return 50
  const roc = ((closes[closes.length - 1] - closes[closes.length - 1 - period]) / closes[closes.length - 1 - period]) * 100
  return Math.max(0, Math.min(100, 50 + roc * 10))
}

export function calculateATR(klines: Kline[], period = 14): number {
  if (klines.length < period + 1) return 0
  const trs: number[] = []
  for (let i = 1; i < klines.length; i++) {
    trs.push(Math.max(
      klines[i].high - klines[i].low,
      Math.abs(klines[i].high - klines[i - 1].close),
      Math.abs(klines[i].low - klines[i - 1].close)
    ))
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period
}

export function calculateEMACross(closes: number[]): number {
  const ema9  = calculateEMA(closes, 9)
  const ema21 = calculateEMA(closes, 21)
  const ema50 = calculateEMA(closes, 50)
  const last  = closes.length - 1
  let score   = 50
  if (ema9[last]  > ema21[last]) score += 15; else score -= 15
  if (ema21[last] > ema50[last]) score += 10; else score -= 10
  if (ema9[last - 1] < ema21[last - 1] && ema9[last] > ema21[last]) score += 12  // golden cross
  if (ema9[last - 1] > ema21[last - 1] && ema9[last] < ema21[last]) score -= 12  // death cross
  return Math.max(0, Math.min(100, score))
}

/** ADX — Average Directional Index (trend strength 0-100, >25 = trending) */
export function calculateADX(klines: Kline[], period = 14): number {
  if (klines.length < period * 2 + 1) return 20
  const trs: number[] = []
  const pdms: number[] = []
  const mdms: number[] = []
  for (let i = 1; i < klines.length; i++) {
    const h = klines[i].high, l = klines[i].low, ph = klines[i - 1].high, pl = klines[i - 1].low, pc = klines[i - 1].close
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)))
    const up = h - ph, down = pl - l
    pdms.push(up > down && up > 0 ? up : 0)
    mdms.push(down > up && down > 0 ? down : 0)
  }
  // Wilder smoothing
  let sATR  = trs.slice(0, period).reduce((a, b) => a + b, 0)
  let sPDM  = pdms.slice(0, period).reduce((a, b) => a + b, 0)
  let sMDM  = mdms.slice(0, period).reduce((a, b) => a + b, 0)
  const dxs: number[] = []
  for (let i = period; i < trs.length; i++) {
    sATR = sATR - sATR / period + trs[i]
    sPDM = sPDM - sPDM / period + pdms[i]
    sMDM = sMDM - sMDM / period + mdms[i]
    const pdi = sATR > 0 ? (sPDM / sATR) * 100 : 0
    const mdi = sATR > 0 ? (sMDM / sATR) * 100 : 0
    const sum = pdi + mdi
    dxs.push(sum > 0 ? (Math.abs(pdi - mdi) / sum) * 100 : 0)
  }
  if (dxs.length < period) return 20
  return dxs.slice(-period).reduce((a, b) => a + b, 0) / period
}

/** VWAP position (0=far below VWAP, 100=far above, 50=at VWAP) */
export function calculateVWAP(klines: Kline[]): number {
  const recent = klines.slice(-50)
  let cumTPV = 0, cumVol = 0
  for (const k of recent) {
    const tp = (k.high + k.low + k.close) / 3
    cumTPV  += tp * k.volume
    cumVol  += k.volume
  }
  if (cumVol === 0) return 50
  const vwap = cumTPV / cumVol
  const current = recent[recent.length - 1].close
  // Standard deviation of TP from VWAP
  const variances = recent.map((k) => {
    const tp = (k.high + k.low + k.close) / 3
    return Math.pow(tp - vwap, 2) * k.volume
  })
  const std = Math.sqrt(variances.reduce((a, b) => a + b, 0) / cumVol)
  if (std === 0) return current >= vwap ? 60 : 40
  // Map deviation in ±2σ to 0-100
  const deviation = (current - vwap) / std
  return Math.max(0, Math.min(100, 50 + deviation * 20))
}

/** Candle body momentum — bullish body % of total body over last N candles (0-100) */
export function calculateCandleStrength(klines: Kline[], n = 6): number {
  const recent = klines.slice(-n)
  let bull = 0, bear = 0
  for (const k of recent) {
    const body = Math.abs(k.close - k.open)
    if (k.close >= k.open) bull += body; else bear += body
  }
  const total = bull + bear
  if (total === 0) return 50
  return (bull / total) * 100
}

/** RSI Divergence: returns +1 bullish divergence, -1 bearish divergence, 0 none */
export function detectRSIDivergence(klines: Kline[], closes: number[]): number {
  if (klines.length < 30) return 0
  const prices = closes.slice(-30)
  const rsiSeries: number[] = []
  for (let i = 14; i <= prices.length; i++) {
    rsiSeries.push(calculateRSI(prices.slice(0, i)))
  }
  if (rsiSeries.length < 5) return 0
  const priceLast = prices[prices.length - 1]
  const pricePrev = Math.min(...prices.slice(-15, -5))
  const rsiLast   = rsiSeries[rsiSeries.length - 1]
  const rsiPrev   = Math.min(...rsiSeries.slice(-10, -3))
  // Bullish divergence: price makes lower low but RSI makes higher low
  if (priceLast < pricePrev && rsiLast > rsiPrev + 3) return 1
  // Bearish divergence: price makes higher high but RSI makes lower high
  const priceHigh = Math.max(...prices.slice(-15, -5))
  const rsiHigh   = Math.max(...rsiSeries.slice(-10, -3))
  if (priceLast > priceHigh && rsiLast < rsiHigh - 3) return -1
  return 0
}

export type IndicatorSet = {
  rsi: number
  macd: number
  macdSignal: number
  macdHistogram: number
  bbPosition: number
  bbUpper: number
  bbLower: number
  bbBandwidth: number      // NEW: Bollinger bandwidth % (low = squeeze)
  stochRSI: number
  volumeScore: number
  momentum: number
  emaCross: number
  atr: number
  currentPrice: number
  adx: number              // NEW: trend strength (>25 = trending)
  vwapPosition: number     // NEW: price vs VWAP (0-100)
  candleStrength: number   // NEW: bullish candle body % (0-100)
  rsiDivergence: number    // NEW: +1 bull div, -1 bear div, 0 none
}

export function computeAllIndicators(klines: Kline[]): IndicatorSet {
  const closes = klines.map((k) => k.close)
  const rsi          = calculateRSI(closes)
  const { macd, signal, histogram } = calculateMACD(closes)
  const bb           = calculateBollinger(closes)
  const stochRSI     = calculateStochRSI(closes)
  const volumeScore  = calculateVolumeScore(klines)
  const momentum     = calculateMomentum(closes)
  const emaCross     = calculateEMACross(closes)
  const atr          = calculateATR(klines)
  const adx          = calculateADX(klines)
  const vwapPosition = calculateVWAP(klines)
  const candleStrength = calculateCandleStrength(klines)
  const rsiDivergence  = detectRSIDivergence(klines, closes)

  return {
    rsi,
    macd,
    macdSignal: signal,
    macdHistogram: histogram,
    bbPosition: bb.position,
    bbUpper: bb.upper,
    bbLower: bb.lower,
    bbBandwidth: bb.bandwidth,
    stochRSI,
    volumeScore,
    momentum,
    emaCross,
    atr,
    currentPrice: closes[closes.length - 1],
    adx,
    vwapPosition,
    candleStrength,
    rsiDivergence,
  }
}
