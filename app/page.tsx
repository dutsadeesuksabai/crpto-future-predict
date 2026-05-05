'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { PriceCard } from '@/components/PriceCard'
import { PredictionCard } from '@/components/PredictionCard'
import { IndicatorPanel } from '@/components/IndicatorPanel'
import { MiniChart } from '@/components/MiniChart'
import { AccuracyStats } from '@/components/AccuracyStats'
import { PredictionHistory } from '@/components/PredictionHistory'
import { OrderBookPanel } from '@/components/OrderBookPanel'
import { FundingRatePanel } from '@/components/FundingRatePanel'
import { MultitimeframePanel } from '@/components/MultitimeframePanel'
import { FearGreedWidget } from '@/components/FearGreedWidget'
import { AnomalyAlert } from '@/components/AnomalyAlert'
import { BacktestPanel } from '@/components/BacktestPanel'
import { CalibrationPanel } from '@/components/CalibrationPanel'
import { AlertSettings, type AlertConfig } from '@/components/AlertSettings'
import type { TickerPrice, Kline } from '@/lib/mexc'
import type { PredictionResult } from '@/lib/predictor'
import type { IndicatorSet } from '@/lib/indicators'
import type { OrderBookData } from '@/lib/orderbook'
import type { FundingData } from '@/lib/funding'
import type { MTFConsensus } from '@/lib/multitimeframe'
import type { FearGreedData } from '@/lib/feargreed'
import type { AnomalyResult } from '@/lib/anomaly'
import type { Prediction } from '@/lib/supabase'

