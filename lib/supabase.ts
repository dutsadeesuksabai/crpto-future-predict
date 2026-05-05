import { createClient } from '@supabase/supabase-js'

function isConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return url && key && !url.includes('your_supabase_url_here')
}

export function getSupabaseAdmin() {
  if (!isConfigured()) throw new Error('Supabase not configured')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

export function getSupabase() {
  if (!isConfigured()) throw new Error('Supabase not configured')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

export type Prediction = {
  id?: string
  symbol: string
  timeframe: string
  direction: 'up' | 'down'
  confidence: number
  price_at_prediction: number
  target_time: string
  actual_price?: number
  result?: 'correct' | 'incorrect' | 'pending'
  indicators: Record<string, number | string>
  created_at?: string
}
