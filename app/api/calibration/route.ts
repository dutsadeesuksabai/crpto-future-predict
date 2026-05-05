import { NextRequest, NextResponse } from 'next/server'
import { getCalibration } from '@/lib/calibration'
import { getSignalHealth } from '@/lib/signalhealth'

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol') || undefined

  try {
    const [calibration, signalHealth] = await Promise.all([
      getCalibration(symbol),
      getSignalHealth(symbol),
    ])
    return NextResponse.json({ calibration, signalHealth })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
