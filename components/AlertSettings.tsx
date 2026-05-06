'use client'

import { useState, useEffect } from 'react'

export type AlertConfig = {
  telegramEnabled: boolean
  emailEnabled: boolean
  discordEnabled: boolean
  thresholds: number[]   // list of confidence levels that trigger alerts, e.g. [75, 80, 90]
  autoSave: boolean
  autoSaveIntervalMin: number
}

interface Props {
  onConfigChange: (cfg: AlertConfig) => void
}

const THRESHOLD_OPTIONS = [60, 70, 75, 80, 90] as const

const DEFAULT: AlertConfig = {
  telegramEnabled: false,
  emailEnabled: false,
  discordEnabled: false,
  thresholds: [80],
  autoSave: false,
  autoSaveIntervalMin: 10,
}

type TestKey = 'telegram' | 'email' | 'discord'
type TestState = 'idle' | 'sending' | 'ok' | 'fail'

function Toggle({ on, onToggle, color = 'bg-green-600' }: { on: boolean; onToggle: () => void; color?: string }) {
  return (
    <button onClick={onToggle}
      className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${on ? color : 'bg-gray-700'}`}>
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function tierLabel(t: number) {
  if (t >= 90) return { label: 'Ultra',  color: 'bg-green-700 text-white border-green-600' }
  if (t >= 80) return { label: 'Strong', color: 'bg-amber-700 text-white border-amber-600' }
  if (t >= 75) return { label: 'Good',   color: 'bg-emerald-700 text-white border-emerald-600' }
  if (t >= 70) return { label: 'Normal', color: 'bg-gray-700 text-gray-200 border-gray-600' }
  return { label: 'Low', color: 'bg-gray-800 text-gray-400 border-gray-700' }
}

export function AlertSettings({ onConfigChange }: Props) {
  const [cfg, setCfg] = useState<AlertConfig>(DEFAULT)
  const [open, setOpen] = useState(false)
  const [testStatus, setTestStatus] = useState<Record<TestKey, TestState>>({ telegram: 'idle', email: 'idle', discord: 'idle' })

  useEffect(() => {
    const stored = localStorage.getItem('alertConfig')
    if (stored) {
      try {
        const raw = JSON.parse(stored)
        // migrate old single threshold → thresholds array
        if (typeof raw.threshold === 'number' && !raw.thresholds) {
          raw.thresholds = [raw.threshold]
          delete raw.threshold
        }
        const parsed: AlertConfig = { ...DEFAULT, ...raw }
        setCfg(parsed)
        onConfigChange(parsed)
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function update(patch: Partial<AlertConfig>) {
    const next = { ...cfg, ...patch }
    setCfg(next)
    localStorage.setItem('alertConfig', JSON.stringify(next))
    onConfigChange(next)
  }

  function toggleThreshold(t: number) {
    const has = cfg.thresholds.includes(t)
    const next = has ? cfg.thresholds.filter((x) => x !== t) : [...cfg.thresholds, t].sort((a, b) => a - b)
    update({ thresholds: next })
  }

  async function testAlert(channel: TestKey) {
    setTestStatus((s) => ({ ...s, [channel]: 'sending' }))
    try {
      const res = await fetch('/api/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTCUSDT', timeframe: '10m', direction: 'up',
          confidence: 85, price: 80000, bullScore: 65, bearScore: 35,
          skipDedupe: true,
          channels: [channel],
        }),
      })
      const d = await res.json()
      const sent = d[channel] ?? d.sent
      setTestStatus((s) => ({ ...s, [channel]: sent ? 'ok' : 'fail' }))
    } catch {
      setTestStatus((s) => ({ ...s, [channel]: 'fail' }))
    }
    setTimeout(() => setTestStatus((s) => ({ ...s, [channel]: 'idle' })), 3000)
  }

  const activeCount = [cfg.telegramEnabled, cfg.emailEnabled, cfg.discordEnabled].filter(Boolean).length
  const minThreshold = cfg.thresholds.length > 0 ? Math.min(...cfg.thresholds) : null

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800">
      <button onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-gray-400 font-semibold">Settings</span>
          {cfg.autoSave && <span className="text-xs bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded-full">Auto-save {cfg.autoSaveIntervalMin}m</span>}
          {cfg.telegramEnabled && <span className="text-xs bg-sky-900/50 text-sky-400 px-2 py-0.5 rounded-full">Telegram</span>}
          {cfg.emailEnabled && <span className="text-xs bg-purple-900/50 text-purple-400 px-2 py-0.5 rounded-full">Email</span>}
          {cfg.discordEnabled && <span className="text-xs bg-indigo-900/50 text-indigo-400 px-2 py-0.5 rounded-full">Discord</span>}
          {activeCount > 0 && cfg.thresholds.length > 0 && (
            <span className="text-xs text-gray-600">≥{cfg.thresholds.join('/')}%</span>
          )}
        </div>
        <span className="text-gray-600 ml-2">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-5 border-t border-gray-800 pt-4 space-y-5">

          {/* Auto-save */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm text-gray-300 font-medium">Auto-save Predictions</div>
                <div className="text-xs text-gray-600">Save to Supabase every N minutes automatically</div>
              </div>
              <Toggle on={cfg.autoSave} onToggle={() => update({ autoSave: !cfg.autoSave })} color="bg-blue-600" />
            </div>
            {cfg.autoSave && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-500">Interval:</span>
                {[5, 10, 15, 30].map((m) => (
                  <button key={m} onClick={() => update({ autoSaveIntervalMin: m })}
                    className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${cfg.autoSaveIntervalMin === m ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                    {m}m
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-gray-800" />

          {/* Alert thresholds — multi-select */}
          {activeCount > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-1">Alert when confidence reaches (select multiple)</div>
              <div className="text-xs text-purple-400/80 mb-2">⚡ Requires Signal Quality ≥ 70 (Pure/Clean only)</div>
              <div className="flex items-center gap-2 flex-wrap">
                {THRESHOLD_OPTIONS.map((t) => {
                  const { label, color } = tierLabel(t)
                  const active = cfg.thresholds.includes(t)
                  return (
                    <button key={t} onClick={() => toggleThreshold(t)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-semibold ${active ? color : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-500'}`}>
                      ≥{t}% <span className="opacity-70">{label}</span>
                    </button>
                  )
                })}
              </div>
              {cfg.thresholds.length === 0 && (
                <div className="text-xs text-yellow-600 mt-1">Select at least one threshold to receive alerts</div>
              )}
            </div>
          )}

          {/* Telegram */}
          <div className="bg-gray-800/40 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">✈️</span>
                <div>
                  <div className="text-sm text-gray-300 font-medium">Telegram Alerts</div>
                  <div className="text-xs text-gray-600">Requires TELEGRAM_BOT_TOKEN + CHAT_ID in .env</div>
                </div>
              </div>
              <Toggle on={cfg.telegramEnabled} onToggle={() => update({ telegramEnabled: !cfg.telegramEnabled })} />
            </div>
            {cfg.telegramEnabled && (
              <TestButton status={testStatus.telegram} onClick={() => testAlert('telegram')} label="Test Telegram" />
            )}
          </div>

          {/* Discord */}
          <div className="bg-gray-800/40 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎮</span>
                <div>
                  <div className="text-sm text-gray-300 font-medium">Discord Alerts</div>
                  <div className="text-xs text-gray-600">Requires DISCORD_WEBHOOK_URL in .env</div>
                </div>
              </div>
              <Toggle on={cfg.discordEnabled} onToggle={() => update({ discordEnabled: !cfg.discordEnabled })} color="bg-indigo-600" />
            </div>
            {cfg.discordEnabled && (
              <TestButton status={testStatus.discord} onClick={() => testAlert('discord')} label="Test Discord" />
            )}
          </div>

          {/* Email */}
          <div className="bg-gray-800/40 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">📧</span>
                <div>
                  <div className="text-sm text-gray-300 font-medium">Email Alerts</div>
                  <div className="text-xs text-gray-600">Requires EMAIL_SMTP_* + EMAIL_TO in .env</div>
                </div>
              </div>
              <Toggle on={cfg.emailEnabled} onToggle={() => update({ emailEnabled: !cfg.emailEnabled })} color="bg-purple-600" />
            </div>
            {cfg.emailEnabled && (
              <div className="space-y-2">
                <TestButton status={testStatus.email} onClick={() => testAlert('email')} label="Test Email" />
                <div className="text-xs text-gray-600 bg-gray-900/50 rounded-lg px-3 py-2 space-y-0.5">
                  <div>Gmail: use App Password (not regular password)</div>
                  <div>Settings → Security → 2-Step → App Passwords</div>
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}

function TestButton({ status, onClick, label }: { status: TestState; onClick: () => void; label: string }) {
  const styles: Record<TestState, string> = {
    idle:    'bg-gray-700 hover:bg-gray-600 text-gray-300',
    sending: 'bg-gray-700 text-gray-500 cursor-wait',
    ok:      'bg-green-900/50 text-green-400 cursor-default',
    fail:    'bg-red-900/50 text-red-400 cursor-default',
  }
  const labels: Record<TestState, string> = {
    idle: label, sending: 'Sending…', ok: '✓ Sent successfully!', fail: '✗ Failed — check .env.local',
  }
  return (
    <button onClick={status === 'idle' ? onClick : undefined} disabled={status !== 'idle'}
      className={`text-xs px-3 py-1.5 rounded-lg transition-colors w-full text-center ${styles[status]}`}>
      {labels[status]}
    </button>
  )
}
