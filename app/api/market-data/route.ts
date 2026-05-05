import { NextRequest, NextResponse } from 'next/server'
import { getKlines, getTicker24h, SYMBOLS } from '@/lib/mexc'
import { computeAllIndicators } from '@/lib/indicators'
import { predict } from '@/lib/predictor'

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol') || 'BTCUSDT'

  try {
    const [klines1m, klines5m, ticker] = await Promise.all([
      getKlines(symbol, '1m', 200),
      getKlines(symbol, '5m', 100),
      getTicker24h(symbol),
    ])

    const indicators1m = computeAllIndicators(klines1m)
    const indicators5m = computeAllIndicators(klines5m)

    // 10m prediction: weighted mix of 1m (heavy) + 5m
    const pred10m = predict(indicators1m)
    // 30m prediction: weighted toward 5m data
    const pred30m = predict(indicators5m)

    return NextResponse.json({
      symbol,
      ticker,
      klines: klines1m.slice(-100),
      indicators: {
        '1m': indicators1m,
        '5m': indicators5m,
      },
      predictions: {
        '10m': pred10m,
        '30m': pred30m,
      },
      timestamp: Date.now(),
    })
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    )
  }
}
