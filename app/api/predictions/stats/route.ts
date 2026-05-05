import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')

  try {
    const db = getSupabaseAdmin()
    let query = db
      .from('predictions')
      .select('symbol, timeframe, direction, result, confidence')
      .neq('result', 'pending')

    if (symbol) query = query.eq('symbol', symbol)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const stats: Record<string, Record<string, { total: number; correct: number; accuracy: number }>> = {}
    for (const row of data || []) {
      if (!stats[row.symbol]) stats[row.symbol] = {}
      if (!stats[row.symbol][row.timeframe]) {
        stats[row.symbol][row.timeframe] = { total: 0, correct: 0, accuracy: 0 }
      }
      stats[row.symbol][row.timeframe].total++
      if (row.result === 'correct') stats[row.symbol][row.timeframe].correct++
    }
    for (const sym of Object.keys(stats)) {
      for (const tf of Object.keys(stats[sym])) {
        const s = stats[sym][tf]
        s.accuracy = s.total > 0 ? Math.round((s.correct / s.total) * 1000) / 10 : 0
      }
    }

    return NextResponse.json({ stats })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
