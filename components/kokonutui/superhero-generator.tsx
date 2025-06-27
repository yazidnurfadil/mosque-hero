"use client";

import type React from "react";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Camera,
  Upload,
  Wand2,
  Download,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";

interface GenerationResult {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed";
  output?: string[];
  error?: string;
}

export default function SuperheroGenerator() {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] =
    useState<GenerationResult | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      setStream(mediaStream);
      setIsCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      alert("Unable to access camera. Please check permissions.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);

        const imageDataUrl = canvas.toDataURL("image/jpeg", 0.8);
        setCapturedImage(imageDataUrl);
        stopCamera();
      }
    }
  }, [stopCamera]);

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setCapturedImage(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    },
    []
  );

  const generateSuperhero = useCallback(async () => {
    if (!capturedImage) return;

    setIsGenerating(true);
    setGenerationResult(null);

    try {
      // Convert base64 to blob
      // const response = await fetch(capturedImage);
      // const blob = await response.blob();

      // const formData = new FormData();
      // formData.append("image", blob, "photo.jpg");

      // const generateResponse = await fetch("/api/generate-superhero", {
      //   method: "POST",
      //   body: formData,
      // });

      // if (!generateResponse.ok) {
      //   throw new Error("Failed to start generation");
      // }

      // const result = await generateResponse.json();
      const fakeResult: GenerationResult = {
        id: "12345",
        status: "succeeded",
        output: ["https://picsum.photos/id/237/200/300"],
      };

      setGenerationResult(fakeResult);

      // // Poll for completion
      // const pollForCompletion = async (predictionId: string) => {
      //   const checkResponse = await fetch(
      //     `/api/check-generation?id=${predictionId}`
      //   );
      //   const status = await checkResponse.json();

      //   setGenerationResult(status);

      //   if (status.status === "processing" || status.status === "starting") {
      //     setTimeout(() => pollForCompletion(predictionId), 2000);
      //   } else {
      //     setIsGenerating(false);
      //   }
      // };

      // if (result.id) {
      //   pollForCompletion(result.id);
      // }
    } catch (error) {
      console.error("Error generating superhero:", error);
      setIsGenerating(false);
      alert("Failed to generate superhero portrait. Please try again.");
    }
  }, [capturedImage]);

  const resetAll = useCallback(() => {
    setCapturedImage(null);
    setGenerationResult(null);
    setIsGenerating(false);
    stopCamera();
  }, [stopCamera]);

  const downloadImage = useCallback(() => {
    if (generationResult?.output?.[0]) {
      const link = document.createElement("a");
      link.href = generationResult.output[0];
      link.download = "superhero-portrait.jpg";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [generationResult]);

  useEffect(() => {
    if (isCameraActive && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [isCameraActive, stream]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Superhero Generator
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Transform your photo into a Super Hero Masjid character
          </p>
        </div>
        {(capturedImage || generationResult) && (
          <Button onClick={resetAll} variant="outline" className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Start Over
          </Button>
        )}
      </div>

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
                  <Button
                    size={"lg"}
                    onClick={startCamera}
                    className="flex-1 gap-2"
                  >
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
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            )}

            {isCameraActive && (
              <div className="space-y-4">
                <div className="relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size={"lg"}
                    onClick={capturePhoto}
                    className="flex-1 gap-2"
                  >
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
                  <Image
                    src={capturedImage || "/placeholder.svg"}
                    alt="Captured photo"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size={"lg"}
                    onClick={generateSuperhero}
                    disabled={isGenerating}
                    className="w-full gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4" />
                        Generate Superhero
                      </>
                    )}
                  </Button>
                  <Button
                    size={"lg"}
                    onClick={resetAll}
                    variant="outline"
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Start Over
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
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!generationResult && (
              <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <Wand2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Your superhero portrait will appear here</p>
                </div>
              </div>
            )}

            {generationResult && (
              <div className="space-y-4">
                {generationResult.status === "processing" ||
                generationResult.status === "starting" ? (
                  <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="h-12 w-12 mx-auto mb-2 animate-spin text-blue-500" />
                      <p className="text-gray-600 dark:text-gray-400">
                        Creating your superhero...
                      </p>
                    </div>
                  </div>
                ) : generationResult.status === "succeeded" &&
                  generationResult.output?.[0] ? (
                  <div className="space-y-4">
                    <div className="relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                      <Image
                        src={generationResult.output[0] || "/placeholder.svg"}
                        alt="Generated superhero portrait"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <Button onClick={downloadImage} className="w-full gap-2">
                      <Download className="h-4 w-4" />
                      Download Portrait
                    </Button>
                  </div>
                ) : (
                  <div className="aspect-square bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                    <div className="text-center text-red-600 dark:text-red-400">
                      <p>Generation failed. Please try again.</p>
                    </div>
                  </div>
                )}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-xs">
                1
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">
                  Take or Upload Photo
                </h4>
                <p className="text-gray-600 dark:text-gray-400">
                  Capture a photo using your camera or upload an existing image
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-xs">
                2
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">
                  AI Generation
                </h4>
                <p className="text-gray-600 dark:text-gray-400">
                  Our AI transforms your photo into a Super Hero Masjid
                  character
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-xs">
                3
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">
                  Download & Share
                </h4>
                <p className="text-gray-600 dark:text-gray-400">
                  Download your superhero portrait and share with friends
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
