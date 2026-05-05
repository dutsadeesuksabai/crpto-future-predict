import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getCurrentPrice } from '@/lib/mexc'

export async function POST() {
  try {
    const db = getSupabaseAdmin()
    const now = new Date().toISOString()

    const { data: pending, error } = await db
      .from('predictions')
      .select('*')
      .eq('result', 'pending')
      .lte('target_time', now)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!pending || pending.length === 0) return NextResponse.json({ updated: 0 })

    const updates = await Promise.all(
      pending.map(async (pred) => {
        try {
          const actualPrice = await getCurrentPrice(pred.symbol)
          const wentUp = actualPrice > pred.price_at_prediction
          const predictedUp = pred.direction === 'up'
          const result = wentUp === predictedUp ? 'correct' : 'incorrect'

          await db
            .from('predictions')
            .update({ actual_price: actualPrice, result })
            .eq('id', pred.id)

          return { id: pred.id, result }
        } catch {
          return { id: pred.id, result: 'error' }
        }
      })
    )

    return NextResponse.json({ updated: updates.length, results: updates })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
