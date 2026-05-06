import type { AlertPayload } from './telegram'
import { qualityLabel } from './telegram'

function isDiscordConfigured() {
  const url = process.env.DISCORD_WEBHOOK_URL
  return url && url.startsWith('https://discord') && !url.includes('your_webhook')
}

/** Quality → Discord embed accent color (left border stripe) */
function qualityColor(q: number): number {
  if (q >= 80) return 0xa855f7   // 🟣 Pure  — purple
  if (q >= 65) return 0x22c55e   // 🟢 Clean — green
  if (q >= 50) return 0xf59e0b   // 🟡 Mixed — amber
  return              0x4b5563   // ⚫ Noisy — gray
}

function filterBadges(filters?: AlertPayload['filters']): string {
  if (!filters) return '—'
  const map: Record<string, string> = {
    trendStrong:      '📈',
    volumeConfirmed:  '📊',
    consensusClean:   '🎯',
    noStrongConflict: '🚫',
    candleAligned:    '🕯',
    noDivergence:     '↗',
  }
  return Object.entries(filters)
    .map(([k, v]) => `${v ? '✅' : '❌'}${map[k] ?? k}`)
    .join('  ') || '—'
}

function buildEmbed(p: AlertPayload) {
  const q    = p.signalQuality ?? 0
  const ql   = qualityLabel(q)
  const isUp = p.direction === 'up'
  const sym  = p.symbol.replace('USDT', '/USDT')
  const dirEmoji = isUp ? '🟢' : '🔴'
  const dirLabel = isUp ? '▲ ขึ้น' : '▼ ลง'
  const color    = qualityColor(q)

  // Confidence tier label
  const confTier = p.confidence >= 90 ? '🔥 ULTRA' : p.confidence >= 80 ? '⚡ STRONG' : p.confidence >= 75 ? '✅ GOOD' : '📡 SIGNAL'

  // Bull bar visual
  const bullFill  = Math.round(p.bullScore / 10)
  const bullBar   = '█'.repeat(bullFill) + '░'.repeat(10 - bullFill)

  // Quality progress bar
  const qFill  = Math.round(q / 10)
  const qBar   = '█'.repeat(qFill) + '░'.repeat(10 - qFill)

  return {
    embeds: [
      {
        // Quality label at title front, with signal tier
        title: `${ql.prefix}  ·  ${confTier}  ·  ${sym} ${p.timeframe}`,
        // Left border color = quality color
        color,
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
            name: `⭐ Signal Quality — ${ql.badge} (${q}/100)`,
            value: `\`${qBar}\``,
            inline: false,
          },
          {
            name: '📊 Bull / Bear',
            value: `\`${bullBar}\`\nBull **${p.bullScore.toFixed(0)}%** · Bear **${p.bearScore.toFixed(0)}%**`,
            inline: false,
          },
          {
            name: '🔍 Signal Filters',
            value: filterBadges(p.filters),
            inline: false,
          },
        ],
        footer: { text: `Crypto Predictor · MEXC · Quality ≥ 70 required` },
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
