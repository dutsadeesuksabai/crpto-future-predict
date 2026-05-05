// MEXC Futures API for funding rate
const MEXC_CONTRACT = 'https://contract.mexc.com/api/v1/contract'

export type FundingData = {
  symbol: string
  fundingRate: number       // e.g. 0.0001 = 0.01%
  fundingRatePct: number    // percentage
  nextFundingTime: number
  maxFundingRate: number
  minFundingRate: number
  // signal interpretation
  signal: 'strongly_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strongly_bearish'
  score: number             // 0-100
}

// BTCUSDT → BTC_USDT for futures API
function toFuturesSymbol(symbol: string): string {
  return symbol.replace('USDT', '_USDT')
}

export async function getFundingRate(symbol: string): Promise<FundingData> {
  const futSym = toFuturesSymbol(symbol)
  const url = `${MEXC_CONTRACT}/funding_rate/${futSym}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Funding rate fetch error: ${res.status}`)
  const json = await res.json()
  const d = json.data

  const fundingRate = parseFloat(d.fundingRate ?? '0')
  const fundingRatePct = fundingRate * 100

  // High positive funding = longs pay shorts = crowded long = bearish contrarian
  // High negative funding = shorts pay longs = crowded short = bullish contrarian
  let signal: FundingData['signal']
  let score: number

  if (fundingRatePct > 0.1) { signal = 'strongly_bearish'; score = 15 }
  else if (fundingRatePct > 0.05) { signal = 'bearish'; score = 35 }
  else if (fundingRatePct < -0.1) { signal = 'strongly_bullish'; score = 85 }
  else if (fundingRatePct < -0.05) { signal = 'bullish'; score = 65 }
  else { signal = 'neutral'; score = 50 }

  return {
    symbol,
    fundingRate,
    fundingRatePct,
    nextFundingTime: d.nextSettleTime ?? 0,
    maxFundingRate: parseFloat(d.maxFundingRate ?? '0'),
    minFundingRate: parseFloat(d.minFundingRate ?? '0'),
    signal,
    score,
  }
}
