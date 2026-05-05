const MEXC_BASE = 'https://api.mexc.com/api/v3'

export type OrderBookData = {
  bidVolume: number
  askVolume: number
  imbalance: number      // -100 to +100, positive = bullish
  bidAskRatio: number    // bid/ask ratio
  topBidPrice: number
  topAskPrice: number
  spread: number
  spreadPct: number
}

export async function getOrderBook(symbol: string, limit = 20): Promise<OrderBookData> {
  const url = `${MEXC_BASE}/depth?symbol=${symbol}&limit=${limit}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`OrderBook fetch error: ${res.status}`)
  const data = await res.json()

  // bids: [[price, qty], ...] sorted highest first
  // asks: [[price, qty], ...] sorted lowest first
  const bids: [number, number][] = (data.bids || []).map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])])
  const asks: [number, number][] = (data.asks || []).map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])])

  const bidVolume = bids.reduce((s, [, q]) => s + q, 0)
  const askVolume = asks.reduce((s, [, q]) => s + q, 0)
  const total = bidVolume + askVolume || 1

  // Imbalance: (bid - ask) / total * 100
  const imbalance = ((bidVolume - askVolume) / total) * 100

  const topBid = bids[0]?.[0] ?? 0
  const topAsk = asks[0]?.[0] ?? 0
  const spread = topAsk - topBid
  const mid = (topBid + topAsk) / 2 || 1

  return {
    bidVolume,
    askVolume,
    imbalance,
    bidAskRatio: askVolume > 0 ? bidVolume / askVolume : 1,
    topBidPrice: topBid,
    topAskPrice: topAsk,
    spread,
    spreadPct: (spread / mid) * 100,
  }
}

// Convert imbalance to 0-100 signal score (50 = neutral)
export function orderBookScore(ob: OrderBookData): number {
  // imbalance is -100 to +100, map to 0-100
  return Math.max(0, Math.min(100, 50 + ob.imbalance * 0.5))
}
