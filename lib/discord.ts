import type { AlertPayload } from './telegram'

function isDiscordConfigured() {
  const url = process.env.DISCORD_WEBHOOK_URL
  return url && url.startsWith('https://discord') && !url.includes('your_webhook')
}

function buildEmbed(p: AlertPayload) {
  const isUp = p.direction === 'up'
  const tier =
    p.confidence >= 90 ? { label: '🔥 ULTRA SIGNAL', color: 0xa855f7 } :
    p.confidence >= 80 ? { label: '⚡ STRONG SIGNAL', color: 0xf59e0b } :
    p.confidence >= 75 ? { label: '✅ GOOD SIGNAL',   color: 0x22c55e } :
                         { label: 'SIGNAL',            color: 0x6b7280 }

  const sym = p.symbol.replace('USDT', '/USDT')
  const dirEmoji = isUp ? '🟢' : '🔴'
  const dirLabel = isUp ? '▲ BULLISH' : '▼ BEARISH'
  const bullBar = '█'.repeat(Math.round(p.bullScore / 10)) + '░'.repeat(10 - Math.round(p.bullScore / 10))

  return {
    embeds: [
      {
        title: `${tier.label}  ·  ${sym}  ·  ${p.timeframe}`,
        color: tier.color,
        fields: [
          {
            name: `${dirEmoji} Direction`,
            value: `**${dirLabel}**`,
            inline: true,
          },
          {
            name: '🎯 Confidence',
            value: `**${p.confidence.toFixed(1)}%**`,
            inline: true,
          },
          {
            name: '💰 Price',
            value: `$${p.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            inline: true,
          },
          {
            name: '📊 Bull / Bear Score',
            value: `\`${bullBar}\`\nBull **${p.bullScore.toFixed(0)}%** · Bear **${p.bearScore.toFixed(0)}%**`,
            inline: false,
          },
        ],
        footer: { text: 'Crypto Predictor · MEXC Data' },
        timestamp: new Date().toISOString(),
      },
    ],
  }
}

export async function sendDiscordAlert(payload: AlertPayload): Promise<boolean> {
  if (!isDiscordConfigured()) return false
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL!

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildEmbed(payload)),
    })
    return res.ok
  } catch {
    return false
  }
}
