import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, type Prediction } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50')

  try {
    const db = getSupabaseAdmin()
    let query = db
      .from('predictions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (symbol) query = query.eq('symbol', symbol)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ predictions: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getSupabaseAdmin()
    const body: Prediction = await req.json()

    const { data, error } = await db
      .from('predictions')
      .insert([
        {
          symbol: body.symbol,
          timeframe: body.timeframe,
          direction: body.direction,
          confidence: body.confidence,
          price_at_prediction: body.price_at_prediction,
          target_time: body.target_time,
          result: 'pending',
          indicators: body.indicators,
        },
      ])
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ prediction: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