type SymbolData = {
  ticker: TickerPrice
  klines: Kline[]
  indicators: { '1m': IndicatorSet; '5m': IndicatorSet }
  predictions: { '10m': PredictionResult; '30m': PredictionResult }
  orderBook: OrderBookData | null
  fundingRate: FundingData | null
  multiTimeframe: MTFConsensus | null
  fearGreed: FearGreedData | null
  anomaly: AnomalyResult
  alerts: { '10m': boolean; '30m': boolean; threshold: number }
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
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({ telegramEnabled: false, threshold: 80, autoSave: false, autoSaveIntervalMin: 10 })
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const alertedRef = useRef<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    try {
      const results = await Promise.all(
        SYMBOLS.map(async (sym) => {
          const res = await fetch(`/api/market-data?symbol=${sym}`)
          if (!res.ok) throw new Error((await res.json()).error || `Failed ${sym}`)
          return [sym, await res.json()] as const
        })
      )
      const newData: Record<string, SymbolData> = {}
      for (const [sym, d] of results) newData[sym] = d
      setData(newData)
      setLastUpdate(new Date())
      setError(null)
      setSaved({})
      return newData
    } catch (err) {
      setError(String(err))
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPredictions = useCallback(async () => {
    if (!supabaseEnabled) return
    try {
      const res = await fetch('/api/predictions?limit=50')
      if (!res.ok) { setSupabaseEnabled(false); return }
      setPredictions((await res.json()).predictions || [])
    } catch { setSupabaseEnabled(false) }
  }, [supabaseEnabled])

  const fetchStats = useCallback(async () => {
    if (!supabaseEnabled) return
    try {
      const res = await fetch('/api/predictions/stats')
      if (res.ok) setStats((await res.json()).stats || {})
    } catch {}
  }, [supabaseEnabled])

  const verifyPredictions = useCallback(async () => {
    if (!supabaseEnabled) return
    try {
      await fetch('/api/predictions/verify', { method: 'POST' })
      fetchPredictions(); fetchStats()
    } catch {}
  }, [supabaseEnabled, fetchPredictions, fetchStats])

  const savePrediction = useCallback(async (symbol: string, timeframe: '10m' | '30m', auto = false) => {
    const key = `${symbol}-${timeframe}`
    if (!auto && (saving[key] || saved[key])) return
    if (!supabaseEnabled) return
    const d = data[symbol]
    if (!d) return

    if (!auto) setSaving((s) => ({ ...s, [key]: true }))
    const pred = d.predictions[timeframe]
    const mins = timeframe === '10m' ? 10 : 30
    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol, timeframe,
          direction: pred.direction,
          confidence: pred.confidence,
          price_at_prediction: d.ticker.price,
          target_time: new Date(Date.now() + mins * 60_000).toISOString(),
          indicators: {
            rsi: d.indicators['1m'].rsi,
            macd_histogram: d.indicators['1m'].macdHistogram,
            bb_position: d.indicators['1m'].bbPosition,
            ema_cross: d.indicators['1m'].emaCross,
            volume_score: d.indicators['1m'].volumeScore,
            momentum: d.indicators['1m'].momentum,
            ob_imbalance: d.orderBook?.imbalance,
            funding_rate: d.fundingRate?.fundingRatePct,
          },
        }),
      })
      if (res.ok && !auto) setSaved((s) => ({ ...s, [key]: true }))
      fetchPredictions()
    } catch {}
    if (!auto) setSaving((s) => ({ ...s, [key]: false }))
  }, [saving, saved, supabaseEnabled, data, fetchPredictions])

  // Telegram alert trigger
  const triggerAlerts = useCallback(async (newData: Record<string, SymbolData>) => {
    const channels = [
      alertConfig.telegramEnabled && 'telegram',
      alertConfig.emailEnabled    && 'email',
      alertConfig.discordEnabled  && 'discord',
    ].filter(Boolean) as string[]
    if (channels.length === 0) return

    for (const sym of SYMBOLS) {
      const d = newData[sym]
      if (!d) continue
      for (const tf of ['10m', '30m'] as const) {
        const pred = d.predictions[tf]
        const key = `${sym}-${tf}-${pred.direction}-${Math.floor(Date.now() / 1_800_000)}`
        if (pred.confidence >= alertConfig.threshold && !alertedRef.current.has(key)) {
          alertedRef.current.add(key)
          fetch('/api/alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              symbol: sym, timeframe: tf,
              direction: pred.direction,
              confidence: pred.confidence,
              price: d.ticker.price,
              bullScore: pred.bullScore,
              bearScore: pred.bearScore,
              channels,
            }),
          }).catch(() => {})
        }
      }
    }
  }, [alertConfig.telegramEnabled, alertConfig.threshold])

  // Auto-save interval
  useEffect(() => {
    if (autoSaveRef.current) clearInterval(autoSaveRef.current)
    if (!alertConfig.autoSave) return
    autoSaveRef.current = setInterval(() => {
      for (const sym of SYMBOLS) {
        savePrediction(sym, '10m', true)
        savePrediction(sym, '30m', true)
      }
    }, alertConfig.autoSaveIntervalMin * 60_000)
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current) }
  }, [alertConfig.autoSave, alertConfig.autoSaveIntervalMin, savePrediction])

  useEffect(() => {
    fetchData().then((d) => { if (d) triggerAlerts(d) })
    const iv = setInterval(() => {
      fetchData().then((d) => { if (d) triggerAlerts(d) })
    }, REFRESH_INTERVAL)
    return () => clearInterval(iv)
  }, [fetchData, triggerAlerts])

  useEffect(() => {
    fetchPredictions(); fetchStats()
    const iv = setInterval(() => { fetchPredictions(); fetchStats(); verifyPredictions() }, 60_000)
    return () => clearInterval(iv)
  }, [fetchPredictions, fetchStats, verifyPredictions])

  const currentData = data[activeSymbol]

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-black text-white">Crypto Predictor</h1>
            <p className="text-gray-500 text-sm">BTC &amp; ETH · 10m/30m · MEXC · {SYMBOLS.length * 2 + 6} signals</p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && <span className="text-gray-600 text-xs">Updated {lastUpdate.toLocaleTimeString()}</span>}
            <div className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-400 animate-pulse' : error ? 'bg-red-400' : 'bg-green-400'}`} />
            <button onClick={() => fetchData().then((d) => { if (d) triggerAlerts(d) })}
              className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg text-gray-300 transition-colors">
              Refresh
            </button>
          </div>
        </div>

        {/* Symbol Tabs */}
        <div className="flex gap-2 mb-5 flex-wrap items-center">
          {SYMBOLS.map((sym) => (
            <button key={sym} onClick={() => setActiveSymbol(sym)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-colors ${activeSymbol === sym ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {sym.replace('USDT', '/USDT')}
            </button>
          ))}
          {alertConfig.autoSave && <span className="text-xs bg-blue-900/40 text-blue-400 px-2 py-1 rounded-full">Auto-save every {alertConfig.autoSaveIntervalMin}m</span>}
          {alertConfig.telegramEnabled && <span className="text-xs bg-green-900/40 text-green-400 px-2 py-1 rounded-full">Telegram ≥{alertConfig.threshold}%</span>}
          {!supabaseEnabled && <div className="ml-auto text-xs text-yellow-600 bg-yellow-900/30 px-3 py-2 rounded-xl">Supabase not configured</div>}
        </div>

        {/* Alert Settings */}
        <div className="mb-5">
          <AlertSettings onConfigChange={setAlertConfig} />
        </div>

        {error && <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">Error: {error}</div>}

        {loading && !currentData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(9)].map((_, i) => <div key={i} className="bg-gray-900 rounded-2xl h-40 animate-pulse border border-gray-800" />)}
          </div>
        ) : currentData ? (
          <>
            {/* Anomaly Alert — full width if present */}
            {currentData.anomaly?.hasAnomaly && (
              <div className="mb-4"><AnomalyAlert anomaly={currentData.anomaly} /></div>
            )}

            {/* Row 1: Price + Predictions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <PriceCard ticker={currentData.ticker} />
              <PredictionCard timeframe="10m" prediction={currentData.predictions['10m']} symbol={activeSymbol}
                currentPrice={currentData.ticker.price}
                onSave={() => savePrediction(activeSymbol, '10m')}
                saving={saving[`${activeSymbol}-10m`]} saved={saved[`${activeSymbol}-10m`]} />
              <PredictionCard timeframe="30m" prediction={currentData.predictions['30m']} symbol={activeSymbol}
                currentPrice={currentData.ticker.price}
                onSave={() => savePrediction(activeSymbol, '30m')}
                saving={saving[`${activeSymbol}-30m`]} saved={saved[`${activeSymbol}-30m`]} />
            </div>

            {/* Chart */}
            <div className="mb-4">
              <MiniChart klines={currentData.klines} height={160}
                indicators={currentData.indicators['1m']}
                prediction10m={currentData.predictions['10m']}
                prediction30m={currentData.predictions['30m']} />
            </div>

            {/* Row 2: MTF Consensus + Order Book + Funding Rate */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {currentData.multiTimeframe
                ? <MultitimeframePanel mtf={currentData.multiTimeframe} />
                : <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex items-center justify-center text-gray-600 text-sm">MTF loading…</div>
              }
              {currentData.orderBook
                ? <OrderBookPanel ob={currentData.orderBook} />
                : <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex items-center justify-center text-gray-600 text-sm">Order book unavailable</div>
              }
              {currentData.fundingRate
                ? <FundingRatePanel fr={currentData.fundingRate} />
                : <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex items-center justify-center text-gray-600 text-sm">Funding rate unavailable</div>
              }
            </div>

            {/* Row 3: Indicators (1m + 5m) + Fear & Greed */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <IndicatorPanel indicators={currentData.indicators['1m']} label="1m" />
              <IndicatorPanel indicators={currentData.indicators['5m']} label="5m" />
              {currentData.fearGreed
                ? <FearGreedWidget fg={currentData.fearGreed} />
                : <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex items-center justify-center text-gray-600 text-sm">F&amp;G unavailable</div>
              }
            </div>

            {/* Row 4: Backtest + Calibration/Signal Health */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <BacktestPanel symbol={activeSymbol} />
              <CalibrationPanel symbol={activeSymbol} />
            </div>

            {/* Row 5: Accuracy Stats + Prediction History */}
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
