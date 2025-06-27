import { type NextRequest, NextResponse } from "next/server"
import { supabaseService } from "@/lib/supabase-service"
import sharp from "sharp"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const superheroImageUrl = formData.get("superheroImage") as string
    const frameType = (formData.get("frameType") as string) || "default"
    const generationId = formData.get("generationId") as string
    const userId = formData.get("userId") as string | null

    if (!superheroImageUrl) {
      return NextResponse.json({ error: "No superhero image URL provided" }, { status: 400 })
    }

    // Fetch the generated superhero image
    const superheroResponse = await fetch(superheroImageUrl)
    if (!superheroResponse.ok) {
      throw new Error("Failed to fetch superhero image")
    }
    const superheroBuffer = Buffer.from(await superheroResponse.arrayBuffer())

    // Create frame based on frameType
    let frameBuffer: Buffer

    switch (frameType) {
      case "mosque":
        // Create mosque-themed frame
        frameBuffer = await sharp({
          create: {
            width: 800,
            height: 800,
            channels: 4,
            background: { r: 0, g: 100, b: 0, alpha: 1 }, // Islamic green
          },
        })
          .composite([
            {
              input: Buffer.from(`
              <svg width="800" height="800">
                <rect x="0" y="0" width="800" height="800" fill="none" stroke="#FFD700" stroke-width="20"/>
                <rect x="40" y="40" width="720" height="720" fill="none" stroke="#FFD700" stroke-width="4"/>
                <text x="400" y="780" text-anchor="middle" font-family="Arial" font-size="24" font-weight="bold" fill="#FFD700">SUPER HERO MASJID</text>
              </svg>
            `),
              top: 0,
              left: 0,
            },
          ])
          .png()
          .toBuffer()
        break

      case "comic":
        // Create comic book style frame
        frameBuffer = await sharp({
          create: {
            width: 800,
            height: 800,
            channels: 4,
            background: { r: 255, g: 255, b: 0, alpha: 1 }, // Yellow background
          },
        })
          .composite([
            {
              input: Buffer.from(`
              <svg width="800" height="800">
                <rect x="0" y="0" width="800" height="800" fill="none" stroke="#000" stroke-width="15"/>
                <rect x="30" y="30" width="740" height="740" fill="none" stroke="#FF0000" stroke-width="8"/>
                <text x="400" y="780" text-anchor="middle" font-family="Arial" font-size="28" font-weight="bold" fill="#FF0000" stroke="#000" stroke-width="2">SUPER HERO MASJID</text>
              </svg>
            `),
              top: 0,
              left: 0,
            },
          ])
          .png()
          .toBuffer()
        break

      case "hero":
        // Create superhero themed frame
        frameBuffer = await sharp({
          create: {
            width: 800,
            height: 800,
            channels: 4,
            background: { r: 0, g: 0, b: 139, alpha: 1 }, // Navy blue
          },
        })
          .composite([
            {
              input: Buffer.from(`
              <svg width="800" height="800">
                <rect x="0" y="0" width="800" height="800" fill="none" stroke="#FF0000" stroke-width="12"/>
                <rect x="25" y="25" width="750" height="750" fill="none" stroke="#FFD700" stroke-width="6"/>
                <text x="400" y="780" text-anchor="middle" font-family="Arial" font-size="26" font-weight="bold" fill="#FFD700" stroke="#FF0000" stroke-width="1">SUPER HERO MASJID</text>
              </svg>
            `),
              top: 0,
              left: 0,
            },
          ])
          .png()
          .toBuffer()
        break

      default: // "default" - Gold frame
        frameBuffer = await sharp({
          create: {
            width: 800,
            height: 800,
            channels: 4,
            background: { r: 255, g: 215, b: 0, alpha: 1 }, // Gold background
          },
        })
          .composite([
            {
              input: Buffer.from(`
              <svg width="800" height="800">
                <rect x="0" y="0" width="800" height="800" fill="none" stroke="#8B4513" stroke-width="10"/>
                <rect x="20" y="20" width="760" height="760" fill="none" stroke="#8B4513" stroke-width="4"/>
                <text x="400" y="780" text-anchor="middle" font-family="Arial" font-size="24" font-weight="bold" fill="#8B4513">SUPER HERO MASJID</text>
              </svg>
            `),
              top: 0,
              left: 0,
            },
          ])
          .png()
          .toBuffer()
        break
    }

    // Resize superhero image to fit within frame (leaving space for border and text)
    const resizedSuperhero = await sharp(superheroBuffer)
      .resize(650, 650, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer()

    // Get dimensions of resized superhero image
    const { width: superheroWidth, height: superheroHeight } = await sharp(resizedSuperhero).metadata()

    // Calculate position to center the superhero image (accounting for text space at bottom)
    const offsetX = Math.round((800 - (superheroWidth || 650)) / 2)
    const offsetY = Math.round((720 - (superheroHeight || 650)) / 2) + 20 // Leave space for text

    // Composite the images
    const compositeBuffer = await sharp(frameBuffer)
      .composite([
        {
          input: resizedSuperhero,
          left: offsetX,
          top: offsetY,
        },
      ])
      .png()
      .toBuffer()

    // Upload composite image to Supabase Storage
    const uploadResult = await supabaseService.uploadImage(
      compositeBuffer,
      `composite-${Date.now()}.png`,
      "image/png",
      userId || undefined,
    )

    if (!uploadResult) {
      return NextResponse.json({ error: "Failed to upload composite image" }, { status: 500 })
    }

    // Update generation record with composite image URL
    if (generationId) {
      await supabaseService.updateGeneration(generationId, {
        compositeImageUrl: uploadResult.url,
        generationStatus: "completed",
      })
    }

    return NextResponse.json({
      success: true,
      compositeImage: uploadResult.url,
      storagePath: uploadResult.path,
    })
  } catch (error) {
    console.error("Error compositing image:", error)
    return NextResponse.json({ error: "Failed to composite image" }, { status: 500 })
  }
}
