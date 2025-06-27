import { v4 as uuidv4 } from "uuid"
import { getSupabaseServer } from "./supabase"

export interface SuperheroGeneration {
  id: string
  user_id: string | null
  original_image_url: string | null
  superhero_image_url: string | null
  composite_image_url: string | null
  frame_type: string | null
  generation_status: "processing" | "completed" | "failed"
  replicate_prediction_id: string | null
  created_at: string
  updated_at: string
}

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

  /* ----------  HISTORY ---------- */
  async getGenerationHistory(userId?: string | null, limit = 20): Promise<SuperheroGeneration[]> {
    let q = this.supabase
      .from("superhero_generations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (userId) q = q.eq("user_id", userId)
    else q = q.is("user_id", null)

    const { data, error } = await q
    if (error) throw error
    return (data as SuperheroGeneration[]) ?? []
  }

  /* ----------  DELETE & CLEANUP ---------- */
  async deleteGeneration(id: string): Promise<boolean> {
    // fetch row so we can remove any stored images
    const { data: row, error: fetchErr } = await this.supabase
      .from("superhero_generations")
      .select("*")
      .eq("id", id)
      .single()

    if (fetchErr) throw fetchErr
    if (!row) return false

    // derive storage paths from public URLs
    const paths: string[] = []
    const grab = (url: string | null) => {
      if (!url) return
      const idx = url.indexOf("/" + BUCKET + "/")
      if (idx !== -1) paths.push(url.slice(idx + BUCKET.length + 2))
    }
    grab(row.original_image_url)
    grab(row.composite_image_url)

    if (paths.length) {
      const { error: rmErr } = await this.supabase.storage.from(BUCKET).remove(paths)
      if (rmErr) console.warn("Supabase storage remove warning:", rmErr.message)
    }

    const { error: delErr } = await this.supabase.from("superhero_generations").delete().eq("id", id)
    if (delErr) throw delErr
    return true
  }
}

export const supabaseService = new SupabaseService()
