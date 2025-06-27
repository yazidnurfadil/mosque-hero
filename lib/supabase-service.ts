import { v4 as uuidv4 } from "uuid"
import { getSupabaseServer } from "./supabase"

const BUCKET = "superhero-images"

export class SupabaseService {
  private supabase = getSupabaseServer()

  /* ----------  STORAGE ---------- */
  async uploadImage(buffer: Buffer, filename: string, contentType = "image/png", userId?: string | null) {
    const ext = filename.split(".").pop() ?? "png"
    const key = `${userId ?? "anonymous"}/${Date.now()}-${uuidv4()}.${ext}`

    // ⚠️ upsert: false so we never overwrite an existing image.
    const { data, error } = await this.supabase.storage.from(BUCKET).upload(key, buffer, { contentType, upsert: false })

    if (error) throw error

    const { data: publicURL } = this.supabase.storage.from(BUCKET).getPublicUrl(key)

    return { path: data.path, url: publicURL.publicUrl }
  }

  /* ----------  DATABASE ---------- */
  async createGeneration(payload: {
    originalImageUrl: string
    frameType: string
    replicatePredictionId: string
    userId?: string | null
  }) {
    const { data, error } = await this.supabase
      .from("superhero_generations")
      .insert({
        user_id: payload.userId,
        original_image_url: payload.originalImageUrl,
        frame_type: payload.frameType,
        generation_status: "processing",
        replicate_prediction_id: payload.replicatePredictionId,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updateGeneration(id: string, fields: Record<string, unknown>) {
    const { data, error } = await this.supabase
      .from("superhero_generations")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export const supabaseService = new SupabaseService()
