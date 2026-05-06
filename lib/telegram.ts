export type AlertPayload = {
  symbol: string
  timeframe: string
  direction: 'up' | 'down'
  confidence: number
  price: number
  bullScore: number
  bearScore: number
  signalQuality?: number   // 0-100 quality score
  filters?: {
    trendStrong?: boolean
    volumeConfirmed?: boolean
    consensusClean?: boolean
    noStrongConflict?: boolean
    candleAligned?: boolean
    noDivergence?: boolean
  }
}

/** Quality label + emoji prefix shown at the very top of every alert */
export function qualityLabel(q = 0): { prefix: string; badge: string } {
  if (q >= 80) return { prefix: '🟣 Pure Signal',  badge: 'PURE'  }
  if (q >= 65) return { prefix: '🟢 Clean Signal', badge: 'CLEAN' }
  if (q >= 50) return { prefix: '🟡 Mixed Signal', badge: 'MIXED' }
  return              { prefix: '⚫ Noisy Signal', badge: 'NOISY' }
}

function filterLine(filters?: AlertPayload['filters']): string {
  if (!filters) return ''
  const icons: Record<string, string> = {
    trendStrong:      '📈Trend',
    volumeConfirmed:  '📊Vol',
    consensusClean:   '🎯Consensus',
    noStrongConflict: '🚫NoConflict',
    candleAligned:    '🕯Candles',
    noDivergence:     '↗NoDiv',
  }
  const parts = Object.entries(filters)
    .map(([k, v]) => `${v ? '✓' : '✗'}${icons[k] ?? k}`)
    .join('  ')
  return parts ? `\`${parts}\`` : ''
}

function formatMessage(p: AlertPayload): string {
  const q    = p.signalQuality ?? 0
  const ql   = qualityLabel(q)
  const dir  = p.direction === 'up' ? '🟢 ขึ้น ▲' : '🔴 ลง ▼'
  const tier = p.confidence >= 90 ? '🔥 ULTRA' : p.confidence >= 80 ? '⚡ STRONG' : p.confidence >= 75 ? '✅ GOOD' : '📡'
  const sym  = p.symbol.replace('USDT', '/USDT')
  const fl   = filterLine(p.filters)

  return [
    `*${ql.prefix}*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `${tier}  📊 *${sym}* · ${p.timeframe}`,
    ``,
    `Direction: ${dir}`,
    `Confidence: *${p.confidence.toFixed(1)}%*`,
    `Quality: *${q}/100* (${ql.badge})`,
    `Price: $${p.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `Bull/Bear: ${p.bullScore.toFixed(0)}% / ${p.bearScore.toFixed(0)}%`,
    ...(fl ? [``, `Filters: ${fl}`] : []),
    ``,
    `_Crypto Predictor · MEXC_`,
  ].join('\n')
}

export async function sendTelegramAlert(payload: AlertPayload): Promise<boolean> {
  const token  = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId || token === 'your_bot_token_here') return false
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: formatMessage(payload), parse_mode: 'Markdown' }),
    })
    return res.ok
  } catch {
    return false
  }
}

export function shouldAlert(confidence: number, threshold = 80): boolean {
  return confidence >= threshold
}
