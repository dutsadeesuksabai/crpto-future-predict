'use client'

interface StatsData {
  [symbol: string]: {
    [timeframe: string]: {
      total: number
      correct: number
      accuracy: number
    }
  }
}

interface Props {
  stats: StatsData
}

function AccuracyBar({ accuracy, total }: { accuracy: number; total: number }) {
  const color =
    accuracy >= 60 ? 'bg-green-500' : accuracy >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  const textColor =
    accuracy >= 60 ? 'text-green-400' : accuracy >= 50 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className={`font-bold ${textColor}`}>{accuracy.toFixed(1)}%</span>
        <span className="text-gray-600">{total} predictions</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${accuracy}%` }} />
      </div>
    </div>
  )
}

export function AccuracyStats({ stats }: Props) {
  const symbols = Object.keys(stats)

  if (symbols.length === 0) {
    return (
      <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
        <div className="text-gray-400 font-semibold mb-2">Prediction Accuracy</div>
        <div className="text-gray-600 text-sm text-center py-6">
          No completed predictions yet.<br />Save predictions and wait for them to resolve.
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
      <div className="text-gray-400 font-semibold mb-4">Prediction Accuracy</div>
      <div className="space-y-4">
        {symbols.map((sym) => (
          <div key={sym}>
            <div className="text-white font-bold text-sm mb-2">{sym.replace('USDT', '/USDT')}</div>
            <div className="space-y-2 pl-2">
              {Object.entries(stats[sym]).map(([tf, s]) => (
                <div key={tf}>
                  <div className="text-gray-500 text-xs mb-1">{tf} Predictions</div>
                  <AccuracyBar accuracy={s.accuracy} total={s.total} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
