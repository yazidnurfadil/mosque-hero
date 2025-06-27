import { type NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-service";
import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    console.log("Composite image API called");

    const formData = await req.formData();
    const superheroImageUrl = formData.get("superheroImage") as string;
    const frameType = (formData.get("frameType") as string) || "default";
    const generationId = formData.get("generationId") as string;
    const userId = formData.get("userId") as string | null;

    console.log("Request params:", {
      superheroImageUrl,
      frameType,
      generationId,
      userId,
    });

    if (!superheroImageUrl) {
      console.error("No superhero image URL provided");
      return NextResponse.json(
        { error: "No superhero image URL provided" },
        { status: 400 },
      );
    }

    // Fetch the generated superhero image with proper error handling
    console.log("Fetching superhero image from:", superheroImageUrl);
    let superheroResponse;
    try {
      superheroResponse = await fetch(superheroImageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SuperheroGenerator/1.0)",
        },
        // Add timeout for production
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });
    } catch (fetchError) {
      console.error("Failed to fetch superhero image:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch superhero image from external source" },
        { status: 500 },
      );
    }

    if (!superheroResponse.ok) {
      console.error(
        "Superhero image fetch failed:",
        superheroResponse.status,
        superheroResponse.statusText,
      );
      return NextResponse.json(
        {
          error: `Failed to fetch superhero image: ${superheroResponse.status}`,
        },
        { status: 500 },
      );
    }

    const superheroBuffer = Buffer.from(await superheroResponse.arrayBuffer());
    console.log("Superhero image buffer size:", superheroBuffer.length);

    // Create frame based on frameType with improved SVG handling
    let frameBuffer: Buffer;

    try {
      switch (frameType) {
        case "ikhwan":
          frameBuffer = await createIkhwanFrame();
          break;

        case "akhwat":
          frameBuffer = await createAkhwatFrame();
          break;

        default: // "default" - Gold frame
          frameBuffer = await createIkhwanFrame();
          break;
      }
      // Ensure frameBuffer is 800x800
      frameBuffer = await sharp(frameBuffer).resize(800, 800).png().toBuffer();
      console.log("Frame buffer created, size:", frameBuffer.length);
    } catch (frameError) {
      console.error("Error creating frame:", frameError);
      return NextResponse.json(
        { error: "Failed to create frame" },
        { status: 500 },
      );
    }

    // Process superhero image with error handling
    let resizedSuperhero: Buffer;
    try {
      resizedSuperhero = await sharp(superheroBuffer)
        .resize(680, 680, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .png()
        .toBuffer();
      console.log("Superhero image resized, size:", resizedSuperhero.length);
    } catch (resizeError) {
      console.error("Error resizing superhero image:", resizeError);
      return NextResponse.json(
        { error: "Failed to process superhero image" },
        { status: 500 },
      );
    }

    // Get dimensions of resized superhero image
    const { width: superheroWidth, height: superheroHeight } =
      await sharp(resizedSuperhero).metadata();

    // Calculate position to center the superhero image (accounting for text space at bottom)
    const offsetX = Math.round((800 - (superheroWidth || 650)) / 2);
    const offsetY = Math.round((720 - (superheroHeight || 650)) / 2) + 20; // Leave space for text

    console.log("Composite positioning:", {
      offsetX,
      offsetY,
      superheroWidth,
      superheroHeight,
    });

    // Composite the images with error handling
    let compositeBuffer: Buffer;
    try {
      // Step 1: Create a colored background based on frame type
      let backgroundColor = { r: 110, g: 155, b: 240, alpha: 1 }; // ikhwan default
      if (frameType === "akhwat") {
        backgroundColor = { r: 233, g: 206, b: 80, alpha: 1 }; // #E9CE50
      }
      const backgroundCanvas = await sharp({
        create: {
          width: 800,
          height: 800,
          channels: 4,
          background: backgroundColor,
        },
      })
        .png()
        .toBuffer();

      // Step 2: Place the character image on the colored background
      const characterOnBackground = await sharp(backgroundCanvas)
        .composite([
          {
            input: resizedSuperhero,
            left: offsetX,
            top: offsetY,
          },
        ])
        .png()
        .toBuffer();

      // Step 3: Overlay the frame on top
      compositeBuffer = await sharp(characterOnBackground)
        .composite([
          {
            input: frameBuffer,
            left: 0,
            top: 0,
          },
        ])
        .png()
        .toBuffer();
      console.log("Composite image created, size:", compositeBuffer.length);
    } catch (compositeError) {
      console.error("Error compositing images:", compositeError);
      return NextResponse.json(
        { error: "Failed to composite images" },
        { status: 500 },
      );
    }

    // Upload composite image to Supabase Storage with error handling
    let uploadResult;
    try {
      uploadResult = await supabaseService.uploadImage(
        compositeBuffer,
        `composite-${Date.now()}.png`,
        "image/png",
        userId || undefined,
      );
      console.log("Image uploaded to Supabase:", uploadResult);
    } catch (uploadError) {
      console.error("Error uploading to Supabase:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload composite image to storage" },
        { status: 500 },
      );
    }

    if (!uploadResult) {
      console.error("Upload result is null");
      return NextResponse.json(
        { error: "Failed to upload composite image" },
        { status: 500 },
      );
    }

    // Update generation record with composite image URL
    if (generationId) {
      try {
        await supabaseService.updateGeneration(generationId, {
          composite_image_url: uploadResult.url,
          generation_status: "completed",
        });
        console.log("Generation record updated:", generationId);
      } catch (updateError) {
        console.error("Error updating generation record:", updateError);
        // Don't fail the request if DB update fails, image is already uploaded
      }
    }

    console.log("Composite image API completed successfully");
    return NextResponse.json({
      success: true,
      compositeImage: uploadResult.url,
      storagePath: uploadResult.path,
    });
  } catch (error) {
    console.error("Composite image API error:", error);
    return NextResponse.json(
      {
        error: `Failed to composite image: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    );
  }
}

// Helper functions for creating frames with proper error handling
async function createIkhwanFrame(): Promise<Buffer> {
  // Read ikhwan.svg from public/frames
  const svgPath = path.join(process.cwd(), "public", "frames", "ikhwan.svg");
  const svgContent = await fs.readFile(svgPath, "utf-8");
  return await sharp(Buffer.from(svgContent)).png().toBuffer();
}

async function createAkhwatFrame(): Promise<Buffer> {
  // Read akhwat.svg from public/frames
  const svgPath = path.join(process.cwd(), "public", "frames", "akhwat.svg");
  const svgContent = await fs.readFile(svgPath, "utf-8");
  return await sharp(Buffer.from(svgContent)).png().toBuffer();
}
