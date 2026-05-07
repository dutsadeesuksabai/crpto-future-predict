'use client'

import { useState } from 'react'
import { STRATEGIES, type Strategy } from '@/lib/strategies'

type Props = {
  selected: Strategy
  onChange: (s: Strategy) => void
}

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  '#3b82f6': { bg: 'rgba(59,130,246,0.12)',  border: '#3b82f6', text: '#93c5fd', badge: 'rgba(59,130,246,0.25)'  },
  '#10b981': { bg: 'rgba(16,185,129,0.12)',  border: '#10b981', text: '#6ee7b7', badge: 'rgba(16,185,129,0.25)'  },
  '#f97316': { bg: 'rgba(249,115,22,0.12)',  border: '#f97316', text: '#fdba74', badge: 'rgba(249,115,22,0.25)'  },
  '#06b6d4': { bg: 'rgba(6,182,212,0.12)',   border: '#06b6d4', text: '#67e8f9', badge: 'rgba(6,182,212,0.25)'   },
  '#eab308': { bg: 'rgba(234,179,8,0.12)',   border: '#eab308', text: '#fde047', badge: 'rgba(234,179,8,0.25)'   },
  '#ef4444': { bg: 'rgba(239,68,68,0.12)',   border: '#ef4444', text: '#fca5a5', badge: 'rgba(239,68,68,0.25)'   },
  '#a855f7': { bg: 'rgba(168,85,247,0.12)',  border: '#a855f7', text: '#d8b4fe', badge: 'rgba(168,85,247,0.25)'  },
}

function getColor(hex: string) {
  return COLOR_MAP[hex] ?? COLOR_MAP['#3b82f6']
}

/** Render the weight distribution as a small bar chart */
function WeightBar({ strategy }: { strategy: Strategy }) {
  const wm = strategy.weightMult
  const entries: [string, number][] = [
    ['Osc', wm.oscillators],
    ['Trend', wm.trend],
    ['Vol', wm.volume],
    ['Mom', wm.momentum],
    ['VWAP', wm.vwap],
    ['Div', wm.divergence],
    ['MTF', wm.mtf],
  ]
  const max = Math.max(...entries.map(([, v]) => v), 2.0)
  const col = getColor(strategy.accentColor)
  return (
    <div className="flex items-end gap-0.5 h-6">
      {entries.map(([label, val]) => (
        <div key={label} className="flex flex-col items-center gap-0.5" style={{ minWidth: 18 }}>
          <div
            className="w-full rounded-sm"
            style={{
              height: Math.max(3, (val / max) * 20),
              background: val >= 1.5 ? col.border : val >= 1.0 ? col.text : 'rgba(107,114,128,0.5)',
              opacity: val < 0.6 ? 0.4 : 1,
            }}
          />
        </div>
      ))}
    </div>
  )
}

export function StrategySelector({ selected, onChange }: Props) {
  const [open, setOpen] = useState(false)

  const selCol = getColor(selected.accentColor)

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'rgba(75,85,99,0.6)', background: 'rgba(17,24,39,0.8)' }}>
      {/* Header — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{selected.emoji}</span>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{selected.name}</span>
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: selCol.badge, color: selCol.text }}
              >
                {selected.tag}
              </span>
              {selected.confidenceAdj !== 0 && (
                <span className="text-xs text-gray-500">
                  Conf {selected.confidenceAdj > 0 ? '+' : ''}{selected.confidenceAdj}%
                </span>
              )}
              {selected.maxConfidence < 95 && (
                <span className="text-xs text-gray-500">cap {selected.maxConfidence}%</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{selected.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 hidden sm:block">⌨ G</span>
          <svg
            className="w-4 h-4 text-gray-500 transition-transform"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Strategy Grid — collapsible */}
      {open && (
        <div className="px-4 pb-4 border-t border-gray-800/60">
          <p className="text-xs text-gray-600 mt-3 mb-3">เลือกสูตรการคำนวณ Prediction — จะ recalculate ทันทีโดยไม่ต้อง refresh</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
            {STRATEGIES.map((s) => {
              const isSelected = s.id === selected.id
              const col = getColor(s.accentColor)
              return (
                <button
                  key={s.id}
                  onClick={() => { onChange(s); setOpen(false) }}
                  className="relative flex flex-col items-start gap-2 p-3 rounded-xl text-left transition-all"
                  style={{
                    background: isSelected ? col.bg : 'rgba(31,41,55,0.5)',
                    border: `1.5px solid ${isSelected ? col.border : 'rgba(55,65,81,0.6)'}`,
                    boxShadow: isSelected ? `0 0 12px ${col.border}40` : 'none',
                  }}
                >
                  {/* Selected checkmark */}
                  {isSelected && (
                    <div
                      className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-xs"
                      style={{ background: col.border }}
                    >
                      ✓
                    </div>
                  )}

                  {/* Emoji + name */}
                  <div>
                    <div className="text-xl mb-1">{s.emoji}</div>
                    <div className="text-xs font-semibold text-white leading-tight">{s.name}</div>
                  </div>

                  {/* Tag badge */}
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{ background: col.badge, color: col.text, fontSize: 10 }}
                  >
                    {s.tag}
                  </span>

                  {/* Weight distribution mini-chart */}
                  <WeightBar strategy={s} />

                  {/* Stats */}
                  <div className="text-xs text-gray-500 space-y-0.5 w-full">
                    {s.confidenceAdj !== 0 && (
                      <div>Conf <span style={{ color: s.confidenceAdj > 0 ? '#4ade80' : '#f87171' }}>
                        {s.confidenceAdj > 0 ? '+' : ''}{s.confidenceAdj}%
                      </span></div>
                    )}
                    <div>Cap <span className="text-gray-400">{s.maxConfidence}%</span></div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Weight legend */}
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-600">
            <span>Bar height = weight multiplier</span>
            <span style={{ color: getColor(selected.accentColor).border }}>■</span>
            <span>≥1.5×</span>
            <span style={{ color: getColor(selected.accentColor).text }}>■</span>
            <span>≥1.0×</span>
            <span className="text-gray-600">■ &lt;0.6× (reduced)</span>
            <span className="ml-auto">Osc·Trend·Vol·Mom·VWAP·Div·MTF</span>
          </div>
        </div>
      )}
    </div>
  )
}
