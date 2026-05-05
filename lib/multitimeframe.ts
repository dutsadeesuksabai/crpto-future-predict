import { getKlines } from './mexc'
import { computeAllIndicators } from './indicators'
import { predict } from './predictor'
import type { PredictionResult } from './predictor'
import type { IndicatorSet } from './indicators'

export type TimeframeResult = {
  tf: string
  indicators: IndicatorSet
  prediction: PredictionResult
}

export type MTFConsensus = {
  timeframes: TimeframeResult[]
  consensusUp: number      // how many TFs predict UP
  consensusDown: number
  agreement: number        // 0-100, how aligned all TFs are
  dominantDirection: 'up' | 'down'
  // Weighted bull score across all TFs
  overallBullScore: number
}

// Weights per timeframe (higher TF = more weight)
const TF_WEIGHTS: Record<string, number> = {
  '1m': 1,
  '5m': 2,
  '15m': 3,
  '1h': 4,
}

const TF_LIMITS: Record<string, number> = {
  '1m': 200,
  '5m': 100,
  '15m': 100,
  '1h': 100,
}

export async function getMultiTimeframe(symbol: string): Promise<MTFConsensus> {
  const tfs = ['1m', '5m', '15m', '1h']

  const results = await Promise.all(
    tfs.map(async (tf): Promise<TimeframeResult> => {
      const klines = await getKlines(symbol, tf, TF_LIMITS[tf])
      const indicators = computeAllIndicators(klines)
      const prediction = predict(indicators)
      return { tf, indicators, prediction }
    })
  )

  const totalWeight = tfs.reduce((s, tf) => s + TF_WEIGHTS[tf], 0)

  let weightedBullScore = 0
  let consensusUp = 0
  let consensusDown = 0

  for (const r of results) {
    const w = TF_WEIGHTS[r.tf]
    weightedBullScore += r.prediction.bullScore * w
    if (r.prediction.direction === 'up') consensusUp++
    else consensusDown++
  }

  const overallBullScore = weightedBullScore / totalWeight
  const dominantDirection: 'up' | 'down' = overallBullScore >= 50 ? 'up' : 'down'

  // Agreement: how many TFs agree with dominant direction
  const agreeing = dominantDirection === 'up' ? consensusUp : consensusDown
  const agreement = (agreeing / tfs.length) * 100

  return {
    timeframes: results,
    consensusUp,
    consensusDown,
    agreement,
    dominantDirection,
    overallBullScore,
  }
}
