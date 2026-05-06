/**
 * GET /api/signal
 * Public JSON API — returns current predictions for all symbols.
 * Can be consumed by external tools, webhooks, dashboards, bots.
 *
 * Query params:
 *   ?symbol=BTCUSDT        — filter to one symbol
 *   ?pretty=true           — pretty-print JSON
 */
import { NextRequest, NextResponse } from 'next/server'
import { getKlines, getTicker24h, SYMBOLS } from '@/lib/mexc'
import { computeAllIndicators } from '@/lib/indicators'
import { predict } from '@/lib/predictor'
import { getOrderBook, orderBookScore } from '@/lib/orderbook'
import { getFundingRate } from '@/lib/funding'
import { getFearGreed } from '@/lib/feargreed'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const sym    = req.nextUrl.searchParams.get('symbol')?.toUpperCase()
  const pretty = req.nextUrl.searchParams.get('pretty') === 'true'

  const targets = sym ? [sym] : [...SYMBOLS]

  try {
    const results = await Promise.all(
      targets.map(async (symbol) => {
        const [klines1m, klines5m, ticker] = await Promise.all([
          getKlines(symbol, '1m', 200),
          getKlines(symbol, '5m', 100),
          getTicker24h(symbol),
        ])
        const ind1m = computeAllIndicators(klines1m)
        const ind5m = computeAllIndicators(klines5m)

        const [ob, fr, fg] = await Promise.allSettled([
          getOrderBook(symbol),
          getFundingRate(symbol),
          getFearGreed(),
        ])
        const obScore = ob.status === 'fulfilled' && ob.value ? orderBookScore(ob.value) : 50
        const frScore = fr.status === 'fulfilled' && fr.value ? fr.value.score : 50
        const fgScore = fg.status === 'fulfilled' && fg.value ? fg.value.score : 50

        const pred10m = predict(ind1m, { orderBook: obScore, fundingRate: frScore, fearGreed: fgScore })
        const pred30m = predict(ind5m, { orderBook: obScore, fundingRate: frScore, fearGreed: fgScore })

        const qualLabel = (q: number) => q >= 80 ? 'Pure' : q >= 65 ? 'Clean' : q >= 50 ? 'Mixed' : 'Noisy'

        return {
          symbol,
          price:      ticker.price,
          change24h:  ticker.priceChangePercent,
          predictions: {
            '10m': {
              direction:     pred10m.direction,
              confidence:    pred10m.confidence,
              bullScore:     pred10m.bullScore,
              bearScore:     pred10m.bearScore,
              signalQuality: pred10m.signalQuality,
              qualityLabel:  qualLabel(pred10m.signalQuality),
              consensusRatio: pred10m.consensusRatio,
              adxStrength:   pred10m.adxStrength,
            },
            '30m': {
              direction:     pred30m.direction,
              confidence:    pred30m.confidence,
              bullScore:     pred30m.bullScore,
              bearScore:     pred30m.bearScore,
              signalQuality: pred30m.signalQuality,
              qualityLabel:  qualLabel(pred30m.signalQuality),
              consensusRatio: pred30m.consensusRatio,
              adxStrength:   pred30m.adxStrength,
            },
          },
          indicators: {
            rsi:          ind1m.rsi,
            macdHist:     ind1m.macdHistogram,
            bbPosition:   ind1m.bbPosition,
            stochRSI:     ind1m.stochRSI,
            emaCross:     ind1m.emaCross,
            adx:          ind1m.adx,
            vwap:         ind1m.vwapPosition,
            volumeScore:  ind1m.volumeScore,
          },
        }
      })
    )

    const body = { timestamp: new Date().toISOString(), signals: Object.fromEntries(results.map((r) => [r.symbol, r])) }
    const json  = pretty ? JSON.stringify(body, null, 2) : JSON.stringify(body)

    return new Response(json, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',       // allow external tools to fetch
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
