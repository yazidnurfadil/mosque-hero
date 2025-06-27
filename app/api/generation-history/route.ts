import { type NextRequest, NextResponse } from "next/server"
import { supabaseService } from "@/lib/supabase-service"

export async function GET(req: NextRequest) {
  try {
    console.log("Generation history API called")

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("userId")
    const limit = Number.parseInt(searchParams.get("limit") || "20")

    console.log("Request params:", { userId, limit })

    const history = await supabaseService.getGenerationHistory(userId, limit)

    console.log("Generation history fetched:", history.length, "records")
    return NextResponse.json({ history })
  } catch (error) {
    console.error("Generation history API error:", error)
    return NextResponse.json(
      {
        error: `Failed to fetch generation history: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    console.log("Delete generation API called")

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
      console.error("No generation ID provided")
      return NextResponse.json({ error: "No generation ID provided" }, { status: 400 })
    }

    console.log("Deleting generation:", id)
    const success = await supabaseService.deleteGeneration(id)

    if (!success) {
      console.error("Generation not found:", id)
      return NextResponse.json({ error: "Generation not found" }, { status: 404 })
    }

    console.log("Generation deleted successfully:", id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete generation API error:", error)
    return NextResponse.json(
      {
        error: `Failed to delete generation: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    )
  }
}
