import { NextResponse, type NextRequest } from "next/server"
import { supabaseService } from "@/lib/supabase-service"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const image = formData.get("image") as File | null
    const frameType = (formData.get("frameType") as string) || "default"
    const userId = (formData.get("userId") as string) || null

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
    }

    /* ---------- 1. UPLOAD ORIGINAL IMAGE TO SUPABASE ---------- */
    const imageBuffer = Buffer.from(await image.arrayBuffer())

    let originalUrl: string
    try {
      const upload = await supabaseService.uploadImage(imageBuffer, image.name || "photo.jpg", image.type, userId)
      originalUrl = upload.url
    } catch (e) {
      console.error("🛑 Supabase upload failed:", e)
      return NextResponse.json({ error: "Could not upload image" }, { status: 500 })
    }

    /* ---------- 2. CALL REPLICATE ---------- */
    const base64 = `data:${image.type};base64,${imageBuffer.toString("base64")}`
    const prompt =
      "Generate a comic book-style illustration of a young Muslim girl superhero... (prompt truncated for brevity)"

    const rep = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          input_image: originalUrl,
          prompt,
          output_format: "jpg"
        },
      }),
    })

    if (!rep.ok) {
      // Replicate usually returns JSON with detail / error keys
      const err = await rep.json().catch(() => ({}))
      const msg = err?.error?.message ?? err?.detail ?? rep.statusText ?? "Unknown error from Replicate"
      console.error("🛑 Replicate error:", msg)
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const prediction = await rep.json()

    /* ---------- 3. CREATE DB ROW ---------- */
    let generation
    try {
      generation = await supabaseService.createGeneration({
        originalImageUrl: originalUrl,
        frameType,
        replicatePredictionId: prediction.id,
        userId,
      })
    } catch (e) {
      console.error("🛑 DB insert failed:", e)
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    return NextResponse.json({
      id: prediction.id,
      generationId: generation.id,
      status: prediction.status,
    })
  } catch (err) {
    console.error("🛑 generate-superhero:", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unexpected error" }, { status: 500 })
  }
}
