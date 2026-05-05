import nodemailer from 'nodemailer'
import type { AlertPayload } from './telegram'

function isEmailConfigured() {
  return (
    process.env.EMAIL_SMTP_HOST &&
    process.env.EMAIL_SMTP_USER &&
    process.env.EMAIL_SMTP_PASS &&
    process.env.EMAIL_TO &&
    process.env.EMAIL_SMTP_USER !== 'your_email@gmail.com'
  )
}

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_SMTP_HOST,
    port: parseInt(process.env.EMAIL_SMTP_PORT || '587'),
    secure: process.env.EMAIL_SMTP_PORT === '465',
    auth: {
      user: process.env.EMAIL_SMTP_USER,
      pass: process.env.EMAIL_SMTP_PASS,
    },
  })
}

function buildHTML(p: AlertPayload): string {
  const isUp = p.direction === 'up'
  const tier =
    p.confidence >= 90 ? { label: '🔥 ULTRA SIGNAL', color: '#a855f7', bg: '#2e1065' } :
    p.confidence >= 80 ? { label: '⚡ STRONG SIGNAL', color: '#f59e0b', bg: '#451a03' } :
                         { label: '✅ GOOD SIGNAL',   color: '#22c55e', bg: '#052e16' }
  const dirColor = isUp ? '#22c55e' : '#ef4444'
  const dirLabel = isUp ? '▲ BULLISH' : '▼ BEARISH'
  const sym = p.symbol.replace('USDT', '/USDT')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#030712;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:480px;margin:0 auto;padding:24px">

    <!-- Tier badge -->
    <div style="background:${tier.bg};border:1px solid ${tier.color};border-radius:12px;padding:10px 16px;text-align:center;margin-bottom:20px">
      <span style="color:${tier.color};font-weight:800;font-size:16px;letter-spacing:0.05em">${tier.label}</span>
    </div>

    <!-- Main card -->
    <div style="background:#111827;border-radius:16px;padding:24px;border:1px solid #1f2937">

      <!-- Symbol + timeframe -->
      <div style="margin-bottom:16px">
        <div style="color:#6b7280;font-size:12px;margin-bottom:4px">Prediction · ${p.timeframe}</div>
        <div style="color:#fff;font-size:22px;font-weight:900">${sym}</div>
      </div>

      <!-- Direction banner -->
      <div style="background:${isUp ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'};border:1px solid ${dirColor}30;border-radius:12px;padding:16px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="color:#6b7280;font-size:11px;margin-bottom:4px">Expected direction</div>
          <div style="color:${dirColor};font-size:24px;font-weight:900">${dirLabel}</div>
        </div>
        <div style="text-align:right">
          <div style="color:#6b7280;font-size:11px;margin-bottom:4px">Confidence</div>
          <div style="color:${tier.color};font-size:28px;font-weight:900">${p.confidence.toFixed(1)}%</div>
        </div>
      </div>

      <!-- Stats row -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
        <div style="background:#1f2937;border-radius:8px;padding:10px;text-align:center">
          <div style="color:#6b7280;font-size:10px;margin-bottom:2px">Price</div>
          <div style="color:#e5e7eb;font-size:12px;font-weight:700">$${p.price.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        </div>
        <div style="background:#1f2937;border-radius:8px;padding:10px;text-align:center">
          <div style="color:#6b7280;font-size:10px;margin-bottom:2px">Bull Score</div>
          <div style="color:#22c55e;font-size:12px;font-weight:700">${p.bullScore.toFixed(0)}%</div>
        </div>
        <div style="background:#1f2937;border-radius:8px;padding:10px;text-align:center">
          <div style="color:#6b7280;font-size:10px;margin-bottom:2px">Bear Score</div>
          <div style="color:#ef4444;font-size:12px;font-weight:700">${p.bearScore.toFixed(0)}%</div>
        </div>
      </div>

      <!-- Bull/Bear bar -->
      <div style="background:#1f2937;border-radius:999px;height:8px;overflow:hidden">
        <div style="background:linear-gradient(90deg,#22c55e,${tier.color});height:100%;width:${p.bullScore}%;border-radius:999px"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:4px">
        <span style="color:#6b7280;font-size:10px">Bear ${p.bearScore.toFixed(0)}%</span>
        <span style="color:#6b7280;font-size:10px">Bull ${p.bullScore.toFixed(0)}%</span>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:16px;color:#374151;font-size:11px">
      Crypto Predictor · MEXC Data · ${new Date().toLocaleString()}
    </div>
  </div>
</body>
</html>`
}

function buildText(p: AlertPayload): string {
  const sym = p.symbol.replace('USDT', '/USDT')
  const dir = p.direction === 'up' ? 'BULLISH ▲' : 'BEARISH ▼'
  const tier = p.confidence >= 90 ? 'ULTRA SIGNAL 🔥' : p.confidence >= 80 ? 'STRONG SIGNAL ⚡' : 'GOOD SIGNAL ✓'
  return [
    `${tier}`,
    ``,
    `${sym} · ${p.timeframe} Prediction`,
    `Direction: ${dir}`,
    `Confidence: ${p.confidence.toFixed(1)}%`,
    `Price: $${p.price.toLocaleString()}`,
    `Bull/Bear: ${p.bullScore.toFixed(0)}% / ${p.bearScore.toFixed(0)}%`,
    ``,
    `Time: ${new Date().toLocaleString()}`,
  ].join('\n')
}

export async function sendEmailAlert(payload: AlertPayload): Promise<boolean> {
  if (!isEmailConfigured()) return false

  try {
    const transporter = createTransport()
    const sym = payload.symbol.replace('USDT', '/USDT')
    const dir = payload.direction === 'up' ? '▲ BULLISH' : '▼ BEARISH'
    const tier = payload.confidence >= 90 ? '🔥 ULTRA' : payload.confidence >= 80 ? '⚡ STRONG' : '✅'

    await transporter.sendMail({
      from: `"Crypto Predictor" <${process.env.EMAIL_SMTP_USER}>`,
      to: process.env.EMAIL_TO,
      subject: `${tier} ${sym} ${dir} · ${payload.confidence.toFixed(0)}% · ${payload.timeframe}`,
      text: buildText(payload),
      html: buildHTML(payload),
    })
    return true
  } catch (err) {
    console.error('Email send error:', err)
    return false
  }
}
