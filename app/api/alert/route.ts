import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramAlert, type AlertPayload } from '@/lib/telegram'
import { sendEmailAlert } from '@/lib/email'
import { sendDiscordAlert } from '@/lib/discord'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const body: AlertPayload & { skipDedupe?: boolean; channels?: string[] } = await req.json()
  const channels = body.channels ?? ['telegram', 'email', 'discord']
  const isTest = body.skipDedupe === true

  // Server-side dedup (only for real alerts, not tests)
  // Deduplicates per channel independently so testing one channel doesn't block another
  if (!isTest) {
    try {
      const db = getSupabaseAdmin()
      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString()

      const blockedChannels = new Set<string>()
      for (const ch of channels) {
        const { data } = await db
          .from('alerts')
          .select('id')
          .eq('symbol', body.symbol)
          .eq('timeframe', body.timeframe)
          .eq('direction', body.direction)
          .ilike('channel', `%${ch}%`)
          .gte('sent_at', since)
          .limit(1)
        if (data && data.length > 0) blockedChannels.add(ch)
      }

      const remaining = channels.filter((c) => !blockedChannels.has(c))
      if (remaining.length === 0) {
        return NextResponse.json({ sent: false, reason: 'duplicate within 30min', blocked: [...blockedChannels] })
      }
      // Only send on non-blocked channels
      body.channels = remaining
    } catch {
      // If alerts table doesn't exist, skip server dedup
    }
  }

  const activeChannels = isTest ? channels : (body.channels ?? channels)

  // Send all channels in parallel
  const [telegramSent, emailSent, discordSent] = await Promise.all([
    activeChannels.includes('telegram') ? sendTelegramAlert(body) : Promise.resolve(false),
    activeChannels.includes('email')    ? sendEmailAlert(body)    : Promise.resolve(false),
    activeChannels.includes('discord')  ? sendDiscordAlert(body)  : Promise.resolve(false),
  ])

  const anySent = telegramSent || emailSent || discordSent

  // Only log to DB for real alerts (not tests), so tests don't pollute the dedup table
  if (anySent && !isTest) {
    try {
      const db = getSupabaseAdmin()
      const channelList = [
        telegramSent && 'telegram',
        emailSent    && 'email',
        discordSent  && 'discord',
      ].filter(Boolean).join(',')
      await db.from('alerts').insert([{
        symbol: body.symbol,
        timeframe: body.timeframe,
        direction: body.direction,
        confidence: body.confidence,
        channel: channelList,
      }])
    } catch {}
  }

  return NextResponse.json({
    sent: anySent,
    telegram: telegramSent,
    email: emailSent,
    discord: discordSent,
    test: isTest,
  })
}
