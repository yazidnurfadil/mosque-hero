import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const predictionId = searchParams.get("id")

    if (!predictionId) {
      return NextResponse.json({ error: "No prediction ID provided" }, { status: 400 })
    }

    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Replicate API error: ${response.statusText}`)
    }

    const prediction = await response.json()

    return NextResponse.json({
      id: prediction.id,
      status: prediction.status,
      output: prediction.output,
      error: prediction.error,
    })
  } catch (error) {
    console.error("Error checking generation status:", error)
    return NextResponse.json({ error: "Failed to check generation status" }, { status: 500 })
  }
}
