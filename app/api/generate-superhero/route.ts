import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const image = formData.get("image") as File

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
    }

    // Convert image to base64
    const bytes = await image.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Image = `data:${image.type};base64,${buffer.toString("base64")}`

    const prompt =
      "Generate a comic book-style illustration of a young Muslim girl superhero. She wears a navy blue superhero suit with a red cape and red gloves. She has a hijab that matches her suit. She holds a broom in one hand and a mop in the other, posing like a confident superhero on a bright yellow background. Her facial expression is determined but friendly. Use bold colors, thick black outlines, and comic-style shading. At the bottom of the image, include the stylized text 'SUPER HERO MASJID' in bold red capital letters with a black shadow."

    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "6ac11fedb8b8b3b3b7b0b3b3b7b0b3b3b7b0b3b3", // FLUX Kontext model version
        input: {
          image: base64Image,
          prompt: prompt,
          num_inference_steps: 28,
          guidance_scale: 3.5,
          strength: 0.8,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Replicate API error: ${response.statusText}`)
    }

    const prediction = await response.json()

    return NextResponse.json({
      id: prediction.id,
      status: prediction.status,
      output: prediction.output,
    })
  } catch (error) {
    console.error("Error generating superhero:", error)
    return NextResponse.json({ error: "Failed to generate superhero portrait" }, { status: 500 })
  }
}
