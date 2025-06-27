import { type NextRequest, NextResponse } from "next/server"
import { supabaseService } from "@/lib/supabase-service"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("userId")
    const limit = Number.parseInt(searchParams.get("limit") || "20")

    const generations = await supabaseService.getGenerationHistory(userId || undefined, limit)

    return NextResponse.json({
      success: true,
      generations,
    })
  } catch (error) {
    console.error("Error fetching generation history:", error)
    return NextResponse.json({ error: "Failed to fetch generation history" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const generationId = searchParams.get("id")

    if (!generationId) {
      return NextResponse.json({ error: "No generation ID provided" }, { status: 400 })
    }

    const success = await supabaseService.deleteGeneration(generationId)

    if (!success) {
      return NextResponse.json({ error: "Failed to delete generation" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Generation deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting generation:", error)
    return NextResponse.json({ error: "Failed to delete generation" }, { status: 500 })
  }
}
