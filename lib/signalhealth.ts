import { getSupabaseAdmin } from './supabase'

export type SignalHealthEntry = {
  name: string
  total: number
  correct: number
  accuracy: number     // 0-100
  weight: number       // adjusted weight (base 100)
  status: 'reliable' | 'average' | 'weak' | 'insufficient'
}

export type SignalHealth = {
  signals: SignalHealthEntry[]
  overallAccuracy: number
  dataPoints: number
  lastUpdated: string
}

const BASE_SIGNAL_NAMES = [
  'RSI', 'MACD', 'Bollinger Bands', 'Stochastic RSI',
  'EMA Cross (9/21/50)', 'Volume Analysis', 'Price Momentum',
  'Order Book', 'Funding Rate',
]

export async function getSignalHealth(symbol?: string): Promise<SignalHealth> {
  try {
    const db = getSupabaseAdmin()
    let query = db
      .from('predictions')
      .select('indicators, result, direction')
      .neq('result', 'pending')
      .order('created_at', { ascending: false })
      .limit(200)

    if (symbol) query = query.eq('symbol', symbol)

    const { data, error } = await query
    if (error || !data || data.length === 0) {
      return buildEmpty()
    }

    // Tally per-signal accuracy
    const tally: Record<string, { correct: number; total: number }> = {}
    let totalCorrect = 0

    for (const row of data) {
      const isCorrect = row.result === 'correct'
      if (isCorrect) totalCorrect++

      const ind = row.indicators as Record<string, number>
      if (!ind) continue

      // RSI
      if (ind.rsi !== undefined) {
        const key = 'RSI'
        if (!tally[key]) tally[key] = { correct: 0, total: 0 }
        tally[key].total++
        // RSI bullish signal: rsi < 50 predicts up, rsi > 50 predicts down
        const rsiBullish = ind.rsi < 50
        const predUp = row.direction === 'up'
        if (rsiBullish === predUp && isCorrect) tally[key].correct++
        else if (rsiBullish !== predUp && !isCorrect) tally[key].correct++ // contrarian was right
      }

      // MACD
      if (ind.macd_histogram !== undefined) {
        const key = 'MACD'
        if (!tally[key]) tally[key] = { correct: 0, total: 0 }
        tally[key].total++
        const macdBullish = ind.macd_histogram > 0
        const predUp = row.direction === 'up'
        if (macdBullish === predUp) {
          if (isCorrect) tally[key].correct++
        } else {
          if (!isCorrect) tally[key].correct++
        }
      }
    }

    const signals: SignalHealthEntry[] = BASE_SIGNAL_NAMES.map((name) => {
      const t = tally[name]
      if (!t || t.total < 5) {
        return { name, total: t?.total ?? 0, correct: 0, accuracy: 0, weight: 100, status: 'insufficient' }
      }
      const accuracy = (t.correct / t.total) * 100
      const weight = Math.round(50 + accuracy)  // 50-150 based on accuracy
      const status: SignalHealthEntry['status'] =
        accuracy >= 60 ? 'reliable' :
        accuracy >= 50 ? 'average' :
        accuracy >= 40 ? 'weak' : 'insufficient'
      return { name, total: t.total, correct: t.correct, accuracy, weight, status }
    })

    return {
      signals,
      overallAccuracy: data.length > 0 ? (totalCorrect / data.length) * 100 : 0,
      dataPoints: data.length,
      lastUpdated: new Date().toISOString(),
    }
  } catch {
    return buildEmpty()
  }
}

function buildEmpty(): SignalHealth {
  return {
    signals: BASE_SIGNAL_NAMES.map((name) => ({
      name, total: 0, correct: 0, accuracy: 0, weight: 100, status: 'insufficient',
    })),
    overallAccuracy: 0,
    dataPoints: 0,
    lastUpdated: new Date().toISOString(),
  }
}
