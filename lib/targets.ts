export type TradeSetup = {
  direction: 'up' | 'down'
  entryLow: number      // lower bound of entry zone
  entryHigh: number     // upper bound of entry zone
  entryIdeal: number    // ideal entry (slight pullback from current)
  stopLoss: number
  tp1: number           // 1:1 R:R
  tp2: number           // 2:1 R:R
  tp3: number           // 3:1 R:R
  riskPct: number       // % risk from entry to SL
  rewardPct1: number    // % from entry to TP1
  rrRatio: number       // reward-to-risk ratio (TP1)
  atrValue: number      // ATR used for calculation
}

/**
 * Calculate trade setup based on ATR-derived levels.
 * SL = 1.8×ATR from entry | TP1 = 1.8×ATR (1:1) | TP2 = 3.6×ATR (2:1) | TP3 = 5.4×ATR (3:1)
 * Entry zone = ±0.25×ATR around current price (wait for micro-pullback).
 */
export function calcTradeSetup(
  price: number,
  direction: 'up' | 'down',
  atr: number,
): TradeSetup {
  const sl = 1.8 * atr

  if (direction === 'up') {
    const entry    = price - atr * 0.15   // slight pullback for ideal entry
    const stopLoss = entry - sl
    const tp1      = entry + sl           // 1:1
    const tp2      = entry + sl * 2       // 2:1
    const tp3      = entry + sl * 3       // 3:1
    const riskPct      = ((entry - stopLoss) / entry) * 100
    const rewardPct1   = ((tp1 - entry)    / entry)   * 100
    return {
      direction,
      entryLow:    price - atr * 0.30,
      entryHigh:   price + atr * 0.10,
      entryIdeal:  entry,
      stopLoss,
      tp1, tp2, tp3,
      riskPct:     Math.round(riskPct * 100) / 100,
      rewardPct1:  Math.round(rewardPct1 * 100) / 100,
      rrRatio:     Math.round((rewardPct1 / riskPct) * 100) / 100,
      atrValue:    Math.round(atr * 100) / 100,
    }
  } else {
    const entry    = price + atr * 0.15
    const stopLoss = entry + sl
    const tp1      = entry - sl
    const tp2      = entry - sl * 2
    const tp3      = entry - sl * 3
    const riskPct      = ((stopLoss - entry) / entry) * 100
    const rewardPct1   = ((entry - tp1)     / entry)  * 100
    return {
      direction,
      entryLow:    price - atr * 0.10,
      entryHigh:   price + atr * 0.30,
      entryIdeal:  entry,
      stopLoss,
      tp1, tp2, tp3,
      riskPct:     Math.round(riskPct * 100) / 100,
      rewardPct1:  Math.round(rewardPct1 * 100) / 100,
      rrRatio:     Math.round((rewardPct1 / riskPct) * 100) / 100,
      atrValue:    Math.round(atr * 100) / 100,
    }
  }
}

/** Format price nicely based on magnitude */
export function fmtPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (p >= 1)    return p.toFixed(4)
  return p.toFixed(6)
}
