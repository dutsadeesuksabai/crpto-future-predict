'use client'

interface Props {
  open: boolean
  onClose: () => void
}

const SHORTCUTS = [
  { key: 'R',   desc: 'Refresh data' },
  { key: 'B',   desc: 'Switch to BTC/USDT' },
  { key: 'E',   desc: 'Switch to ETH/USDT' },
  { key: 'S',   desc: 'Save both predictions' },
  { key: 'F',   desc: 'Force alert check (clears dedup)' },
  { key: 'A',   desc: 'Toggle Alert Settings panel' },
  { key: 'G',   desc: 'Toggle Strategy Selector' },
  { key: 'T',   desc: 'Toggle Trade Setup panel' },
  { key: 'P',   desc: 'Toggle Pivot Points panel' },
  { key: '?',   desc: 'Show / hide this help' },
  { key: 'Esc', desc: 'Close this overlay' },
]

export function KeyboardHelpOverlay({ open, onClose }: Props) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-white font-bold text-base">⌨️ Keyboard Shortcuts</div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
        </div>
        <div className="space-y-2">
          {SHORTCUTS.map(({ key, desc }) => (
            <div key={key} className="flex items-center gap-3">
              <kbd className="bg-gray-800 border border-gray-600 text-gray-200 text-xs font-mono px-2 py-1 rounded-md min-w-[32px] text-center shadow">
                {key}
              </kbd>
              <span className="text-gray-400 text-sm">{desc}</span>
            </div>
          ))}
        </div>
        <p className="text-gray-600 text-xs mt-4 text-center">
          Shortcuts disabled while typing in inputs
        </p>
      </div>
    </div>
  )
}
