'use client'

import type { TradeSetup } from '@/lib/targets'
import { fmtPrice } from '@/lib/targets'

interface Props {
  setup10m: TradeSetup
  setup30m: TradeSetup
  currentPrice: number
}

function RRBadge({ rr }: { rr: number }) {
  const color = rr >= 2 ? 'text-green-400 bg-green-900/40 border-green-800'
              : rr >= 1.5 ? 'text-emerald-400 bg-emerald-900/30 border-emerald-800'
              : 'text-amber-400 bg-amber-900/30 border-amber-800'
  return (
    <span className={`text-xs font-black px-2 py-0.5 rounded-lg border ${color}`}>
      {rr.toFixed(2)} R:R
    </span>
  )
}

function PriceRow({ label, price, color, pct, bold = false }: {
  label: string; price: number; color: string; pct?: number; bold?: boolean
}) {
  return (
    <div className={`flex items-center justify-between py-1.5 border-b border-gray-800/60 ${bold ? 'font-bold' : ''}`}>
      <span className={`text-xs ${color}`}>{label}</span>
      <div className="text-right">
        <span className={`text-xs font-mono ${color}`}>${fmtPrice(price)}</span>
        {pct !== undefined && (
          <span className={`ml-2 text-xs ${pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
          </span>
        )}
      </div>
    </div>
  )
}

function SetupCard({ setup, currentPrice, label }: { setup: TradeSetup; currentPrice: number; label: string }) {
  const isUp = setup.direction === 'up'
  const accentColor = isUp ? '#22c55e' : '#ef4444'
  const tpPct1 = ((setup.tp1 - currentPrice) / currentPrice) * 100
  const tpPct2 = ((setup.tp2 - currentPrice) / currentPrice) * 100
  const tpPct3 = ((setup.tp3 - currentPrice) / currentPrice) * 100
  const slPct  = ((setup.stopLoss - currentPrice) / currentPrice) * 100

  // Visual bar: range from SL to TP2, mark current + entry + TP levels
  const lo    = Math.min(setup.stopLoss, currentPrice) * 0.999
  const hi    = Math.max(setup.tp2, currentPrice) * 1.001
  const range = hi - lo
  const toBar = (p: number) => Math.max(0, Math.min(100, ((p - lo) / range) * 100))

  const curBar    = toBar(currentPrice)
  const entryBar  = toBar(setup.entryIdeal)
  const slBar     = toBar(setup.stopLoss)
  const tp1Bar    = toBar(setup.tp1)
  const tp2Bar    = toBar(setup.tp2)

  return (
    <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Trade Setup</span>
          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-black px-2.5 py-1 rounded-full"
            style={{ background: isUp ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: accentColor }}>
            {isUp ? '▲ ขึ้น' : '▼ ลง'}
          </span>
          <RRBadge rr={setup.rrRatio} />
        </div>
      </div>

      {/* Visual price bar */}
      <div className="relative h-8 mb-3 rounded-lg bg-gray-800 overflow-hidden">
        {/* SL zone */}
        <div className="absolute top-0 h-full bg-red-900/40"
          style={{ left: `${isUp ? 0 : tp1Bar}%`, width: `${isUp ? slBar : (100 - tp1Bar)}%` }} />
        {/* TP zone */}
        <div className="absolute top-0 h-full bg-green-900/30"
          style={{ left: `${isUp ? tp1Bar : tp2Bar}%`, width: `${isUp ? (tp2Bar - tp1Bar) : (100 - tp2Bar)}%` }} />

        {/* SL line */}
        <div className="absolute top-0 h-full w-0.5 bg-red-500" style={{ left: `${slBar}%` }} />
        {/* Entry line */}
        <div className="absolute top-0 h-full w-0.5 bg-amber-400" style={{ left: `${entryBar}%` }} />
        {/* TP1 line */}
        <div className="absolute top-0 h-full w-0.5 bg-green-400" style={{ left: `${tp1Bar}%` }} />
        {/* TP2 line */}
        <div className="absolute top-0 h-full w-0.5 bg-green-300/60" style={{ left: `${tp2Bar}%` }} />
        {/* Current price */}
        <div className="absolute top-0 h-full w-1 rounded-sm" style={{ left: `${curBar}%`, background: accentColor }} />

        {/* Labels */}
        <div className="absolute bottom-0.5 left-1 text-red-400 text-[9px] font-bold">SL</div>
        <div className="absolute bottom-0.5 text-amber-400 text-[9px] font-bold" style={{ left: `${entryBar}%` }}>E</div>
        <div className="absolute bottom-0.5 text-green-400 text-[9px] font-bold" style={{ left: `${tp1Bar - 4}%` }}>TP1</div>
        <div className="absolute bottom-0.5 text-green-300 text-[9px]" style={{ left: `${tp2Bar - 4}%` }}>TP2</div>
      </div>

      {/* Price table */}
      <div className="space-y-0.5">
        <PriceRow label="💰 Entry Zone" price={setup.entryIdeal}
          color="text-amber-400" bold />
        <PriceRow label="🛑 Stop Loss" price={setup.stopLoss}
          color="text-red-400" pct={slPct} />
        <PriceRow label="🎯 TP 1 (1:1)" price={setup.tp1}
          color="text-green-400" pct={isUp ? tpPct1 : -tpPct1} />
        <PriceRow label="🎯 TP 2 (2:1)" price={setup.tp2}
          color="text-emerald-400" pct={isUp ? tpPct2 : -tpPct2} />
        <PriceRow label="🚀 TP 3 (3:1)" price={setup.tp3}
          color="text-cyan-400" pct={isUp ? tpPct3 : -tpPct3} />
      </div>

      {/* Risk summary */}
      <div className="flex justify-between mt-3 pt-2 border-t border-gray-800">
        <div className="text-center">
          <div className="text-xs text-gray-500">Risk</div>
          <div className="text-sm font-bold text-red-400">{setup.riskPct.toFixed(2)}%</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500">ATR</div>
          <div className="text-sm font-bold text-gray-300">${fmtPrice(setup.atrValue)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500">R:R Ratio</div>
          <div className="text-sm font-bold text-green-400">{setup.rrRatio.toFixed(2)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500">Reward</div>
          <div className="text-sm font-bold text-green-400">{setup.rewardPct1.toFixed(2)}%</div>
        </div>
      </div>
    </div>
  )
}

export function TradeSetupPanel({ setup10m, setup30m, currentPrice }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SetupCard setup={setup10m} currentPrice={currentPrice} label="10m" />
      <SetupCard setup={setup30m} currentPrice={currentPrice} label="30m" />
    </div>
  )
}
