'use client'

import type { OrderBookData } from '@/lib/orderbook'

export function OrderBookPanel({ ob }: { ob: OrderBookData }) {
  const imb = ob.imbalance
  const bullPct = Math.max(5, Math.min(95, 50 + imb * 0.5))
  const bearPct = 100 - bullPct
  const isBullish = imb > 0
  const strength = Math.abs(imb)
  const label = strength > 30 ? (isBullish ? 'Strong Buy Pressure' : 'Strong Sell Pressure')
    : strength > 10 ? (isBullish ? 'Slight Buy Pressure' : 'Slight Sell Pressure')
    : 'Balanced'

  return (
    <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-xs font-semibold">Order Book Depth</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isBullish ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
          {label}
        </span>
      </div>

      {/* Bid/Ask bar */}
      <div className="flex rounded-lg overflow-hidden h-6 mb-3">
        <div className="flex items-center justify-center text-xs font-bold text-green-300 bg-green-900/50 transition-all duration-500"
          style={{ width: `${bullPct}%` }}>
          {bullPct > 20 && `Bid ${bullPct.toFixed(0)}%`}
        </div>
        <div className="flex items-center justify-center text-xs font-bold text-red-300 bg-red-900/50 transition-all duration-500"
          style={{ width: `${bearPct}%` }}>
          {bearPct > 20 && `Ask ${bearPct.toFixed(0)}%`}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-gray-600">Bid Vol</div>
          <div className="text-green-400 font-medium">{ob.bidVolume.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-gray-600">Ask Vol</div>
          <div className="text-red-400 font-medium">{ob.askVolume.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-gray-600">Spread</div>
          <div className="text-gray-300 font-medium">{ob.spreadPct.toFixed(4)}%</div>
        </div>
        <div>
          <div className="text-gray-600">Top Bid</div>
          <div className="text-green-400">${ob.topBidPrice.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-gray-600">Top Ask</div>
          <div className="text-red-400">${ob.topAskPrice.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-gray-600">Imbalance</div>
          <div className={`font-bold ${isBullish ? 'text-green-400' : 'text-red-400'}`}>
            {isBullish ? '+' : ''}{imb.toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  )
}
