"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Download, Trash2, Calendar, ImageIcon, AlertCircle, RefreshCw } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import Image from "next/image"
import type { SuperheroGeneration } from "@/lib/supabase"

export default function History() {
  const [generations, setGenerations] = useState<SuperheroGeneration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchHistory = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/generation-history")

      if (!response.ok) {
        throw new Error("Failed to fetch generation history")
      }

      const data = await response.json()
      setGenerations(data.generations || [])
    } catch (error) {
      console.error("Error fetching history:", error)
      setError(error instanceof Error ? error.message : "Failed to load generation history")
      toast({
        title: "Error Loading History",
        description: "Failed to load your generation history. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const deleteGeneration = async (id: string) => {
    try {
      setDeletingId(id)

      const response = await fetch(`/api/generation-history?id=${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete generation")
      }

      setGenerations((prev) => prev.filter((gen) => gen.id !== id))

      toast({
        title: "Generation Deleted",
        description: "The generation has been successfully deleted.",
      })
    } catch (error) {
      console.error("Error deleting generation:", error)
      toast({
        title: "Delete Error",
        description: "Failed to delete the generation. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDeletingId(null)
    }
  }

  const downloadImage = (imageUrl: string, fileName: string) => {
    const link = document.createElement("a")
    link.href = imageUrl
    link.download = fileName
    link.target = "_blank"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: "Download Started",
      description: "Your image is being downloaded!",
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
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

  const getFrameLabel = (frameType: string) => {
    const frameMap: Record<string, string> = {
      default: "Gold Frame",
      mosque: "Mosque Frame",
      comic: "Comic Frame",
      hero: "Hero Frame",
    }
    return frameMap[frameType] || frameType
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Generation History</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">View and manage your superhero portrait generations</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="aspect-square w-full mb-4" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Generation History</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">View and manage your superhero portrait generations</p>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button onClick={fetchHistory} variant="outline" size="sm" className="ml-4 bg-transparent">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
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
              Start creating your first superhero portrait to see it here!
            </p>
            <Button onClick={() => (window.location.href = "/superhero-generator")}>Create Your First Portrait</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {generations.map((generation) => (
            <Card key={generation.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{getFrameLabel(generation.frame_type)}</CardTitle>
                  {getStatusBadge(generation.generation_status)}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Calendar className="h-3 w-3" />
                  {new Date(generation.created_at).toLocaleDateString()}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                  {generation.composite_image_url ? (
                    <Image
                      src={generation.composite_image_url || "/placeholder.svg"}
                      alt="Generated superhero portrait"
                      fill
                      className="object-cover"
                    />
                  ) : generation.superhero_image_url ? (
                    <Image
                      src={generation.superhero_image_url || "/placeholder.svg"}
                      alt="Generated superhero portrait"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {(generation.composite_image_url || generation.superhero_image_url) && (
                    <Button
                      onClick={() =>
                        downloadImage(
                          generation.composite_image_url || generation.superhero_image_url!,
                          `superhero-${generation.id}.png`,
                        )
                      }
                      className="flex-1 gap-2"
                      size="sm"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </Button>
                  )}
                  <Button
                    onClick={() => deleteGeneration(generation.id)}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={deletingId === generation.id}
                  >
                    {deletingId === generation.id ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </Button>
                </div>

                {generation.generation_status === "failed" && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-3 w-3" />
                    <AlertDescription className="text-xs">
                      Generation failed. You can safely delete this entry.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
