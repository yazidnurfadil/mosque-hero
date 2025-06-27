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
    try {
      console.log("Uploading image to Supabase Storage:", { filename, contentType, userId, bufferSize: buffer.length })

      const ext = filename.split(".").pop() ?? "png"
      const key = `${userId ?? "anonymous"}/${Date.now()}-${uuidv4()}.${ext}`

      // Ensure bucket exists and is accessible
      const { data: buckets, error: bucketsError } = await this.supabase.storage.listBuckets()
      if (bucketsError) {
        console.error("Error listing buckets:", bucketsError)
        throw new Error(`Storage bucket access error: ${bucketsError.message}`)
      }

      const bucketExists = buckets?.some((bucket) => bucket.name === BUCKET)
      if (!bucketExists) {
        console.error("Bucket does not exist:", BUCKET)
        throw new Error(`Storage bucket '${BUCKET}' does not exist`)
      }

      // Upload with retry logic for production reliability
      let uploadAttempts = 0
      const maxAttempts = 3
      let lastError: any

      while (uploadAttempts < maxAttempts) {
        try {
          const { data, error } = await this.supabase.storage.from(BUCKET).upload(key, buffer, {
            contentType,
            upsert: false,
            cacheControl: "3600", // 1 hour cache
          })

          if (error) {
            console.error(`Upload attempt ${uploadAttempts + 1} failed:`, error)
            lastError = error
            uploadAttempts++

            if (uploadAttempts < maxAttempts) {
              // Wait before retry (exponential backoff)
              await new Promise((resolve) => setTimeout(resolve, Math.pow(2, uploadAttempts) * 1000))
              continue
            }
            throw error
          }

          console.log("Upload successful:", data)

          const { data: publicURL } = this.supabase.storage.from(BUCKET).getPublicUrl(key)

          if (!publicURL?.publicUrl) {
            throw new Error("Failed to get public URL for uploaded image")
          }

          console.log("Public URL generated:", publicURL.publicUrl)
          return { path: data.path, url: publicURL.publicUrl }
        } catch (attemptError) {
          lastError = attemptError
          uploadAttempts++

          if (uploadAttempts < maxAttempts) {
            console.log(`Retrying upload (attempt ${uploadAttempts + 1}/${maxAttempts})`)
            await new Promise((resolve) => setTimeout(resolve, Math.pow(2, uploadAttempts) * 1000))
          }
        }
      }

      throw lastError
    } catch (error) {
      console.error("Upload image error:", error)
      throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  /* ----------  DATABASE ---------- */
  async createGeneration(payload: {
    originalImageUrl: string
    frameType: string
    replicatePredictionId: string
    userId?: string | null
  }) {
    try {
      console.log("Creating generation record:", payload)

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

      if (error) {
        console.error("Database insert error:", error)
        throw error
      }

      console.log("Generation record created:", data)
      return data
    } catch (error) {
      console.error("Create generation error:", error)
      throw new Error(`Failed to create generation record: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  async updateGeneration(id: string, fields: Record<string, unknown>) {
    try {
      console.log("Updating generation record:", { id, fields })

      const { data, error } = await this.supabase
        .from("superhero_generations")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single()

      if (error) {
        console.error("Database update error:", error)
        throw error
      }

      console.log("Generation record updated:", data)
      return data
    } catch (error) {
      console.error("Update generation error:", error)
      throw new Error(`Failed to update generation record: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  /* ----------  HISTORY ---------- */
  async getGenerationHistory(userId?: string | null, limit = 20): Promise<SuperheroGeneration[]> {
    try {
      console.log("Fetching generation history:", { userId, limit })

      let q = this.supabase
        .from("superhero_generations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit)

      if (userId) q = q.eq("user_id", userId)
      else q = q.is("user_id", null)

      const { data, error } = await q
      if (error) {
        console.error("Database query error:", error)
        throw error
      }

      console.log("Generation history fetched:", data?.length || 0, "records")
      return (data as SuperheroGeneration[]) ?? []
    } catch (error) {
      console.error("Get generation history error:", error)
      throw new Error(`Failed to fetch generation history: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  /* ----------  DELETE & CLEANUP ---------- */
  async deleteGeneration(id: string): Promise<boolean> {
    try {
      console.log("Deleting generation:", id)

      // fetch row so we can remove any stored images
      const { data: row, error: fetchErr } = await this.supabase
        .from("superhero_generations")
        .select("*")
        .eq("id", id)
        .single()

      if (fetchErr) {
        console.error("Error fetching generation for deletion:", fetchErr)
        throw fetchErr
      }

      if (!row) {
        console.log("Generation not found:", id)
        return false
      }

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
        console.log("Removing storage files:", paths)
        const { error: rmErr } = await this.supabase.storage.from(BUCKET).remove(paths)
        if (rmErr) console.warn("Supabase storage remove warning:", rmErr.message)
      }

      const { error: delErr } = await this.supabase.from("superhero_generations").delete().eq("id", id)
      if (delErr) {
        console.error("Error deleting generation record:", delErr)
        throw delErr
      }

      console.log("Generation deleted successfully:", id)
      return true
    } catch (error) {
      console.error("Delete generation error:", error)
      throw new Error(`Failed to delete generation: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }
}

export const supabaseService = new SupabaseService()
