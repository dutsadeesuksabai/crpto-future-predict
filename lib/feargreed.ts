export type FearGreedData = {
  value: number           // 0-100
  classification: string  // 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed'
  timestamp: string
  // Prediction implication
  signal: 'strongly_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strongly_bearish'
  score: number           // 0-100 for predictor
}

export async function getFearGreed(): Promise<FearGreedData> {
  const res = await fetch('https://api.alternative.me/fng/?limit=1', {
    cache: 'no-store',
    next: { revalidate: 3600 }, // cache 1 hour
  })
  if (!res.ok) throw new Error('Fear & Greed fetch failed')
  const json = await res.json()
  const d = json.data?.[0]
  if (!d) throw new Error('No Fear & Greed data')

  const value = parseInt(d.value)

  // Contrarian signal: extreme fear = buy opportunity, extreme greed = sell
  let signal: FearGreedData['signal']
  let score: number
  if (value <= 20) { signal = 'strongly_bullish'; score = 80 }
  else if (value <= 40) { signal = 'bullish'; score = 65 }
  else if (value <= 60) { signal = 'neutral'; score = 50 }
  else if (value <= 80) { signal = 'bearish'; score = 38 }
  else { signal = 'strongly_bearish'; score = 22 }

  return {
    value,
    classification: d.value_classification,
    timestamp: d.timestamp,
    signal,
    score,
  }
}
