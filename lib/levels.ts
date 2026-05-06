import type { Kline } from './mexc'

export type PivotLevel = {
  label: string
  price: number
  type: 'resistance' | 'pivot' | 'support' | 'sr'
}

export type LevelData = {
  classic: PivotLevel[]
  fibonacci: PivotLevel[]
  swingLevels: PivotLevel[]
  dailyHigh: number
  dailyLow: number
  dailyOpen: number
}

/** Classic floor pivot points based on previous period OHLC */
export function calcClassicPivots(high: number, low: number, close: number): PivotLevel[] {
  const PP = (high + low + close) / 3
  const R1 = 2 * PP - low
  const R2 = PP + (high - low)
  const R3 = high + 2 * (PP - low)
  const S1 = 2 * PP - high
  const S2 = PP - (high - low)
  const S3 = low - 2 * (high - PP)
  return [
    { label: 'R3', price: R3, type: 'resistance' },
    { label: 'R2', price: R2, type: 'resistance' },
    { label: 'R1', price: R1, type: 'resistance' },
    { label: 'PP', price: PP, type: 'pivot' },
    { label: 'S1', price: S1, type: 'support' },
    { label: 'S2', price: S2, type: 'support' },
    { label: 'S3', price: S3, type: 'support' },
  ]
}

/** Fibonacci pivot points */
export function calcFibPivots(high: number, low: number, close: number): PivotLevel[] {
  const PP    = (high + low + close) / 3
  const range = high - low
  return [
    { label: 'FR3', price: PP + range * 1.000, type: 'resistance' },
    { label: 'FR2', price: PP + range * 0.618, type: 'resistance' },
    { label: 'FR1', price: PP + range * 0.382, type: 'resistance' },
    { label: 'FPP', price: PP,                 type: 'pivot'      },
    { label: 'FS1', price: PP - range * 0.382, type: 'support'    },
    { label: 'FS2', price: PP - range * 0.618, type: 'support'    },
    { label: 'FS3', price: PP - range * 1.000, type: 'support'    },
  ]
}

/** Detect swing highs/lows and cluster into S/R zones */
export function findSwingLevels(klines: Kline[], lookback = 80): PivotLevel[] {
  const recent = klines.slice(-lookback)
  const swingHighs: number[] = []
  const swingLows: number[]  = []

  for (let i = 2; i < recent.length - 2; i++) {
    const c = recent[i]
    if (
      c.high > recent[i - 1].high && c.high > recent[i - 2].high &&
      c.high > recent[i + 1].high && c.high > recent[i + 2].high
    ) swingHighs.push(c.high)
    if (
      c.low < recent[i - 1].low && c.low < recent[i - 2].low &&
      c.low < recent[i + 1].low && c.low < recent[i + 2].low
    ) swingLows.push(c.low)
  }

  /** Merge prices within 0.4% of each other into a single cluster average */
  function cluster(prices: number[]): number[] {
    if (!prices.length) return []
    const sorted = [...prices].sort((a, b) => a - b)
    const groups: number[][] = [[sorted[0]]]
    for (let i = 1; i < sorted.length; i++) {
      const last = groups[groups.length - 1]
      const avg  = last.reduce((a, b) => a + b, 0) / last.length
      if (Math.abs(sorted[i] - avg) / avg < 0.004) last.push(sorted[i])
      else groups.push([sorted[i]])
    }
    return groups.map((g) => g.reduce((a, b) => a + b, 0) / g.length)
  }

  const resistances = cluster(swingHighs)
    .slice(-4)
    .map((price, i) => ({ label: `R${i + 1}`, price, type: 'resistance' as const }))
  const supports = cluster(swingLows)
    .slice(0, 4)
    .reverse()
    .map((price, i) => ({ label: `S${i + 1}`, price, type: 'support' as const }))

  return [...resistances.reverse(), ...supports]
}

/** Find nearest S/R level from current price */
export function nearestLevel(price: number, levels: PivotLevel[]): { above: PivotLevel | null; below: PivotLevel | null } {
  const sorted  = [...levels].sort((a, b) => a.price - b.price)
  const above   = sorted.filter((l) => l.price > price)
  const below   = sorted.filter((l) => l.price <= price)
  return {
    above: above.length ? above[0] : null,
    below: below.length ? below[below.length - 1] : null,
  }
}

/** Distance from price to level as percentage */
export function distancePct(price: number, level: number): number {
  return ((level - price) / price) * 100
}
