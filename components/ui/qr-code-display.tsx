"use client"

import { useState, useEffect } from "react"
import { generateQRCode } from "@/lib/print-utils"
import { Loader2 } from "lucide-react"
import Image from "next/image"

interface QRCodeDisplayProps {
  url: string
  size?: number
  className?: string
}

export function QRCodeDisplay({ url, size = 200, className }: QRCodeDisplayProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function generateQR() {
      try {
        setLoading(true)
        setError(null)
        const qrUrl = await generateQRCode(url, size)
        setQrCodeUrl(qrUrl)
      } catch (err) {
        console.error("Error generating QR code:", err)
        setError("Failed to generate QR code")
      } finally {
        setLoading(false)
      }
    }

    if (url) {
      generateQR()
    }
  }, [url, size])

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error || !qrCodeUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-sm text-gray-500">QR Error</span>
      </div>
    )
  }

  return (
    <Image
      src={qrCodeUrl || "/placeholder.svg"}
      alt="QR Code for download"
      width={size}
      height={size}
      className={className}
    />
  )
}
