import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramAlert, type AlertPayload } from '@/lib/telegram'
import { sendEmailAlert } from '@/lib/email'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const body: AlertPayload & { skipDedupe?: boolean; channels?: string[] } = await req.json()
  const channels = body.channels ?? ['telegram', 'email']

  // Deduplicate: don't send same symbol+timeframe+direction within 30 min
  if (!body.skipDedupe) {
    try {
      const db = getSupabaseAdmin()
      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      const { data } = await db
        .from('alerts')
        .select('id')
        .eq('symbol', body.symbol)
        .eq('timeframe', body.timeframe)
        .eq('direction', body.direction)
        .gte('sent_at', since)
        .limit(1)

      if (data && data.length > 0) {
        return NextResponse.json({ sent: false, reason: 'duplicate within 30min' })
      }
    } catch {}
  }

  // Send in parallel
  const [telegramSent, emailSent] = await Promise.all([
    channels.includes('telegram') ? sendTelegramAlert(body) : Promise.resolve(false),
    channels.includes('email')    ? sendEmailAlert(body)    : Promise.resolve(false),
  ])

  const anySent = telegramSent || emailSent

  if (anySent) {
    try {
      const db = getSupabaseAdmin()
      const channelList = [telegramSent && 'telegram', emailSent && 'email'].filter(Boolean).join(',')
      await db.from('alerts').insert([{
        symbol: body.symbol,
        timeframe: body.timeframe,
        direction: body.direction,
        confidence: body.confidence,
        channel: channelList,
      }])
    } catch {}
  }

  return NextResponse.json({ sent: anySent, telegram: telegramSent, email: emailSent })
}
