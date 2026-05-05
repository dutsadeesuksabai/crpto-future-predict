'use client'

import { useState, useEffect, useCallback } from 'react'
import { PriceCard } from '@/components/PriceCard'
import { PredictionCard } from '@/components/PredictionCard'
import { IndicatorPanel } from '@/components/IndicatorPanel'
import { MiniChart } from '@/components/MiniChart'
import { AccuracyStats } from '@/components/AccuracyStats'
import { PredictionHistory } from '@/components/PredictionHistory'
import type { TickerPrice } from '@/lib/mexc'
import type { PredictionResult } from '@/lib/predictor'
import type { IndicatorSet } from '@/lib/indicators'
import type { Kline } from '@/lib/mexc'
import type { Prediction } from '@/lib/supabase'

type SymbolData = {
  ticker: TickerPrice
  klines: Kline[]
  indicators: { '1m': IndicatorSet; '5m': IndicatorSet }
  predictions: { '10m': PredictionResult; '30m': PredictionResult }
  timestamp: number
}

const SYMBOLS = ['BTCUSDT', 'ETHUSDT'] as const
const REFRESH_INTERVAL = 30_000

export default function Home() {
  const [activeSymbol, setActiveSymbol] = useState<'BTCUSDT' | 'ETHUSDT'>('BTCUSDT')
  const [data, setData] = useState<Record<string, SymbolData>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [stats, setStats] = useState<Record<string, Record<string, { total: number; correct: number; accuracy: number }>>>({})
  const [supabaseEnabled, setSupabaseEnabled] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const results = await Promise.all(
        SYMBOLS.map(async (sym) => {
          const res = await fetch(`/api/market-data?symbol=${sym}`)
          if (!res.ok) {
            const err = await res.json()
            throw new Error(err.error || `Failed to fetch ${sym}`)
          }
          return [sym, await res.json()] as const
        })
      )
      const newData: Record<string, SymbolData> = {}
      for (const [sym, d] of results) newData[sym] = d
      setData(newData)
      setLastUpdate(new Date())
      setError(null)
      setSaved({})
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPredictions = useCallback(async () => {
    if (!supabaseEnabled) return
    try {
      const res = await fetch('/api/predictions?limit=50')
      if (!res.ok) { setSupabaseEnabled(false); return }
      const d = await res.json()
      setPredictions(d.predictions || [])
    } catch { setSupabaseEnabled(false) }
  }, [supabaseEnabled])

  const fetchStats = useCallback(async () => {
    if (!supabaseEnabled) return
    try {
      const res = await fetch('/api/predictions/stats')
      if (!res.ok) return
      const d = await res.json()
      setStats(d.stats || {})
    } catch {}
  }, [supabaseEnabled])

  const verifyPredictions = useCallback(async () => {
    if (!supabaseEnabled) return
    try {
      await fetch('/api/predictions/verify', { method: 'POST' })
      await fetchPredictions()
      await fetchStats()
    } catch {}
  }, [supabaseEnabled, fetchPredictions, fetchStats])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchData])

  useEffect(() => {
    fetchPredictions()
    fetchStats()
    const interval = setInterval(() => {
      fetchPredictions()
      fetchStats()
      verifyPredictions()
    }, 60_000)
    return () => clearInterval(interval)
  }, [fetchPredictions, fetchStats, verifyPredictions])

  const savePrediction = async (symbol: string, timeframe: '10m' | '30m') => {
    const key = `${symbol}-${timeframe}`
    if (saving[key] || saved[key] || !supabaseEnabled) return
    const d = data[symbol]
    if (!d) return

    setSaving((s) => ({ ...s, [key]: true }))
    const pred = d.predictions[timeframe]
    const targetMinutes = timeframe === '10m' ? 10 : 30
    const targetTime = new Date(Date.now() + targetMinutes * 60 * 1000).toISOString()

    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          timeframe,
          direction: pred.direction,
          confidence: pred.confidence,
          price_at_prediction: d.ticker.price,
          target_time: targetTime,
          indicators: {
            rsi: d.indicators['1m'].rsi,
            macd_histogram: d.indicators['1m'].macdHistogram,
            bb_position: d.indicators['1m'].bbPosition,
            ema_cross: d.indicators['1m'].emaCross,
            volume_score: d.indicators['1m'].volumeScore,
            momentum: d.indicators['1m'].momentum,
          },
        }),
      })
      if (res.ok) {
        setSaved((s) => ({ ...s, [key]: true }))
        fetchPredictions()
      }
    } catch {}

    setSaving((s) => ({ ...s, [key]: false }))
  }

  const currentData = data[activeSymbol]

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-white">Crypto Predictor</h1>
            <p className="text-gray-500 text-sm">BTC &amp; ETH — 10m / 30m Price Direction · Powered by MEXC</p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-gray-600 text-xs">Updated {lastUpdate.toLocaleTimeString()}</span>
            )}
            <div className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-400 animate-pulse' : error ? 'bg-red-400' : 'bg-green-400'}`} />
            <button
              onClick={fetchData}
              className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg text-gray-300 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Symbol Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {SYMBOLS.map((sym) => (
            <button
              key={sym}
              onClick={() => setActiveSymbol(sym)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-colors ${
                activeSymbol === sym ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {sym.replace('USDT', '/USDT')}
            </button>
          ))}
          {!supabaseEnabled && (
            <div className="ml-auto text-xs text-yellow-600 bg-yellow-900/30 px-3 py-2 rounded-xl">
              Supabase not configured — predictions won&apos;t be saved
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">
            Error: {error}
          </div>
        )}

        {loading && !currentData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-gray-900 rounded-2xl h-48 animate-pulse border border-gray-800" />
            ))}
          </div>
        ) : currentData ? (
          <>
            {/* Price + Predictions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <PriceCard ticker={currentData.ticker} />
              <PredictionCard
                timeframe="10m"
                prediction={currentData.predictions['10m']}
                symbol={activeSymbol}
                currentPrice={currentData.ticker.price}
                onSave={() => savePrediction(activeSymbol, '10m')}
                saving={saving[`${activeSymbol}-10m`]}
                saved={saved[`${activeSymbol}-10m`]}
              />
              <PredictionCard
                timeframe="30m"
                prediction={currentData.predictions['30m']}
                symbol={activeSymbol}
                currentPrice={currentData.ticker.price}
                onSave={() => savePrediction(activeSymbol, '30m')}
                saving={saving[`${activeSymbol}-30m`]}
                saved={saved[`${activeSymbol}-30m`]}
              />
            </div>

            {/* Chart */}
            <div className="mb-4">
              <MiniChart klines={currentData.klines} height={130} />
            </div>

            {/* Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <IndicatorPanel indicators={currentData.indicators['1m']} label="1m" />
              <IndicatorPanel indicators={currentData.indicators['5m']} label="5m" />
            </div>

            {/* Stats + History */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AccuracyStats stats={stats} />
              <PredictionHistory predictions={predictions.filter((p) => p.symbol === activeSymbol)} />
            </div>
          </>
        ) : null}
      </div>
    </main>
  )
}
