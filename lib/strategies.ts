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
]

export const DEFAULT_STRATEGY = STRATEGIES[0]

export function getStrategy(id: string): Strategy {
  return STRATEGIES.find((s) => s.id === id) ?? DEFAULT_STRATEGY
}
