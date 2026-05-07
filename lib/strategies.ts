/**
 * Prediction Strategy Definitions
 * Each strategy adjusts signal weights, confidence behavior, and thresholds
 * to suit different market conditions and risk preferences.
 */

export type Strategy = {
  id: string
  name: string
  emoji: string
  tag: string          // short market condition label
  description: string  // Thai description
  accentColor: string  // CSS hex for UI highlight
  weightMult: {
    oscillators: number  // RSI, Bollinger Bands, StochRSI
    trend: number        // MACD, EMA Cross
    volume: number       // Volume, Order Book
    momentum: number     // Momentum, Candle Pattern
    vwap: number         // VWAP
    divergence: number   // RSI Divergence
    fundingRate: number  // Funding Rate
    fearGreed: number    // Fear & Greed Index
    mtf: number          // Multi-Timeframe Consensus
  }
  /** Flat adjustment added to final confidence (+/- %) */
  confidenceAdj: number
  /** Hard cap on confidence regardless of filters */
  maxConfidence: number
  /** Minimum consensus ratio to pass consensusClean filter (default 0.60) */
  consensusMin: number
}

export const STRATEGIES: Strategy[] = [
  // ── 1. Balanced ────────────────────────────────────────────────────────────
  {
    id: 'balanced',
    name: 'Balanced',
    emoji: '⚖️',
    tag: 'All Markets',
    description: 'น้ำหนักทุก signal เท่ากัน เหมาะทุกสภาวะตลาด',
    accentColor: '#3b82f6',
    weightMult: {
      oscillators: 1.0,
      trend: 1.0,
      volume: 1.0,
      momentum: 1.0,
      vwap: 1.0,
      divergence: 1.0,
      fundingRate: 1.0,
      fearGreed: 1.0,
      mtf: 1.0,
    },
    confidenceAdj: 0,
    maxConfidence: 95,
    consensusMin: 0.60,
  },

  // ── 2. Trend Following ──────────────────────────────────────────────────────
  {
    id: 'trend',
    name: 'Trend Following',
    emoji: '📈',
    tag: 'Trending Market',
    description: 'เน้น MACD, EMA, MTF — ใช้เมื่อตลาดมีแนวโน้มชัดเจน',
    accentColor: '#10b981',
    weightMult: {
      oscillators: 0.5,
      trend: 1.8,
      volume: 1.2,
      momentum: 1.3,
      vwap: 1.2,
      divergence: 0.6,
      fundingRate: 0.8,
      fearGreed: 0.5,
      mtf: 1.8,
    },
    confidenceAdj: 3,
    maxConfidence: 95,
    consensusMin: 0.58,
  },

  // ── 3. Mean Reversion ───────────────────────────────────────────────────────
  {
    id: 'reversal',
    name: 'Mean Reversion',
    emoji: '🔄',
    tag: 'Ranging Market',
    description: 'เน้น RSI, BB, VWAP, Divergence — ใช้ในตลาด sideways',
    accentColor: '#f97316',
    weightMult: {
      oscillators: 1.8,
      trend: 0.5,
      volume: 0.8,
      momentum: 0.7,
      vwap: 1.4,
      divergence: 1.8,
      fundingRate: 1.3,
      fearGreed: 1.2,
      mtf: 0.5,
    },
    confidenceAdj: 2,
    maxConfidence: 88,
    consensusMin: 0.62,
  },

  // ── 4. Volume Surge ─────────────────────────────────────────────────────────
  {
    id: 'volume',
    name: 'Volume Surge',
    emoji: '🌊',
    tag: 'High Volume',
    description: 'เน้น Volume spike + Order Book + Funding Rate — ตาม big money',
    accentColor: '#06b6d4',
    weightMult: {
      oscillators: 0.8,
      trend: 1.0,
      volume: 2.0,
      momentum: 1.4,
      vwap: 1.3,
      divergence: 0.8,
      fundingRate: 1.5,
      fearGreed: 0.7,
      mtf: 1.2,
    },
    confidenceAdj: 2,
    maxConfidence: 90,
    consensusMin: 0.58,
  },

  // ── 5. Conservative ─────────────────────────────────────────────────────────
  {
    id: 'conservative',
    name: 'Conservative',
    emoji: '🛡️',
    tag: 'Safety First',
    description: 'ต้องการ consensus สูง, confidence cap 78% — แม่นยำกว่าแต่ออก signal น้อยกว่า',
    accentColor: '#eab308',
    weightMult: {
      oscillators: 1.2,
      trend: 1.0,
      volume: 0.8,
      momentum: 0.6,
      vwap: 1.0,
      divergence: 1.5,
      fundingRate: 0.6,
      fearGreed: 0.4,
      mtf: 1.5,
    },
    confidenceAdj: -5,
    maxConfidence: 78,
    consensusMin: 0.68,
  },

  // ── 6. Aggressive ───────────────────────────────────────────────────────────
  {
    id: 'aggressive',
    name: 'Aggressive',
    emoji: '⚡',
    tag: 'High Signal Rate',
    description: 'boost ทุก signal + confidence +8% — ออก signal บ่อย risk สูงกว่า',
    accentColor: '#ef4444',
    weightMult: {
      oscillators: 1.2,
      trend: 1.3,
      volume: 1.3,
      momentum: 1.3,
      vwap: 1.2,
      divergence: 1.3,
      fundingRate: 1.2,
      fearGreed: 1.0,
      mtf: 1.4,
    },
    confidenceAdj: 8,
    maxConfidence: 97,
    consensusMin: 0.55,
  },

  // ── 7. Scalping ─────────────────────────────────────────────────────────────
  {
    id: 'scalp',
    name: 'Scalping',
    emoji: '🔪',
    tag: 'Short-term',
    description: 'เน้น Candle, Momentum, VWAP, Volume — สำหรับ scalp ระยะสั้น',
    accentColor: '#a855f7',
    weightMult: {
      oscillators: 1.0,
      trend: 0.7,
      volume: 1.5,
      momentum: 2.0,
      vwap: 1.6,
      divergence: 0.7,
      fundingRate: 1.0,
      fearGreed: 0.3,
      mtf: 0.5,
    },
    confidenceAdj: 4,
    maxConfidence: 85,
    consensusMin: 0.57,
  },

  // ── 8. Momentum Blast ───────────────────────────────────────────────────────
  // Pure momentum play: Volume spike + strong candle + VWAP above = continuation.
  // Completely ignores oscillator reversal signals — designed for 10m scalp
  {
    id: 'momentum_blast',
    name: 'Momentum Blast',
    emoji: '🚀',
    tag: '10m Momentum',
    description: 'ไม่สนใจ RSI/BB ใช้แค่ Volume spike + Candle body + VWAP — ตาม momentum',
    accentColor: '#f43f5e',
    weightMult: {
      oscillators: 0.05,   // virtually zero — RSI/BB/StochRSI ignored
      trend: 0.5,          // MACD slow for 10m
      volume: 4.0,         // KING — volume is the signal
      momentum: 4.5,       // KING — raw price momentum
      vwap: 3.0,           // VWAP cross = strong institutional signal
      divergence: 0.05,    // divergence = contrarian, ignore for momentum
      fundingRate: 0.2,
      fearGreed: 0.0,
      mtf: 0.4,
    },
    confidenceAdj: 0,
    maxConfidence: 87,
    consensusMin: 0.65,
  },

  // ── 9. Strict Consensus ─────────────────────────────────────────────────────
  // Only fires when 75%+ of weighted signals agree. Very few signals but cleaner.
  // Balanced weights — just requires much stricter agreement
  {
    id: 'strict_consensus',
    name: 'Strict Consensus',
    emoji: '🎯',
    tag: 'High Precision',
    description: 'ต้องการ 75%+ ของ signal ตรงกัน — ออก signal น้อย แต่แม่นยำกว่า',
    accentColor: '#0ea5e9',
    weightMult: {
      oscillators: 1.0,
      trend: 1.2,
      volume: 1.2,
      momentum: 1.2,
      vwap: 1.3,
      divergence: 1.5,
      fundingRate: 0.8,
      fearGreed: 0.4,
      mtf: 2.0,
    },
    confidenceAdj: -6,     // very hard to reach high confidence
    maxConfidence: 82,
    consensusMin: 0.75,    // the key: need 75% weighted agreement
  },

  // ── 10. Trend Burst ──────────────────────────────────────────────────────────
  // Extreme trend following: only MACD + EMA + MTF matter.
  // Designed for markets in clear up/down trend — filters ranging noise
  {
    id: 'trend_burst',
    name: 'Trend Burst',
    emoji: '🌪️',
    tag: 'Strong Trend',
    description: 'เชื่อ MACD + EMA + MTF เท่านั้น — ผลดีเฉพาะตลาดที่ trend ชัด',
    accentColor: '#22d3ee',
    weightMult: {
      oscillators: 0.08,   // almost zero — RSI/BB are contrarian, useless in trend
      trend: 4.0,          // KING — MACD + EMA Cross dominate
      volume: 1.8,         // volume confirms trend
      momentum: 2.5,       // momentum in trend direction
      vwap: 0.8,
      divergence: 0.1,     // divergence = counter-trend signal, ignore
      fundingRate: 0.3,
      fearGreed: 0.1,
      mtf: 4.0,            // MTF consensus = highest weight
    },
    confidenceAdj: 2,
    maxConfidence: 93,
    consensusMin: 0.62,
  },

  // ── 11. Reversal Hunter ──────────────────────────────────────────────────────
  // For mean-reversion plays: extreme RSI + divergence + BB extremes.
  // Best for 30m timeframe when price hits overbought/oversold levels
  {
    id: 'reversal_hunter',
    name: 'Reversal Hunter',
    emoji: '🎣',
    tag: '30m Reversal',
    description: 'ใช้ RSI extreme + Divergence + BB lower/upper — สำหรับ 30m reversal',
    accentColor: '#fb923c',
    weightMult: {
      oscillators: 4.0,    // KING — RSI/BB/StochRSI at extremes = reversal signal
      trend: 0.05,         // completely ignore trend
      volume: 0.3,         // lower volume = exhaustion, which is good for reversal
      momentum: 0.05,      // momentum works against us in reversal
      vwap: 2.5,           // price far from VWAP = reversion target
      divergence: 5.0,     // KING — divergence is the best reversal signal
      fundingRate: 2.0,    // extreme funding = crowded position = reversal coming
      fearGreed: 2.0,      // extreme fear/greed = reversal
      mtf: 0.1,
    },
    confidenceAdj: 0,
    maxConfidence: 85,
    consensusMin: 0.60,
  },

  // ── 12. Smart Adaptive ──────────────────────────────────────────────────────
  // Balanced but weights MTF + Divergence + Volume more — more "informed" signals
  // compared to pure Balanced. Better calibrated for live conditions.
  {
    id: 'smart_adaptive',
    name: 'Smart Adaptive',
    emoji: '🧠',
    tag: 'Best Overall',
    description: 'ปรับสมดุล MTF + Divergence + Volume + Strict consensus — ผลดีทุกสภาวะ',
    accentColor: '#8b5cf6',
    weightMult: {
      oscillators: 0.8,
      trend: 1.4,
      volume: 1.8,
      momentum: 1.6,
      vwap: 1.8,
      divergence: 2.0,
      fundingRate: 1.0,
      fearGreed: 0.5,
      mtf: 2.5,
    },
    confidenceAdj: -2,
    maxConfidence: 90,
    consensusMin: 0.65,
  },
]

export const DEFAULT_STRATEGY = STRATEGIES[0]

export function getStrategy(id: string): Strategy {
  return STRATEGIES.find((s) => s.id === id) ?? DEFAULT_STRATEGY
}
