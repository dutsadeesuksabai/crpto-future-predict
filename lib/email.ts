import nodemailer from 'nodemailer'
import type { AlertPayload } from './telegram'
import { qualityLabel } from './telegram'

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
    auth: { user: process.env.EMAIL_SMTP_USER, pass: process.env.EMAIL_SMTP_PASS },
  })
}

function filterRow(label: string, icon: string, passed?: boolean) {
  if (passed === undefined) return ''
  return `
    <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #1f2937">
      <span style="font-size:16px">${icon}</span>
      <span style="color:${passed ? '#22c55e' : '#6b7280'};font-size:12px;flex:1">${label}</span>
      <span style="color:${passed ? '#22c55e' : '#ef4444'};font-size:12px;font-weight:700">${passed ? '✓ Pass' : '✗ Fail'}</span>
    </div>`
}

function buildHTML(p: AlertPayload): string {
  const isUp   = p.direction === 'up'
  const q      = p.signalQuality ?? 0
  const ql     = qualityLabel(q)
  const dirColor = isUp ? '#22c55e' : '#ef4444'
  const dirLabel = isUp ? '▲ ขึ้น' : '▼ ลง'
  const sym    = p.symbol.replace('USDT', '/USDT')

  // Quality-driven colors
  const qColor = q >= 80 ? '#a855f7' : q >= 65 ? '#22c55e' : q >= 50 ? '#f59e0b' : '#6b7280'
  const qBg    = q >= 80 ? '#2e1065' : q >= 65 ? '#052e16' : q >= 50 ? '#451a03' : '#111827'

  // Conf tier
  const confTier = p.confidence >= 90 ? '🔥 ULTRA' : p.confidence >= 80 ? '⚡ STRONG' : p.confidence >= 75 ? '✅ GOOD' : '📡 SIGNAL'

  const f = p.filters ?? {}

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#030712;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:480px;margin:0 auto;padding:24px">

  <!-- Quality badge (top, color = quality priority) -->
  <div style="background:${qBg};border:2px solid ${qColor};border-radius:12px;padding:12px 20px;text-align:center;margin-bottom:16px">
    <div style="color:${qColor};font-weight:900;font-size:20px;letter-spacing:0.04em">${ql.prefix}</div>
    <div style="color:${qColor}99;font-size:12px;margin-top:2px">${confTier} &nbsp;·&nbsp; Quality ${q}/100</div>
  </div>

  <!-- Quality progress bar -->
  <div style="margin-bottom:16px">
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="color:#6b7280;font-size:11px">Signal Quality</span>
      <span style="color:${qColor};font-size:11px;font-weight:700">${q}/100 — ${ql.badge}</span>
    </div>
    <div style="background:#1f2937;border-radius:999px;height:6px;overflow:hidden">
      <div style="background:${qColor};height:100%;width:${q}%;border-radius:999px;transition:width 0.5s"></div>
    </div>
  </div>

  <!-- Main card (left border = quality color) -->
  <div style="background:#111827;border-radius:16px;padding:20px;border-left:4px solid ${qColor};border-top:1px solid #1f2937;border-right:1px solid #1f2937;border-bottom:1px solid #1f2937;margin-bottom:16px">

    <div style="margin-bottom:14px">
      <div style="color:#6b7280;font-size:11px;margin-bottom:2px">Prediction · ${p.timeframe}</div>
      <div style="color:#fff;font-size:22px;font-weight:900">${sym}</div>
    </div>

    <!-- Direction + Confidence -->
    <div style="background:${isUp ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)'};border:1px solid ${dirColor}33;border-radius:12px;padding:14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="color:#6b7280;font-size:10px;margin-bottom:3px">ทิศทาง</div>
        <div style="color:${dirColor};font-size:26px;font-weight:900">${dirLabel}</div>
      </div>
      <div style="text-align:right">
        <div style="color:#6b7280;font-size:10px;margin-bottom:3px">Confidence</div>
        <div style="color:${dirColor};font-size:30px;font-weight:900">${p.confidence.toFixed(1)}%</div>
      </div>
    </div>

    <!-- Stats -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">
      <div style="background:#1f2937;border-radius:8px;padding:8px;text-align:center">
        <div style="color:#6b7280;font-size:10px;margin-bottom:2px">Price</div>
        <div style="color:#e5e7eb;font-size:11px;font-weight:700">$${p.price.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      </div>
      <div style="background:#1f2937;border-radius:8px;padding:8px;text-align:center">
        <div style="color:#6b7280;font-size:10px;margin-bottom:2px">Bull</div>
        <div style="color:#22c55e;font-size:11px;font-weight:700">${p.bullScore.toFixed(0)}%</div>
      </div>
      <div style="background:#1f2937;border-radius:8px;padding:8px;text-align:center">
        <div style="color:#6b7280;font-size:10px;margin-bottom:2px">Bear</div>
        <div style="color:#ef4444;font-size:11px;font-weight:700">${p.bearScore.toFixed(0)}%</div>
      </div>
    </div>

    <!-- Bull bar -->
    <div style="background:#1f2937;border-radius:999px;height:6px;overflow:hidden;margin-bottom:3px">
      <div style="background:linear-gradient(90deg,#22c55e,${qColor});height:100%;width:${p.bullScore}%;border-radius:999px"></div>
    </div>
    <div style="display:flex;justify-content:space-between">
      <span style="color:#6b7280;font-size:10px">Bear ${p.bearScore.toFixed(0)}%</span>
      <span style="color:#6b7280;font-size:10px">Bull ${p.bullScore.toFixed(0)}%</span>
    </div>
  </div>

  <!-- Signal Filters -->
  <div style="background:#111827;border-radius:12px;padding:16px;border:1px solid #1f2937">
    <div style="color:#9ca3af;font-size:12px;font-weight:700;margin-bottom:10px;letter-spacing:0.05em">🔍 SIGNAL FILTERS</div>
    ${filterRow('Trend Strength (ADX)', '📈', f.trendStrong)}
    ${filterRow('Volume Confirmed', '📊', f.volumeConfirmed)}
    ${filterRow('Consensus Clean (≥60%)', '🎯', f.consensusClean)}
    ${filterRow('No Strong Conflict', '🚫', f.noStrongConflict)}
    ${filterRow('Candles Aligned', '🕯', f.candleAligned)}
    ${filterRow('No RSI Divergence', '↗', f.noDivergence)}
  </div>

  <div style="text-align:center;margin-top:14px;color:#374151;font-size:10px">
    Crypto Predictor · MEXC · Quality ≥ 70 required · ${new Date().toLocaleString()}
  </div>
</div>
</body>
</html>`
}

function buildText(p: AlertPayload): string {
  const q  = p.signalQuality ?? 0
  const ql = qualityLabel(q)
  const sym = p.symbol.replace('USDT', '/USDT')
  const dir = p.direction === 'up' ? 'ขึ้น ▲' : 'ลง ▼'
  return [
    ql.prefix,
    ``,
    `${sym} · ${p.timeframe}`,
    `Direction: ${dir}`,
    `Confidence: ${p.confidence.toFixed(1)}%`,
    `Quality: ${q}/100 (${ql.badge})`,
    `Price: $${p.price.toLocaleString()}`,
    `Bull/Bear: ${p.bullScore.toFixed(0)}% / ${p.bearScore.toFixed(0)}%`,
    `Time: ${new Date().toLocaleString()}`,
  ].join('\n')
}

export async function sendEmailAlert(payload: AlertPayload): Promise<boolean> {
  if (!isEmailConfigured()) return false
  try {
    const transporter = createTransport()
    const sym    = payload.symbol.replace('USDT', '/USDT')
    const dir    = payload.direction === 'up' ? '▲ ขึ้น' : '▼ ลง'
    const q      = payload.signalQuality ?? 0
    const ql     = qualityLabel(q)
    const prefix = ql.badge === 'PURE' ? '🟣' : ql.badge === 'CLEAN' ? '🟢' : '🟡'

    await transporter.sendMail({
      from:    `"Crypto Predictor" <${process.env.EMAIL_SMTP_USER}>`,
      to:      process.env.EMAIL_TO,
      subject: `${prefix} ${ql.badge} ${sym} ${dir} · ${payload.confidence.toFixed(0)}% · Q${q} · ${payload.timeframe}`,
      text:    buildText(payload),
      html:    buildHTML(payload),
    })
    return true
  } catch (err) {
    console.error('Email send error:', err)
    return false
  }
}
