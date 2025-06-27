"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, Trash2, Calendar, ImageIcon, AlertCircle, Loader2, RefreshCw, QrCode, Printer } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import Image from "next/image"
import type { SuperheroGeneration } from "@/lib/supabase-service"
import { generateDownloadQRPDF, generatePortraitPDF, downloadBlob } from "@/lib/print-utils"

export default function History() {
  const [generations, setGenerations] = useState<SuperheroGeneration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [generatingPDF, setGeneratingPDF] = useState<Set<string>>(new Set())

  const fetchHistory = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log("Fetching generation history...")

      const response = await fetch("/api/generation-history")

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Server returned ${response.status}`)
      }

      const data = await response.json()
      console.log("History fetched:", data.history?.length || 0, "records")
      setGenerations(data.history || [])
    } catch (err) {
      console.error("Error fetching generation history:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch history"
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const deleteGeneration = async (id: string) => {
    try {
      setDeletingIds((prev) => new Set(prev).add(id))
      console.log("Deleting generation:", id)

      const response = await fetch(`/api/generation-history?id=${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to delete generation")
      }

      console.log("Generation deleted successfully:", id)
      setGenerations((prev) => prev.filter((gen) => gen.id !== id))

      toast({
        title: "Success",
        description: "Generation deleted successfully",
      })
    } catch (err) {
      console.error("Error deleting generation:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to delete generation"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setDeletingIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  const downloadImage = (url: string, filename: string) => {
    try {
      console.log("Downloading image:", url)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      link.target = "_blank"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "Download Started",
        description: "Your image is being downloaded",
      })
    } catch (err) {
      console.error("Error downloading image:", err)
      toast({
        title: "Error",
        description: "Failed to download image",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-500">
            Completed
          </Badge>
        )
      case "processing":
        return <Badge variant="secondary">Processing</Badge>
      case "failed":
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return "Invalid date"
    }
  }

  const generateQRCodePDF = async (generation: SuperheroGeneration) => {
    const imageUrl = generation.composite_image_url || generation.superhero_image_url
    if (!imageUrl) return

    try {
      setGeneratingPDF((prev) => new Set(prev).add(`qr-${generation.id}`))
      console.log("Generating QR code PDF for:", imageUrl)

      const pdfBlob = await generateDownloadQRPDF(imageUrl, `superhero-qr-${generation.id}.pdf`)
      downloadBlob(pdfBlob, `superhero-qr-${generation.id}.pdf`)

      toast({
        title: "QR Code PDF Generated",
        description: "Your QR code PDF is ready for thermal printing!",
      })
    } catch (error) {
      console.error("Error generating QR PDF:", error)
      toast({
        title: "Error",
        description: "Failed to generate QR code PDF",
        variant: "destructive",
      })
    } finally {
      setGeneratingPDF((prev) => {
        const newSet = new Set(prev)
        newSet.delete(`qr-${generation.id}`)
        return newSet
      })
    }
  }

  const generatePortraitPrintPDF = async (generation: SuperheroGeneration) => {
    const imageUrl = generation.composite_image_url || generation.superhero_image_url
    if (!imageUrl) return

    try {
      setGeneratingPDF((prev) => new Set(prev).add(`portrait-${generation.id}`))
      console.log("Generating portrait PDF for:", imageUrl)

      const pdfBlob = await generatePortraitPDF(imageUrl, `superhero-portrait-${generation.id}.pdf`)
      downloadBlob(pdfBlob, `superhero-portrait-${generation.id}.pdf`)

      toast({
        title: "Portrait PDF Generated",
        description: "Your portrait PDF is ready for thermal printing!",
      })
    } catch (error) {
      console.error("Error generating portrait PDF:", error)
      toast({
        title: "Error",
        description: "Failed to generate portrait PDF",
        variant: "destructive",
      })
    } finally {
      setGeneratingPDF((prev) => {
        const newSet = new Set(prev)
        newSet.delete(`portrait-${generation.id}`)
        return newSet
      })
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-gray-600 dark:text-gray-400">Loading your generation history...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={fetchHistory} variant="outline" className="gap-2 bg-transparent">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Generation History</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">View and manage your superhero portrait generations</p>
        </div>
        <Button onClick={fetchHistory} variant="outline" className="gap-2 bg-transparent">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {generations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ImageIcon className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No generations yet</h3>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
              Start creating superhero portraits to see them here
            </p>
            <Button asChild>
              <a href="/superhero-generator">Create Your First Portrait</a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {generations.map((generation) => (
            <Card key={generation.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {generation.frame_type
                      ? `${generation.frame_type.charAt(0).toUpperCase() + generation.frame_type.slice(1)} Frame`
                      : "Superhero Portrait"}
                  </CardTitle>
                  {getStatusBadge(generation.generation_status)}
                </div>
                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                  <Calendar className="h-3 w-3 mr-1" />
                  {formatDate(generation.created_at)}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Image Preview */}
                <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                  {generation.composite_image_url ? (
                    <Image
                      src={generation.composite_image_url || "/placeholder.svg"}
                      alt="Generated superhero portrait"
                      width={300}
                      height={300}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error("Image load error:", e)
                        // Fallback to superhero image if composite fails
                        if (generation.superhero_image_url) {
                          ;(e.target as HTMLImageElement).src = generation.superhero_image_url
                        }
                      }}
                    />
                  ) : generation.superhero_image_url ? (
                    <Image
                      src={generation.superhero_image_url || "/placeholder.svg"}
                      alt="Generated superhero portrait"
                      width={300}
                      height={300}
                      className="w-full h-full object-cover"
                    />
                  ) : generation.original_image_url ? (
                    <Image
                      src={generation.original_image_url || "/placeholder.svg"}
                      alt="Original photo"
                      width={300}
                      height={300}
                      className="w-full h-full object-cover opacity-50"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  {/* Download Actions */}
                  <div className="flex gap-2">
                    {(generation.composite_image_url || generation.superhero_image_url) && (
                      <Button
                        onClick={() =>
                          downloadImage(
                            generation.composite_image_url || generation.superhero_image_url!,
                            `superhero-${generation.id}.png`,
                          )
                        }
                        size="sm"
                        className="flex-1 gap-2"
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </Button>
                    )}

                    <Button
                      onClick={() => deleteGeneration(generation.id)}
                      disabled={deletingIds.has(generation.id)}
                      size="sm"
                      variant="destructive"
                      className="gap-2"
                    >
                      {deletingIds.has(generation.id) ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                      Delete
                    </Button>
                  </div>

                  {/* Print Actions */}
                  {(generation.composite_image_url || generation.superhero_image_url) && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => generateQRCodePDF(generation)}
                        disabled={generatingPDF.has(`qr-${generation.id}`)}
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-2"
                      >
                        {generatingPDF.has(`qr-${generation.id}`) ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <QrCode className="h-3 w-3" />
                        )}
                        QR PDF
                      </Button>

                      <Button
                        onClick={() => generatePortraitPrintPDF(generation)}
                        disabled={generatingPDF.has(`portrait-${generation.id}`)}
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-2"
                      >
                        {generatingPDF.has(`portrait-${generation.id}`) ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Printer className="h-3 w-3" />
                        )}
                        Print PDF
                      </Button>
                    </div>
                  )}
                </div>

                {/* Status Info */}
                {generation.generation_status === "processing" && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">Generation in progress...</p>
                )}

                {generation.generation_status === "failed" && (
                  <p className="text-xs text-red-500">Generation failed. Please try again.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
