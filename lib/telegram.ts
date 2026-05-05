export type AlertPayload = {
  symbol: string
  timeframe: string
  direction: 'up' | 'down'
  confidence: number
  price: number
  bullScore: number
  bearScore: number
}

function formatMessage(p: AlertPayload): string {
  const dir = p.direction === 'up' ? '🟢 BULLISH ▲' : '🔴 BEARISH ▼'
  const tier =
    p.confidence >= 90 ? '🔥 ULTRA SIGNAL' :
    p.confidence >= 80 ? '⚡ STRONG SIGNAL' :
    '✅ GOOD SIGNAL'
  const sym = p.symbol.replace('USDT', '/USDT')

  return [
    `${tier}`,
    ``,
    `📊 *${sym}* · ${p.timeframe} Prediction`,
    `Direction: ${dir}`,
    `Confidence: *${p.confidence.toFixed(1)}%*`,
    `Price: $${p.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `Bull/Bear: ${p.bullScore.toFixed(0)}% / ${p.bearScore.toFixed(0)}%`,
    ``,
    `_Crypto Predictor · MEXC Data_`,
  ].join('\n')
}

export async function sendTelegramAlert(payload: AlertPayload): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId || token === 'your_bot_token_here') return false

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: formatMessage(payload),
        parse_mode: 'Markdown',
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export function shouldAlert(confidence: number, threshold = 80): boolean {
  return confidence >= threshold
}
