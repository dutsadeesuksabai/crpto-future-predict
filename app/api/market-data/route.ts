import { NextRequest, NextResponse } from 'next/server'
import { getKlines, getTicker24h } from '@/lib/mexc'
import { computeAllIndicators } from '@/lib/indicators'
import { predict } from '@/lib/predictor'
import { getOrderBook, orderBookScore } from '@/lib/orderbook'
import { getFundingRate } from '@/lib/funding'
import { getMultiTimeframe } from '@/lib/multitimeframe'
import { getFearGreed } from '@/lib/feargreed'
import { detectAnomaly } from '@/lib/anomaly'
import { calcClassicPivots, calcFibPivots, findSwingLevels } from '@/lib/levels'
import { calcTradeSetup } from '@/lib/targets'

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol') || 'BTCUSDT'
  const full   = req.nextUrl.searchParams.get('full') !== 'false'

  try {
    // Core data — always fetched
    const [klines1m, klines5m, ticker, klines1d] = await Promise.all([
      getKlines(symbol, '1m', 200),
      getKlines(symbol, '5m', 100),
      getTicker24h(symbol),
      getKlines(symbol, '1d', 3),    // for daily pivot points
    ])

    const indicators1m = computeAllIndicators(klines1m)
    const indicators5m = computeAllIndicators(klines5m)
    const anomaly      = detectAnomaly(klines1m)

    // Extended data — graceful degradation
    const [orderBook, fundingRate, mtf, fearGreed] = await Promise.allSettled([
      getOrderBook(symbol),
      getFundingRate(symbol),
      full ? getMultiTimeframe(symbol) : Promise.resolve(null),
      getFearGreed(),
    ])

    const ob      = orderBook.status   === 'fulfilled' ? orderBook.value   : null
    const fr      = fundingRate.status === 'fulfilled' ? fundingRate.value : null
    const mtfData = mtf.status         === 'fulfilled' ? mtf.value         : null
    const fg      = fearGreed.status   === 'fulfilled' ? fearGreed.value   : null

    const obScore = ob ? orderBookScore(ob) : 50
    const frScore = fr ? fr.score : 50
    const fgScore = fg ? fg.score : 50
    const mtfScore = mtfData ? mtfData.overallBullScore : undefined

    // Predictions
    const pred10m = predict(indicators1m, { orderBook: obScore, fundingRate: frScore, fearGreed: fgScore, mtfConsensus: mtfScore })
    const pred30m = predict(indicators5m, { orderBook: obScore, fundingRate: frScore, fearGreed: fgScore, mtfConsensus: mtfScore })

    // Pivot levels (use yesterday's 1d candle)
    const yesterday  = klines1d.length >= 2 ? klines1d[klines1d.length - 2] : klines1d[0]
    const todayD     = klines1d[klines1d.length - 1]
    const classic    = calcClassicPivots(yesterday.high, yesterday.low, yesterday.close)
    const fibonacci  = calcFibPivots(yesterday.high, yesterday.low, yesterday.close)
    const swingLevels = findSwingLevels(klines1m, 100)

    // Trade setup (ATR from 1m for 10m, 5m for 30m)
    const tradeSetup = {
      '10m': calcTradeSetup(ticker.price, pred10m.direction, indicators1m.atr),
      '30m': calcTradeSetup(ticker.price, pred30m.direction, indicators5m.atr),
    }

    const alertThreshold  = parseInt(process.env.ALERT_CONFIDENCE_THRESHOLD || '80')

    return NextResponse.json({
      symbol,
      ticker,
      klines: klines1m.slice(-100),
      indicators:     { '1m': indicators1m, '5m': indicators5m },
      predictions:    { '10m': pred10m, '30m': pred30m },
      orderBook:      ob,
      fundingRate:    fr,
      multiTimeframe: mtfData,
      fearGreed:      fg,
      anomaly,
      levels: {
        classic,
        fibonacci,
        swingLevels,
        dailyHigh:  todayD.high,
        dailyLow:   todayD.low,
        dailyOpen:  todayD.open,
      },
      tradeSetup,
      alerts: { '10m': pred10m.confidence >= alertThreshold, '30m': pred30m.confidence >= alertThreshold, threshold: alertThreshold },
      timestamp: Date.now(),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
