import { NextRequest, NextResponse } from 'next/server'
import { getKlines, getTicker24h } from '@/lib/mexc'
import { computeAllIndicators } from '@/lib/indicators'
import { predict } from '@/lib/predictor'
import { getOrderBook, orderBookScore } from '@/lib/orderbook'
import { getFundingRate } from '@/lib/funding'
import { getMultiTimeframe } from '@/lib/multitimeframe'
import { getFearGreed } from '@/lib/feargreed'
import { detectAnomaly } from '@/lib/anomaly'

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol') || 'BTCUSDT'
  const full = req.nextUrl.searchParams.get('full') !== 'false'

  try {
    // Core data — always fetched
    const [klines1m, klines5m, ticker] = await Promise.all([
      getKlines(symbol, '1m', 200),
      getKlines(symbol, '5m', 100),
      getTicker24h(symbol),
    ])

    const indicators1m = computeAllIndicators(klines1m)
    const indicators5m = computeAllIndicators(klines5m)

    // Anomaly on 1m data
    const anomaly = detectAnomaly(klines1m)

    // Extended data — fetch in parallel, gracefully degrade on error
    const [orderBook, fundingRate, mtf, fearGreed] = await Promise.allSettled([
      getOrderBook(symbol),
      getFundingRate(symbol),
      full ? getMultiTimeframe(symbol) : Promise.resolve(null),
      getFearGreed(),
    ])

    const ob = orderBook.status === 'fulfilled' ? orderBook.value : null
    const fr = fundingRate.status === 'fulfilled' ? fundingRate.value : null
    const mtfData = mtf.status === 'fulfilled' ? mtf.value : null
    const fg = fearGreed.status === 'fulfilled' ? fearGreed.value : null

    // Build enhanced indicators including new signals
    const obScore = ob ? orderBookScore(ob) : 50
    const frScore = fr ? fr.score : 50
    const fgScore = fg ? fg.score : 50

    // Prediction with extra context signals injected
    const pred10m = predict(indicators1m, { orderBook: obScore, fundingRate: frScore, fearGreed: fgScore })
    const pred30m = predict(indicators5m, { orderBook: obScore, fundingRate: frScore, fearGreed: fgScore })

    // Alert check
    const alertThreshold = parseInt(process.env.ALERT_CONFIDENCE_THRESHOLD || '80')
    const shouldAlert10m = pred10m.confidence >= alertThreshold
    const shouldAlert30m = pred30m.confidence >= alertThreshold

    return NextResponse.json({
      symbol,
      ticker,
      klines: klines1m.slice(-100),
      indicators: { '1m': indicators1m, '5m': indicators5m },
      predictions: { '10m': pred10m, '30m': pred30m },
      orderBook: ob,
      fundingRate: fr,
      multiTimeframe: mtfData,
      fearGreed: fg,
      anomaly,
      alerts: { '10m': shouldAlert10m, '30m': shouldAlert30m, threshold: alertThreshold },
      timestamp: Date.now(),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
