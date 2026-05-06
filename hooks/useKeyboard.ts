'use client'

import { useEffect, useRef } from 'react'

type ShortcutMap = Record<string, () => void>

/**
 * Global keyboard shortcut handler.
 * Ignores keystrokes when focus is on an input/textarea/select.
 */
export function useKeyboard(shortcuts: ShortcutMap) {
  // Store shortcuts in a ref so the effect doesn't re-register on every render
  const ref = useRef(shortcuts)
  ref.current = shortcuts

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key.toLowerCase()
      if (ref.current[key]) {
        e.preventDefault()
        ref.current[key]()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
