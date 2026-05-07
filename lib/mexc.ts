const MEXC_BASE = 'https://api.mexc.com/api/v3'

export type Kline = {
  openTime: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  closeTime: number
}

export type TickerPrice = {
  symbol: string
  price: number
  priceChange: number
  priceChangePercent: number
  volume: number
  quoteVolume: number
  high: number
  low: number
}

export async function getKlines(
  symbol: string,
  interval: string,
  limit = 200
): Promise<Kline[]> {
  const url = `${MEXC_BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`MEXC klines error: ${res.status}`)

  const raw: (string | number)[][] = await res.json()
  return raw.map((k) => ({
    openTime: Number(k[0]),
    open: parseFloat(String(k[1])),
    high: parseFloat(String(k[2])),
    low: parseFloat(String(k[3])),
    close: parseFloat(String(k[4])),
    volume: parseFloat(String(k[5])),
    closeTime: Number(k[6]),
  }))
}

export async function getTicker24h(symbol: string): Promise<TickerPrice> {
  const url = `${MEXC_BASE}/ticker/24hr?symbol=${symbol}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`MEXC ticker error: ${res.status}`)
  const d = await res.json()
  return {
    symbol: d.symbol,
    price: parseFloat(d.lastPrice),
    priceChange: parseFloat(d.priceChange),
    priceChangePercent: parseFloat(d.priceChangePercent),
    volume: parseFloat(d.volume),
    quoteVolume: parseFloat(d.quoteVolume),
    high: parseFloat(d.highPrice),
    low: parseFloat(d.lowPrice),
  }
}

export async function getCurrentPrice(symbol: string): Promise<number> {
  const url = `${MEXC_BASE}/ticker/price?symbol=${symbol}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`MEXC price error: ${res.status}`)
  const d = await res.json()
  return parseFloat(d.price)
}

/**
 * Fetch historical klines by paginating with startTime.
 * MEXC max limit = 1000 per request.
 * Fetches candles from `fromMs` up to `toMs` (default: now).
 */
export async function getKlinesHistorical(
  symbol: string,
  interval: string,
  fromMs: number,
  toMs?: number,
): Promise<Kline[]> {
  const end = toMs ?? Date.now()
  const all: Kline[] = []
  let cursor = fromMs

  while (cursor < end) {
    const url = `${MEXC_BASE}/klines?symbol=${symbol}&interval=${interval}&limit=1000&startTime=${cursor}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`MEXC klines error: ${res.status}`)
    const raw: (string | number)[][] = await res.json()
    if (!raw || raw.length === 0) break

    const chunk: Kline[] = raw.map((k) => ({
      openTime:  Number(k[0]),
      open:      parseFloat(String(k[1])),
      high:      parseFloat(String(k[2])),
      low:       parseFloat(String(k[3])),
      close:     parseFloat(String(k[4])),
      volume:    parseFloat(String(k[5])),
      closeTime: Number(k[6]),
    }))

    all.push(...chunk)
    // Next page starts 1ms after last candle's closeTime
    const lastClose = chunk[chunk.length - 1].closeTime
    if (lastClose >= end) break
    cursor = lastClose + 1
  }

  // Deduplicate by openTime (in case of overlap) and sort
  const map = new Map<number, Kline>()
  for (const k of all) map.set(k.openTime, k)
  return Array.from(map.values())
    .sort((a, b) => a.openTime - b.openTime)
    .filter((k) => k.openTime < end)
}

export const SYMBOLS = ['BTCUSDT', 'ETHUSDT'] as const
export type Symbol = (typeof SYMBOLS)[number]
