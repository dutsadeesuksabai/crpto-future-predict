import { getSupabaseAdmin } from './supabase'

export type CalibrationBucket = {
  range: string           // e.g. "75-80"
  minConf: number
  maxConf: number
  total: number
  correct: number
  actualAccuracy: number  // real accuracy %
  expectedAccuracy: number // midpoint of bucket %
  calibrationError: number // expected - actual
}

export type CalibrationData = {
  buckets: CalibrationBucket[]
  isWellCalibrated: boolean
  avgCalibrationError: number
  totalSamples: number
  recommendation: string
}

const BUCKETS = [
  { range: '50-55', min: 50, max: 55, expected: 52.5 },
  { range: '55-60', min: 55, max: 60, expected: 57.5 },
  { range: '60-65', min: 60, max: 65, expected: 62.5 },
  { range: '65-70', min: 65, max: 70, expected: 67.5 },
  { range: '70-75', min: 70, max: 75, expected: 72.5 },
  { range: '75-80', min: 75, max: 80, expected: 77.5 },
  { range: '80-85', min: 80, max: 85, expected: 82.5 },
  { range: '85-90', min: 85, max: 90, expected: 87.5 },
  { range: '90+',   min: 90, max: 100, expected: 93 },
]

export async function getCalibration(symbol?: string): Promise<CalibrationData> {
  try {
    const db = getSupabaseAdmin()
    let query = db
      .from('predictions')
      .select('confidence, result')
      .neq('result', 'pending')
      .order('created_at', { ascending: false })
      .limit(500)

    if (symbol) query = query.eq('symbol', symbol)

    const { data, error } = await query
    if (error || !data || data.length < 10) {
      return buildEmptyCalibration()
    }

    const buckets: CalibrationBucket[] = BUCKETS.map((b) => {
      const rows = data.filter((r) => r.confidence >= b.min && r.confidence < b.max)
      const total = rows.length
      const correct = rows.filter((r) => r.result === 'correct').length
      const actualAccuracy = total > 0 ? (correct / total) * 100 : 0
      const calibrationError = total >= 5 ? b.expected - actualAccuracy : 0
      return {
        range: b.range,
        minConf: b.min,
        maxConf: b.max,
        total,
        correct,
        actualAccuracy,
        expectedAccuracy: b.expected,
        calibrationError,
      }
    })

    const validBuckets = buckets.filter((b) => b.total >= 5)
    const avgError = validBuckets.length > 0
      ? validBuckets.reduce((s, b) => s + Math.abs(b.calibrationError), 0) / validBuckets.length
      : 0

    const isWellCalibrated = avgError < 10

    let recommendation = ''
    if (validBuckets.length < 3) {
      recommendation = 'Not enough data — keep saving predictions to calibrate'
    } else if (isWellCalibrated) {
      recommendation = 'Model is well-calibrated — confidence scores are reliable'
    } else {
      const overconfident = validBuckets.filter((b) => b.calibrationError > 10).length
      if (overconfident > validBuckets.length / 2) {
        recommendation = 'Model tends to be overconfident — treat high % with caution'
      } else {
        recommendation = 'Model tends to be underconfident — signals may be stronger than shown'
      }
    }

    return {
      buckets,
      isWellCalibrated,
      avgCalibrationError: avgError,
      totalSamples: data.length,
      recommendation,
    }
  } catch {
    return buildEmptyCalibration()
  }
}

// Apply calibration adjustment to raw confidence
export function calibratedConfidence(rawConf: number, calibration: CalibrationData): number {
  const bucket = calibration.buckets.find((b) => rawConf >= b.minConf && rawConf < b.maxConf)
  if (!bucket || bucket.total < 5) return rawConf
  // Shift confidence toward actual accuracy
  const adj = rawConf - bucket.calibrationError * 0.5
  return Math.max(50, Math.min(95, adj))
}

function buildEmptyCalibration(): CalibrationData {
  return {
    buckets: BUCKETS.map((b) => ({
      range: b.range, minConf: b.min, maxConf: b.max,
      total: 0, correct: 0, actualAccuracy: 0,
      expectedAccuracy: b.expected, calibrationError: 0,
    })),
    isWellCalibrated: false,
    avgCalibrationError: 0,
    totalSamples: 0,
    recommendation: 'Not enough data yet — save predictions to start calibration',
  }
}
