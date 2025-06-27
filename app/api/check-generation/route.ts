import { type NextRequest, NextResponse } from "next/server"
import { supabaseService } from "@/lib/supabase-service"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const predictionId = searchParams.get("id")
    const generationId = searchParams.get("generationId")

    if (!predictionId) {
      return NextResponse.json({ error: "No prediction ID provided" }, { status: 400 })
    }

    // Check Replicate prediction status
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Replicate API error: ${response.statusText}`)
    }

    const prediction = await response.json()

    // Update generation record if we have a generationId
    if (generationId && prediction.status === "succeeded" && prediction.output?.[0]) {
      await supabaseService.updateGeneration(generationId, {
        superheroImageUrl: prediction.output[0],
        generationStatus: "completed",
      })
    } else if (generationId && prediction.status === "failed") {
      await supabaseService.updateGeneration(generationId, {
        generationStatus: "failed",
      })
    }

    return NextResponse.json({
      id: prediction.id,
      generationId,
      status: prediction.status,
      output: prediction.output,
      error: prediction.error,
    })
  } catch (error) {
    console.error("Error checking generation:", error)
    return NextResponse.json({ error: "Failed to check generation status" }, { status: 500 })
  }
}
