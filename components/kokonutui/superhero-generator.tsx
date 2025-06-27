"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Camera, Upload, Wand2, Download, RotateCcw, Loader2, ImageIcon, AlertCircle, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "@/hooks/use-toast"
import Image from "next/image"

interface GenerationResult {
  id: string
  generationId?: string
  status: "starting" | "processing" | "succeeded" | "failed"
  output?: string[]
  error?: string
}

interface CompositeResult {
  success: boolean
  compositeImage?: string
  storagePath?: string
  error?: string
}

const FRAME_OPTIONS = [
  { value: "default", label: "Gold Frame", description: "Classic gold border frame" },
  { value: "mosque", label: "Mosque Frame", description: "Islamic architectural frame" },
  { value: "comic", label: "Comic Frame", description: "Comic book style frame" },
  { value: "hero", label: "Hero Frame", description: "Superhero themed frame" },
]

export default function SuperheroGenerator() {
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCompositing, setIsCompositing] = useState(false)
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null)
  const [compositeResult, setCompositeResult] = useState<CompositeResult | null>(null)
  const [selectedFrame, setSelectedFrame] = useState("default")
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [generationProgress, setGenerationProgress] = useState<string>("Initializing...")
  const [error, setError] = useState<string | null>(null)
  const [userId] = useState<string | null>(null) // In a real app, get from auth context

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      })
      setStream(mediaStream)
      setIsCameraActive(true)

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (error) {
      console.error("Error accessing camera:", error)
      setError("Unable to access camera. Please check permissions.")
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive",
      })
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
    setIsCameraActive(false)
  }, [stream])

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext("2d")

      if (context) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0)

        const imageDataUrl = canvas.toDataURL("image/jpeg", 0.8)
        setCapturedImage(imageDataUrl)
        stopCamera()
        setError(null)
      }
    }
  }, [stopCamera])

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError("File size too large. Please choose an image under 10MB.")
        toast({
          title: "File Too Large",
          description: "Please choose an image under 10MB.",
          variant: "destructive",
        })
        return
      }

      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError("Please select a valid image file.")
        toast({
          title: "Invalid File Type",
          description: "Please select a valid image file.",
          variant: "destructive",
        })
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        setCapturedImage(e.target?.result as string)
        setError(null)
      }
      reader.readAsDataURL(file)
    }
  }, [])

  const generateSuperhero = useCallback(async () => {
    if (!capturedImage) return

    setIsGenerating(true)
    setGenerationResult(null)
    setCompositeResult(null)
    setError(null)
    setGenerationProgress("Uploading your photo...")

    try {
      // Convert base64 to blob
      const response = await fetch(capturedImage)
      const blob = await response.blob()

      const formData = new FormData()
      formData.append("image", blob, "photo.jpg")
      formData.append("frameType", selectedFrame)
      if (userId) {
        formData.append("userId", userId)
      }

      setGenerationProgress("Starting AI generation...")

      const generateResponse = await fetch("/api/generate-superhero", {
        method: "POST",
        body: formData,
      })

      if (!generateResponse.ok) {
        const errorJson = await generateResponse.json().catch(() => ({}))
        const errMsg = errorJson.error ?? errorJson.message ?? `Server returned ${generateResponse.status}`
        throw new Error(errMsg)
      }

      const result = await generateResponse.json()
      setGenerationResult(result)

      toast({
        title: "Generation Started",
        description: "Your superhero portrait is being created!",
      })

      // Poll for completion
      const pollForCompletion = async (predictionId: string, generationId?: string) => {
        try {
          const checkUrl = `/api/check-generation?id=${predictionId}${generationId ? `&generationId=${generationId}` : ""}`
          const checkResponse = await fetch(checkUrl)

          if (!checkResponse.ok) {
            throw new Error("Failed to check generation status")
          }

          const status = await checkResponse.json()
          setGenerationResult(status)

          if (status.status === "processing") {
            setGenerationProgress("Creating your superhero portrait...")
            setTimeout(() => pollForCompletion(predictionId, generationId), 2000)
          } else if (status.status === "starting") {
            setGenerationProgress("Initializing AI model...")
            setTimeout(() => pollForCompletion(predictionId, generationId), 2000)
          } else if (status.status === "succeeded") {
            setGenerationProgress("Generation complete!")
            setIsGenerating(false)

            toast({
              title: "Generation Complete",
              description: "Your superhero portrait is ready!",
            })

            // Automatically composite with selected frame
            if (status.output?.[0]) {
              await compositeWithFrame(status.output[0], generationId)
            }
          } else if (status.status === "failed") {
            setIsGenerating(false)
            setGenerationProgress("Generation failed")
            setError(status.error || "Generation failed. Please try again.")

            toast({
              title: "Generation Failed",
              description: "Please try again with a different photo.",
              variant: "destructive",
            })
          }
        } catch (error) {
          console.error("Error polling for completion:", error)
          setIsGenerating(false)
          setGenerationProgress("Error checking status")
          setError("Error checking generation status. Please try again.")
        }
      }

      if (result.id) {
        pollForCompletion(result.id, result.generationId)
      }
    } catch (error) {
      console.error("Error generating superhero:", error)
      setIsGenerating(false)
      setGenerationProgress("Generation failed")
      const errorMessage = error instanceof Error ? error.message : "Failed to generate superhero portrait"
      setError(errorMessage)

      toast({
        title: "Generation Error",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }, [capturedImage, selectedFrame, userId])

  const compositeWithFrame = useCallback(
    async (superheroImageUrl: string, generationId?: string) => {
      setIsCompositing(true)
      setGenerationProgress("Adding frame to your portrait...")

      try {
        const formData = new FormData()
        formData.append("superheroImage", superheroImageUrl)
        formData.append("frameType", selectedFrame)
        if (generationId) {
          formData.append("generationId", generationId)
        }
        if (userId) {
          formData.append("userId", userId)
        }

        const response = await fetch("/api/composite-image", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to composite image")
        }

        const result = await response.json()
        setCompositeResult(result)
        setGenerationProgress("Your superhero portrait is ready!")

        toast({
          title: "Frame Added Successfully",
          description: "Your portrait has been saved and is ready for download!",
        })
      } catch (error) {
        console.error("Error compositing image:", error)
        const errorMessage = error instanceof Error ? error.message : "Failed to add frame"
        setCompositeResult({ success: false, error: errorMessage })
        setGenerationProgress("Failed to add frame")
        setError(errorMessage)

        toast({
          title: "Frame Error",
          description: errorMessage,
          variant: "destructive",
        })
      } finally {
        setIsCompositing(false)
      }
    },
    [selectedFrame, userId],
  )

  const resetAll = useCallback(() => {
    setCapturedImage(null)
    setGenerationResult(null)
    setCompositeResult(null)
    setIsGenerating(false)
    setIsCompositing(false)
    setGenerationProgress("Initializing...")
    setError(null)
    stopCamera()
  }, [stopCamera])

  const downloadImage = useCallback(() => {
    const imageToDownload = compositeResult?.compositeImage || generationResult?.output?.[0]

    if (imageToDownload) {
      const link = document.createElement("a")
      link.href = imageToDownload
      link.download = `superhero-portrait-${Date.now()}.png`
      link.target = "_blank"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "Download Started",
        description: "Your superhero portrait is being downloaded!",
      })
    }
  }, [generationResult, compositeResult])

  useEffect(() => {
    if (isCameraActive && videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [isCameraActive, stream])

  const isProcessing = isGenerating || isCompositing
  const finalImage = compositeResult?.compositeImage || generationResult?.output?.[0]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Superhero Generator</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Transform your photo into a Super Hero Masjid character with custom frames
          </p>
        </div>
        {(capturedImage || generationResult) && (
          <Button onClick={resetAll} variant="outline" className="gap-2 bg-transparent">
            <RotateCcw className="h-4 w-4" />
            Start Over
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Photo Capture Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Capture Photo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!capturedImage && !isCameraActive && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button size={"lg"} onClick={startCamera} className="flex-1 gap-2">
                    <Camera className="h-4 w-4" />
                    Take Photo
                  </Button>
                  <Button
                    size={"lg"}
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    className="flex-1 gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Upload Photo
                  </Button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                <p className="text-xs text-gray-500 text-center">
                  Maximum file size: 10MB. Supported formats: JPG, PNG, WebP
                </p>
              </div>
            )}

            {isCameraActive && (
              <div className="space-y-4">
                <div className="relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                </div>
                <div className="flex gap-2">
                  <Button size={"lg"} onClick={capturePhoto} className="flex-1 gap-2">
                    <Camera className="h-4 w-4" />
                    Capture
                  </Button>
                  <Button onClick={stopCamera} variant="outline">
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {capturedImage && (
              <div className="space-y-4">
                <div className="relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                  <Image src={capturedImage || "/placeholder.svg"} alt="Captured photo" fill className="object-cover" />
                </div>

                {/* Frame Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Choose Frame Style</label>
                  <Select value={selectedFrame} onValueChange={setSelectedFrame} disabled={isProcessing}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a frame" />
                    </SelectTrigger>
                    <SelectContent>
                      {FRAME_OPTIONS.map((frame) => (
                        <SelectItem key={frame.value} value={frame.value}>
                          <div className="flex flex-col">
                            <span className="font-medium">{frame.label}</span>
                            <span className="text-xs text-gray-500">{frame.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button size={"lg"} onClick={generateSuperhero} disabled={isProcessing} className="w-full gap-2">
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {isGenerating ? "Generating..." : "Adding Frame..."}
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4" />
                        Generate Superhero
                      </>
                    )}
                  </Button>
                  <Button size={"lg"} onClick={resetAll} variant="outline" className="gap-2 bg-transparent">
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />
          </CardContent>
        </Card>

        {/* Generation Result Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Superhero Portrait
              {finalImage && (
                <Badge variant="secondary" className="ml-auto">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Saved
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!generationResult && !isProcessing && (
              <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <Wand2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Your superhero portrait will appear here</p>
                  <p className="text-xs mt-1">Complete with your selected frame</p>
                </div>
              </div>
            )}

            {isProcessing && (
              <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 mx-auto mb-2 animate-spin text-blue-500" />
                  <p className="text-gray-600 dark:text-gray-400 font-medium">{generationProgress}</p>
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {isGenerating && "This may take 1-2 minutes..."}
                    {isCompositing && "Almost done..."}
                  </div>
                </div>
              </div>
            )}

            {finalImage && !isProcessing && (
              <div className="space-y-4">
                <div className="relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                  <Image
                    src={finalImage || "/placeholder.svg"}
                    alt="Generated superhero portrait with frame"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={downloadImage} className="flex-1 gap-2">
                    <Download className="h-4 w-4" />
                    Download Portrait
                  </Button>
                  {generationResult?.output?.[0] && !compositeResult && (
                    <Button
                      onClick={() => compositeWithFrame(generationResult.output![0], generationResult.generationId)}
                      variant="outline"
                      className="gap-2"
                    >
                      <ImageIcon className="h-4 w-4" />
                      Add Frame
                    </Button>
                  )}
                </div>
                {compositeResult?.success && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Your superhero portrait has been saved to your gallery and is ready for download!
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {generationResult?.status === "failed" && (
              <div className="aspect-square bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                <div className="text-center text-red-600 dark:text-red-400">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p className="font-medium">Generation failed</p>
                  <p className="text-sm mt-1">Please try again with a different photo</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-xs">
                1
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">Take or Upload Photo</h4>
                <p className="text-gray-600 dark:text-gray-400">
                  Capture a photo using your camera or upload an existing image (max 10MB)
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-xs">
                2
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">Choose Frame</h4>
                <p className="text-gray-600 dark:text-gray-400">
                  Select from various frame styles to customize your portrait
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-xs">
                3
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">AI Generation & Storage</h4>
                <p className="text-gray-600 dark:text-gray-400">
                  Our AI creates your superhero and saves it securely to your gallery
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-xs">
                4
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">Download & Share</h4>
                <p className="text-gray-600 dark:text-gray-400">
                  Download your framed superhero portrait and share with friends
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
