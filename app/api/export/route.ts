/**
 * GET /api/export
 * Download prediction history as CSV.
 * Query params: ?symbol=BTCUSDT&limit=200&timeframe=10m
 */
import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const symbol    = req.nextUrl.searchParams.get('symbol') ?? undefined
  const timeframe = req.nextUrl.searchParams.get('timeframe') ?? undefined
  const limit     = Math.min(500, parseInt(req.nextUrl.searchParams.get('limit') ?? '200'))

  try {
    const db   = getSupabaseAdmin()
    let query  = db
      .from('predictions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (symbol)    query = query.eq('symbol', symbol)
    if (timeframe) query = query.eq('timeframe', timeframe)

    const { data, error } = await query
    if (error) throw error

    const rows = data ?? []

    // Build CSV
    const headers = [
      'created_at', 'symbol', 'timeframe', 'direction', 'confidence',
      'price_at_prediction', 'target_time', 'outcome', 'correct',
      'rsi', 'macd_histogram', 'bb_position', 'ema_cross', 'volume_score',
    ]

    const escape = (v: unknown) => {
      const s = String(v ?? '')
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }

    const csvLines = [
      headers.join(','),
      ...rows.map((r) => [
        escape(r.created_at),
        escape(r.symbol),
        escape(r.timeframe),
        escape(r.direction),
        escape(r.confidence),
        escape(r.price_at_prediction),
        escape(r.target_time),
        escape(r.outcome ?? ''),
        escape(r.correct === true ? 'TRUE' : r.correct === false ? 'FALSE' : ''),
        escape(r.indicators?.rsi ?? ''),
        escape(r.indicators?.macd_histogram ?? ''),
        escape(r.indicators?.bb_position ?? ''),
        escape(r.indicators?.ema_cross ?? ''),
        escape(r.indicators?.volume_score ?? ''),
      ].join(',')),
    ]

    const csv  = csvLines.join('\n')
    const date = new Date().toISOString().slice(0, 10)
    const filename = `predictions_${symbol ?? 'all'}_${date}.csv`

    return new Response(csv, {
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control':       'no-store',
      },
    })
  } catch (err) {
    return new Response(`error,${String(err)}\n`, {
      status: 500,
      headers: { 'Content-Type': 'text/csv' },
    })
  }
}
