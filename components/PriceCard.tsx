'use client'

import type { TickerPrice } from '@/lib/mexc'

interface Props {
  ticker: TickerPrice
}

export function PriceCard({ ticker }: Props) {
  const isUp = ticker.priceChangePercent >= 0
  const symbol = ticker.symbol.replace('USDT', '')

  return (
    <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-xs font-bold">
            {symbol[0]}
          </div>
          <span className="text-gray-300 font-semibold text-lg">{symbol}/USDT</span>
        </div>
        <span className={`text-sm font-medium px-2 py-1 rounded-full ${isUp ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
          {isUp ? '+' : ''}{ticker.priceChangePercent.toFixed(2)}%
        </span>
      </div>
      <div className="text-3xl font-bold text-white mb-3">
        ${ticker.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
        <div>
          <div className="text-gray-600">24H Change</div>
          <div className={isUp ? 'text-green-400' : 'text-red-400'}>
            {isUp ? '+' : ''}{ticker.priceChange.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-gray-600">24H High</div>
          <div className="text-gray-300">${ticker.high.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-gray-600">24H Low</div>
          <div className="text-gray-300">${ticker.low.toLocaleString()}</div>
        </div>
      </div>
    </div>
  )
}
