import { type NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import { supabaseService } from "@/lib/supabase-service"
import path from "path"
import fs from "fs"

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

    // Get the frame image path
    const frameImagePath = path.join(process.cwd(), "public", "frames", `${frameType}.png`)

    // Check if frame file exists
    if (!fs.existsSync(frameImagePath)) {
      console.error("❌ Frame file not found:", frameImagePath)
      return NextResponse.json({ error: `Frame file not found: ${frameType}.png` }, { status: 404 })
    }

    console.log("📁 Frame file found:", frameImagePath)

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

    // Load the frame image
    let frameBuffer: Buffer
    try {
      frameBuffer = fs.readFileSync(frameImagePath)
      console.log("✅ Frame image loaded, size:", frameBuffer.length, "bytes")
    } catch (error) {
      console.error("❌ Error loading frame image:", error)
      return NextResponse.json({ error: "Failed to load frame image" }, { status: 500 })
    }

    // Get frame dimensions
    const frameMetadata = await sharp(frameBuffer).metadata()
    const frameWidth = frameMetadata.width || 1080
    const frameHeight = frameMetadata.height || 1080

    console.log("📏 Frame dimensions:", { frameWidth, frameHeight })

    // Process the superhero image and composite with frame
    try {
      console.log("🔄 Starting image composition...")

      // Calculate the area where the superhero image should be placed
      // Based on the frame design, we need to place the image in the center white area
      const portraitSize = Math.min(frameWidth, frameHeight) * 0.6 // 60% of frame size
      const portraitX = Math.round((frameWidth - portraitSize) / 2)
      const portraitY = Math.round((frameHeight - portraitSize) / 2)

      console.log("📐 Portrait placement:", { portraitSize, portraitX, portraitY })

      // Resize and process superhero image
      const processedSuperhero = await sharp(superheroBuffer)
        .resize(Math.round(portraitSize), Math.round(portraitSize), {
          fit: "cover",
          position: "center",
        })
        .png()
        .toBuffer()

      console.log("✅ Superhero image processed")

      // Composite the images
      const compositeBuffer = await sharp(frameBuffer)
        .composite([
          {
            input: processedSuperhero,
            left: portraitX,
            top: portraitY,
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

        const uploadResult = await supabaseService.uploadImage(storagePath, compositeBuffer, "image/png")

        if (!uploadResult.success || !uploadResult.publicUrl) {
          throw new Error(uploadResult.error || "Failed to get public URL")
        }

        publicUrl = uploadResult.publicUrl
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
