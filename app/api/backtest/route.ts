import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export type BacktestRow = {
  id: string
  symbol: string
  timeframe: string
  direction: string
  confidence: number
  price_at_prediction: number
  actual_price: number
  result: string
  created_at: string
  pnl_pct: number
}

export type BacktestStats = {
  symbol: string
  timeframe: string
  total: number
  wins: number
  losses: number
  winRate: number
  avgConfidence: number
  totalPnlPct: number
  avgPnlPct: number
  maxWin: number
  maxLoss: number
  sharpeProxy: number   // simplified: mean/std of returns
  rows: BacktestRow[]
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')
  const hours = parseInt(req.nextUrl.searchParams.get('hours') || '24')
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  try {
    const db = getSupabaseAdmin()
    let query = db
      .from('predictions')
      .select('*')
      .neq('result', 'pending')
      .not('actual_price', 'is', null)
      .gte('created_at', since)
      .order('created_at', { ascending: false })

    if (symbol) query = query.eq('symbol', symbol)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) return NextResponse.json({ stats: [] })

    // Group by symbol + timeframe
    const groups: Record<string, typeof data> = {}
    for (const row of data) {
      const key = `${row.symbol}-${row.timeframe}`
      if (!groups[key]) groups[key] = []
      groups[key].push(row)
    }

    const stats: BacktestStats[] = Object.entries(groups).map(([, rows]) => {
      const withPnl: BacktestRow[] = rows.map((r) => {
        const entry = Number(r.price_at_prediction)
        const exit = Number(r.actual_price)
        const dirMul = r.direction === 'up' ? 1 : -1
        const pnl_pct = ((exit - entry) / entry) * 100 * dirMul
        return { ...r, pnl_pct }
      })

      const wins = withPnl.filter((r) => r.result === 'correct').length
      const pnls = withPnl.map((r) => r.pnl_pct)
      const totalPnl = pnls.reduce((a, b) => a + b, 0)
      const avgPnl = totalPnl / pnls.length
      const pnlStd = Math.sqrt(pnls.reduce((a, b) => a + Math.pow(b - avgPnl, 2), 0) / pnls.length) || 1

      return {
        symbol: rows[0].symbol,
        timeframe: rows[0].timeframe,
        total: rows.length,
        wins,
        losses: rows.length - wins,
        winRate: (wins / rows.length) * 100,
        avgConfidence: rows.reduce((s, r) => s + Number(r.confidence), 0) / rows.length,
        totalPnlPct: totalPnl,
        avgPnlPct: avgPnl,
        maxWin: Math.max(...pnls),
        maxLoss: Math.min(...pnls),
        sharpeProxy: avgPnl / pnlStd,
        rows: withPnl,
      }
    })

    return NextResponse.json({ stats, hours, since })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
