import { type NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-service";
import sharp from "sharp";

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
          // Create mosque-themed frame with proper SVG encoding
          frameBuffer = await createMosqueFrame();
          break;

        case "comic":
          // Create comic book style frame
          frameBuffer = await createComicFrame();
          break;

        case "akwat":
          // Create superhero themed frame
          frameBuffer = await createHeroFrame();
          break;

        default: // "default" - Gold frame
          frameBuffer = await createDefaultFrame();
          break;
      }
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
        .resize(650, 650, {
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
      compositeBuffer = await sharp(frameBuffer)
        .composite([
          {
            input: resizedSuperhero,
            left: offsetX,
            top: offsetY,
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
async function createMosqueFrame(): Promise<Buffer> {
  const svgContent = `
    <svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="islamicPattern" patternUnits="userSpaceOnUse" width="40" height="40">
          <rect width="40" height="40" fill="#006400"/>
          <circle cx="20" cy="20" r="8" fill="none" stroke="#FFD700" stroke-width="2"/>
        </pattern>
      </defs>
      <rect x="0" y="0" width="800" height="800" fill="#006400"/>
      <rect x="0" y="0" width="800" height="800" fill="none" stroke="#FFD700" stroke-width="20"/>
      <rect x="40" y="40" width="720" height="720" fill="none" stroke="#FFD700" stroke-width="4"/>
      <text x="400" y="780" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#FFD700">SUPER HERO MASJID</text>
    </svg>
  `;

  return await sharp(Buffer.from(svgContent)).png().toBuffer();
}

async function createComicFrame(): Promise<Buffer> {
  const svgContent = `
    <svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="800" height="800" fill="#FFFF00"/>
      <rect x="0" y="0" width="800" height="800" fill="none" stroke="#000000" stroke-width="15"/>
      <rect x="30" y="30" width="740" height="740" fill="none" stroke="#FF0000" stroke-width="8"/>
      <text x="400" y="780" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#FF0000" stroke="#000000" stroke-width="2">SUPER HERO MASJID</text>
    </svg>
  `;

  return await sharp(Buffer.from(svgContent)).png().toBuffer();
}

async function createHeroFrame(): Promise<Buffer> {
  const svgContent = `
    <svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="heroGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:#000080;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#000040;stop-opacity:1" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="800" height="800" fill="url(#heroGradient)"/>
      <rect x="0" y="0" width="800" height="800" fill="none" stroke="#FF0000" stroke-width="12"/>
      <rect x="25" y="25" width="750" height="750" fill="none" stroke="#FFD700" stroke-width="6"/>
      <text x="400" y="780" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="#FFD700" stroke="#FF0000" stroke-width="1">SUPER HERO MASJID</text>
    </svg>
  `;

  return await sharp(Buffer.from(svgContent)).png().toBuffer();
}

async function createDefaultFrame(): Promise<Buffer> {
  const svgContent = `
    <svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="goldGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:#FFD700;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#B8860B;stop-opacity:1" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="800" height="800" fill="url(#goldGradient)"/>
      <rect x="0" y="0" width="800" height="800" fill="none" stroke="#8B4513" stroke-width="10"/>
      <rect x="20" y="20" width="760" height="760" fill="none" stroke="#8B4513" stroke-width="4"/>
      <text x="400" y="780" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#8B4513">SUPER HERO MASJID</text>
    </svg>
  `;

  return await sharp(Buffer.from(svgContent)).png().toBuffer();
}
