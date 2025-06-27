import { type NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-service";

export async function POST(req: NextRequest) {
  try {
    console.log("Generate superhero API called");

    const formData = await req.formData();
    const imageFile = formData.get("image") as File;
    const frameType = (formData.get("frameType") as string) || "default";
    const userId = formData.get("userId") as string | null;

    console.log("Request params:", {
      imageFileName: imageFile?.name,
      imageSize: imageFile?.size,
      frameType,
      userId,
    });

    if (!imageFile) {
      console.error("No image file provided");
      return NextResponse.json(
        { error: "No image file provided" },
        { status: 400 },
      );
    }

    // Validate image file
    if (!imageFile.type.startsWith("image/")) {
      console.error("Invalid file type:", imageFile.type);
      return NextResponse.json(
        { error: "Invalid file type. Please upload an image." },
        { status: 400 },
      );
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (imageFile.size > maxSize) {
      console.error("File too large:", imageFile.size);
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 },
      );
    }

    // Convert image to buffer
    let imageBuffer: Buffer;
    try {
      const arrayBuffer = await imageFile.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      console.log("Image converted to buffer, size:", imageBuffer.length);
    } catch (bufferError) {
      console.error("Error converting image to buffer:", bufferError);
      return NextResponse.json(
        { error: "Failed to process image file" },
        { status: 500 },
      );
    }

    // Upload original image to Supabase Storage
    let originalImageResult;
    try {
      originalImageResult = await supabaseService.uploadImage(
        imageBuffer,
        `original-${Date.now()}.${imageFile.name.split(".").pop() || "jpg"}`,
        imageFile.type,
        userId || undefined,
      );
      console.log("Original image uploaded:", originalImageResult);
    } catch (uploadError) {
      console.error("Error uploading original image:", uploadError);
      return NextResponse.json(
        {
          error: "Failed to upload original image to storage",
        },
        { status: 500 },
      );
    }

    // Convert image to base64 for Replicate API
    let base64Image: string;
    try {
      base64Image = `data:${imageFile.type};base64,${imageBuffer.toString("base64")}`;
      console.log("Image converted to base64, length:", base64Image.length);
    } catch (base64Error) {
      console.error("Error converting to base64:", base64Error);
      return NextResponse.json(
        { error: "Failed to process image for AI generation" },
        { status: 500 },
      );
    }

    // Check for Replicate API token
    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) {
      console.error("Missing REPLICATE_API_TOKEN environment variable");
      return NextResponse.json(
        {
          error: "AI service not configured. Please contact support.",
        },
        { status: 500 },
      );
    }

    // Call Replicate API with improved error handling
    let replicateResponse;
    const ikhwanPromt = `Use the provided input image as a visual reference for the child's face. Match the facial features, skin tone, and expression style as closely as possible, while adapting the head to the character’s new costume.
      make this into a colorful, comic-style illustration of a young boy character, around 6 years old, designed as a symbolic hero of cleanliness and community care. He wears a creative and modest costume with fun details that reflect his character style. His face should look cheerful and expressive, with a curious or energetic attitude.

      Only show the character from **head to torso** — do not include the legs or feet. The image should be **cropped at the waist or hips**, like a portrait or half-body character illustration. Focus on facial expression, costume design, and how he holds his cleaning tool.

      He holds one cleaning-related tool as his main “weapon of choice”, selected from the following list:  
      - broom  
      - mop  
      - vacuum cleaner  
      - feather duster  
      - spray bottle  
      - trash grabber  
      - floor buffer  
      Choose only one item and show him holding or interacting with it confidently above the waist.

      For the character’s visual concept, choose **exactly one theme** from the list below and use it to inspire his costume, personality, and pose. Do not blend styles.

      Available archetype inspirations (pick one):
      - A clever robot with jetpack
      - A brave jungle explorer with cape
      - A futuristic space pilot with jetpack
      - A cheerful farmer with cape
      - A playful forest creature with wings
      - A magical inventor with cape
      - A tiny recycling superhero with cape

      Do not use copyrighted superhero outfits, logos, capes, or comic book characters. Focus on original, imaginative design suitable for a child character.

      Use bold colors, thick comic-style outlines, and place the character against a bright blue background.
    `;

    const akhwatPromt = `Use the provided input image as a visual reference for the child's face. Match the facial features, skin tone, and expression style as closely as possible, while adapting the head to the character’s new costume.
      make this into a colorful, comic-style illustration of a young girl character, around 6 years old, designed as a symbolic hero of cleanliness and community care. She wears a modest and creative costume that includes a hijab as part of her outfit. Her face is soft and expressive, with a joyful and determined look.

      Only show the character from **head to torso** — do not include the legs or feet. Focus the composition on her facial expression, costume details, pose, and the cleaning tool she holds. The image should be **cropped at the waist or hips**, like a portrait or half-body character illustration.

      She holds one cleaning-related tool as her main “weapon of choice”, selected from the following list:  
      - broom  
      - mop  
      - vacuum cleaner  
      - feather duster  
      - spray bottle  
      - trash grabber  
      - floor buffer  
      Choose only one item and show her holding or interacting with it confidently above the waist.

      For her character style, choose **one visual theme** from the list below and use it to inspire her costume and expression. Do not combine styles.

      Available archetype inspirations (pick one):
      - A helpful robot with jetpack
      - A graceful fairy with wings
      - A colorful butterfly with wings 
      - A jungle explorer with cape
      - A space traveler with cape
      - A magical forest guardian with cape
      - A futuristic engineer with jetpack  
      - A cheerful gardener with cape

      Avoid superhero references, capes, logos, or comic book characters. Focus on originality, creativity, and visual storytelling.

      Use bold colors, thick comic-style outlines, and place the character against a bright yellow background.
    `;

    try {
      console.log("Calling Replicate API...");
      replicateResponse = await fetch(
        "https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${replicateToken}`,
            "Content-Type": "application/json",
            "User-Agent": "SuperheroGenerator/1.0",
          },
          body: JSON.stringify({
            input: {
              input_image: originalImageResult.url,
              prompt: frameType === "ikhwan" ? ikhwanPromt : akhwatPromt,
              aspect_ratio: "1:1",
              output_format: "jpg",
              safety_tolerance: 6,
            },
          }),
        },
      );

      console.log("Replicate API response status:", replicateResponse.status);
    } catch (fetchError) {
      console.error("Error calling Replicate API:", fetchError);
      return NextResponse.json(
        {
          error: "Failed to connect to AI service. Please try again.",
        },
        { status: 500 },
      );
    }

    if (!replicateResponse.ok) {
      const errorText = await replicateResponse
        .text()
        .catch(() => "Unknown error");
      console.error(
        "Replicate API error:",
        replicateResponse.status,
        errorText,
      );

      if (replicateResponse.status === 401) {
        return NextResponse.json(
          {
            error: "AI service authentication failed. Please contact support.",
          },
          { status: 500 },
        );
      } else if (replicateResponse.status === 429) {
        return NextResponse.json(
          {
            error: "AI service is busy. Please try again in a few minutes.",
          },
          { status: 429 },
        );
      } else {
        return NextResponse.json(
          {
            error: "AI service temporarily unavailable. Please try again.",
          },
          { status: 500 },
        );
      }
    }

    let replicateResult;
    try {
      replicateResult = await replicateResponse.json();
      console.log("Replicate API result:", replicateResult);
    } catch (jsonError) {
      console.error("Error parsing Replicate response:", jsonError);
      return NextResponse.json(
        {
          error: "Invalid response from AI service",
        },
        { status: 500 },
      );
    }

    // Create generation record in database
    let generationRecord;
    try {
      generationRecord = await supabaseService.createGeneration({
        originalImageUrl: originalImageResult.url,
        frameType,
        replicatePredictionId: replicateResult.id,
        userId: userId || undefined,
      });
      console.log("Generation record created:", generationRecord);
    } catch (dbError) {
      console.error("Error creating generation record:", dbError);
      // Don't fail the request if DB insert fails, Replicate is already running
      console.warn("Continuing without database record");
    }

    console.log("Generate superhero API completed successfully");
    return NextResponse.json({
      id: replicateResult.id,
      generationId: generationRecord?.id,
      status: replicateResult.status,
      message: "Generation started successfully",
    });
  } catch (error) {
    console.error("Generate superhero API error:", error);
    return NextResponse.json(
      {
        error: `Failed to generate superhero: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    );
  }
}
