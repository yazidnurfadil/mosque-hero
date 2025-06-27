import { type NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import { supabaseService } from "@/lib/supabase-service"

// Use Node.js runtime for Sharp image processing

export async function POST(request: NextRequest) {
  console.log("🖼️ Composite image API called")

  try {
    const formData = await request.formData()
    const superheroImage = formData.get("superheroImage") as string
    const frameType = formData.get("frameType") as string
    const generationId = formData.get("generationId") as string
    const userId = formData.get("userId") as string

    console.log("📝 Composite request data:", {
      superheroImageLength: superheroImage?.length,
      frameType,
      generationId,
      userId,
    })

    if (!superheroImage || !frameType) {
      console.error("❌ Missing required fields")
      return NextResponse.json({ error: "Missing superhero image or frame type" }, { status: 400 })
    }

    // Validate frame type
    const validFrames = ["ikhwan", "akhwat"]
    if (!validFrames.includes(frameType)) {
      console.error("❌ Invalid frame type:", frameType)
      return NextResponse.json({ error: "Invalid frame type. Must be ikhwan or akhwat" }, { status: 400 })
    }

    console.log("🖼️ Processing composite with frame:", frameType)

    // Get the frame image URL (served from public/frames)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (request.headers.get("origin") ?? "")
    const frameImageUrl = `${baseUrl}/frames/${frameType}.png`

    // Fetch the frame image
    let frameBuffer: Buffer
    try {
      console.log("🌐 Fetching frame image from:", frameImageUrl)
      const frameResponse = await fetch(frameImageUrl)
      if (!frameResponse.ok) {
        throw new Error(`Failed to fetch frame image: ${frameResponse.status} ${frameResponse.statusText}`)
      }
      frameBuffer = Buffer.from(await frameResponse.arrayBuffer())
      console.log("✅ Frame image fetched, size:", frameBuffer.length, "bytes")
    } catch (error) {
      console.error("❌ Error fetching frame image:", error)
      return NextResponse.json({ error: `Frame file not found: ${frameType}.png` }, { status: 404 })
    }

    // Fetch the superhero image
    let superheroBuffer: Buffer
    try {
      console.log("🌐 Fetching superhero image from:", superheroImage.substring(0, 100) + "...")

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      const superheroResponse = await fetch(superheroImage, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SuperheroGenerator/1.0)",
        },
      })

      clearTimeout(timeoutId)

      if (!superheroResponse.ok) {
        throw new Error(`Failed to fetch superhero image: ${superheroResponse.status} ${superheroResponse.statusText}`)
      }

      superheroBuffer = Buffer.from(await superheroResponse.arrayBuffer())
      console.log("✅ Superhero image fetched, size:", superheroBuffer.length, "bytes")
    } catch (error) {
      console.error("❌ Error fetching superhero image:", error)
      return NextResponse.json({ error: "Failed to fetch superhero image" }, { status: 500 })
    }

    // Get frame dimensions
    const frameMetadata = await sharp(frameBuffer).metadata()
    const frameWidth = frameMetadata.width || 1080
    const frameHeight = frameMetadata.height || 1080

    console.log("📏 Frame dimensions:", { frameWidth, frameHeight })

    // Process the superhero image and composite with frame
    try {
      console.log("🔄 Starting image composition...")

      // Calculate the area for the portrait and frame
      // Portrait will be 90% of the composite size, frame will be 100%
      const compositeSize = Math.min(frameWidth, frameHeight)
      const portraitSize = Math.round(compositeSize * 0.85) // 80% of composite
      const frameSize = compositeSize // 100% of composite
      const portraitX = Math.round((compositeSize - portraitSize) / 2)
      const portraitY = Math.round((compositeSize - portraitSize) / 2)

      console.log("📐 Portrait placement:", {
        portraitSize,
        portraitX,
        portraitY,
        frameSize,
      })

      // Resize and process superhero image (portrait)
      const processedSuperhero = await sharp(superheroBuffer)
        .resize(portraitSize, portraitSize, {
          fit: "cover",
          position: "center",
        })
        .png()
        .toBuffer()

      console.log("✅ Superhero image processed")

      // Resize the frame to be slightly bigger (100% of composite)
      const resizedFrame = await sharp(frameBuffer)
        .resize(frameSize, frameSize, {
          fit: "contain",
          position: "center",
        })
        .png()
        .toBuffer()

      // Create a blank canvas for the composite
      const compositeBuffer = await sharp({
        create: {
          width: compositeSize,
          height: compositeSize,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([
          // Place the portrait first (behind)
          {
            input: processedSuperhero,
            left: portraitX,
            top: portraitY,
            blend: "over",
          },
          // Place the frame on top
          {
            input: resizedFrame,
            left: 0,
            top: 0,
            blend: "over",
          },
        ])
        .png()
        .toBuffer()

      console.log("✅ Images composited successfully, final size:", compositeBuffer.length, "bytes")

      // Upload to Supabase Storage
      let storagePath: string
      let publicUrl: string

      try {
        console.log("☁️ Uploading to Supabase Storage...")

        const timestamp = Date.now()
        const filename = `composite-${frameType}-${timestamp}.png`
        storagePath = `composites/${filename}`

        const uploadResult = await supabaseService.uploadImage(compositeBuffer, storagePath, "image/png")

        if (!uploadResult.url) {
          throw new Error("Failed to get public URL")
        }

        publicUrl = uploadResult.url
        console.log("✅ Image uploaded to storage:", publicUrl)
      } catch (error) {
        console.error("❌ Storage upload failed:", error)
        return NextResponse.json({ error: "Failed to save composite image" }, { status: 500 })
      }

      // Update database record if generationId is provided
      if (generationId) {
        try {
          console.log("💾 Updating database record...")

          await supabaseService.updateGeneration(generationId, {
            composite_image_url: publicUrl,
            composite_storage_path: storagePath,
            frame_type: frameType,
            status: "completed",
          })

          console.log("✅ Database updated successfully")
        } catch (error) {
          console.error("⚠️ Database update failed (non-critical):", error)
          // Don't fail the request if database update fails
        }
      }

      console.log("🎉 Composite operation completed successfully")

      return NextResponse.json({
        success: true,
        compositeImage: publicUrl,
        storagePath: storagePath,
        frameType: frameType,
      })
    } catch (error) {
      console.error("❌ Image processing error:", error)
      return NextResponse.json({ error: "Failed to process images" }, { status: 500 })
    }
  } catch (error) {
    console.error("❌ Composite API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
