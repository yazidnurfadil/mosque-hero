import { type NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const predictionId = searchParams.get("id");
    const generationId = searchParams.get("generationId");

    console.log("Check generation API called:", { predictionId, generationId });

    if (!predictionId) {
      console.error("No prediction ID provided");
      return NextResponse.json(
        { error: "No prediction ID provided" },
        { status: 400 },
      );
    }

    // Check for Replicate API token
    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) {
      console.error("Missing REPLICATE_API_TOKEN environment variable");
      return NextResponse.json(
        {
          error: "AI service not configured",
        },
        { status: 500 },
      );
    }

    // Check Replicate prediction status
    let replicateResponse;
    try {
      console.log("Checking Replicate prediction status:", predictionId);
      replicateResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: {
            Authorization: `Bearer ${replicateToken}`,
            "User-Agent": "SuperheroGenerator/1.0",
          },
        },
      );

      console.log("Replicate status check response:", replicateResponse.status);
    } catch (fetchError) {
      console.error("Error checking Replicate status:", fetchError);
      return NextResponse.json(
        {
          error: "Failed to check generation status",
        },
        { status: 500 },
      );
    }

    if (!replicateResponse.ok) {
      const errorText = await replicateResponse
        .text()
        .catch(() => "Unknown error");
      console.error(
        "Replicate status check error:",
        replicateResponse.status,
        errorText,
      );
      return NextResponse.json(
        {
          error: "Failed to check generation status",
        },
        { status: 500 },
      );
    }

    let result;
    try {
      result = await replicateResponse.json();
      console.log("Replicate prediction result:", result);
    } catch (jsonError) {
      console.error("Error parsing Replicate response:", jsonError);
      return NextResponse.json(
        {
          error: "Invalid response from AI service",
        },
        { status: 500 },
      );
    }

    // Update database record if generation is complete
    if (
      generationId &&
      (result.status === "succeeded" || result.status === "failed")
    ) {
      try {
        const updateFields: Record<string, unknown> = {
          generation_status:
            result.status === "succeeded" ? "completed" : "failed",
        };

        if (result.status === "succeeded" && result.output) {
          updateFields.superhero_image_url = result.output;
        }

        if (result.status === "failed" && result.error) {
          updateFields.error_message = result.error;
        }

        await supabaseService.updateGeneration(generationId, updateFields);
        console.log("Generation record updated:", generationId);
      } catch (updateError) {
        console.error("Error updating generation record:", updateError);
        // Don't fail the request if DB update fails
      }
    }

    console.log("Check generation API completed successfully");
    return NextResponse.json({
      id: result.id,
      generationId,
      status: result.status,
      output: result.output,
      error: result.error,
    });
  } catch (error) {
    console.error("Check generation API error:", error);
    return NextResponse.json(
      {
        error: `Failed to check generation status: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    );
  }
}
