"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { QrCode, Printer, Download, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { QRCodeGenerator } from "@/lib/qr-generator"
import { ThermalPDFGenerator } from "@/lib/thermal-pdf-generator"
import Image from "next/image"

interface ThermalPrintControlsProps {
  imageUrl: string
  downloadUrl: string
  generationId?: string
  className?: string
}

export default function ThermalPrintControls({
  imageUrl,
  downloadUrl,
  generationId,
  className,
}: ThermalPrintControlsProps) {
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string | null>(null)
  const [isGeneratingQR, setIsGeneratingQR] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateQRCode = async () => {
    try {
      setIsGeneratingQR(true)
      setError(null)

      console.log("Generating QR code for URL:", downloadUrl)
      const qrCode = await QRCodeGenerator.generateThermalQRCode(downloadUrl)
      setQrCodeDataURL(qrCode)

      toast({
        title: "QR Code Generated",
        description: "QR code is ready for thermal printing",
      })
    } catch (err) {
      console.error("Error generating QR code:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to generate QR code"
      setError(errorMessage)

      toast({
        title: "QR Code Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsGeneratingQR(false)
    }
  }

  const printPortraitWithQR = async () => {
    try {
      setIsGeneratingPDF(true)
      setError(null)

      // Generate QR code if not already generated
      let qrCode = qrCodeDataURL
      if (!qrCode) {
        console.log("Generating QR code for portrait PDF...")
        qrCode = await QRCodeGenerator.generateThermalQRCode(downloadUrl)
        setQrCodeDataURL(qrCode)
      }

      console.log("Generating thermal portrait PDF...")
      const pdfBlob = await ThermalPDFGenerator.generatePortraitPDF(imageUrl, qrCode)

      const filename = `superhero-portrait-${generationId || Date.now()}.pdf`
      ThermalPDFGenerator.downloadPDF(pdfBlob, filename)

      toast({
        title: "PDF Generated",
        description: "Thermal printer-friendly PDF is ready for download",
      })
    } catch (err) {
      console.error("Error generating portrait PDF:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to generate PDF"
      setError(errorMessage)

      toast({
        title: "PDF Generation Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  const printQRCodeOnly = async () => {
    try {
      setIsGeneratingPDF(true)
      setError(null)

      // Generate QR code if not already generated
      let qrCode = qrCodeDataURL
      if (!qrCode) {
        console.log("Generating QR code for QR-only PDF...")
        qrCode = await QRCodeGenerator.generateThermalQRCode(downloadUrl)
        setQrCodeDataURL(qrCode)
      }

      console.log("Generating QR code only PDF...")
      const pdfBlob = await ThermalPDFGenerator.generateQRCodeOnlyPDF(downloadUrl, qrCode)

      const filename = `superhero-qr-${generationId || Date.now()}.pdf`
      ThermalPDFGenerator.downloadPDF(pdfBlob, filename)

      toast({
        title: "QR Code PDF Generated",
        description: "QR code PDF is ready for thermal printing",
      })
    } catch (err) {
      console.error("Error generating QR code PDF:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to generate QR code PDF"
      setError(errorMessage)

      toast({
        title: "PDF Generation Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  const downloadImage = () => {
    const link = document.createElement("a")
    link.href = downloadUrl
    link.download = `superhero-portrait-${generationId || Date.now()}.png`
    link.target = "_blank"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: "Download Started",
      description: "Your superhero portrait is being downloaded",
    })
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="h-5 w-5" />
          Thermal Printing Options
          <Badge variant="secondary" className="ml-auto">
            58mm Compatible
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* QR Code Preview */}
        {qrCodeDataURL && (
          <div className="flex flex-col items-center space-y-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="relative">
              <Image
                src={qrCodeDataURL || "/placeholder.svg"}
                alt="Download QR Code"
                width={120}
                height={120}
                className="border border-gray-200 dark:border-gray-600 rounded"
              />
              <Badge className="absolute -top-2 -right-2 bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                Ready
              </Badge>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 text-center">Scan to download your portrait</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 gap-3">
          {/* Generate QR Code */}
          <Button
            onClick={generateQRCode}
            disabled={isGeneratingQR || isGeneratingPDF}
            variant="outline"
            className="gap-2 bg-transparent"
          >
            {isGeneratingQR ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
            {qrCodeDataURL ? "Regenerate QR Code" : "Generate QR Code"}
          </Button>

          {/* Download Original */}
          <Button onClick={downloadImage} disabled={isGeneratingPDF} className="gap-2">
            <Download className="h-4 w-4" />
            Download Original Image
          </Button>

          {/* Print Portrait with QR */}
          <Button
            onClick={printPortraitWithQR}
            disabled={isGeneratingPDF || isGeneratingQR}
            variant="secondary"
            className="gap-2"
          >
            {isGeneratingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            Print Portrait + QR Code
          </Button>

          {/* Print QR Code Only */}
          <Button
            onClick={printQRCodeOnly}
            disabled={isGeneratingPDF || isGeneratingQR}
            variant="outline"
            className="gap-2 bg-transparent"
          >
            {isGeneratingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
            Print QR Code Only
          </Button>
        </div>

        {/* Thermal Printer Instructions */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">Thermal Printer Instructions:</h4>
          <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Optimized for 58mm thermal paper</li>
            <li>• Use high-quality thermal paper for best results</li>
            <li>• Ensure printer is set to actual size (100%)</li>
            <li>• QR codes use high error correction for reliability</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
