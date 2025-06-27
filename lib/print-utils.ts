import QRCode from "qrcode"
import jsPDF from "jspdf"

export interface ThermalPrintOptions {
  width: number // in mm
  imageWidth: number // in mm
  margin: number // in mm
  dpi: number
}

// Standard thermal printer settings (80mm paper)
export const THERMAL_SETTINGS: ThermalPrintOptions = {
  width: 80, // 80mm thermal paper
  imageWidth: 70, // Leave 5mm margin on each side
  margin: 5,
  dpi: 203, // Common thermal printer DPI
}

export async function generateQRCode(url: string, size = 200): Promise<string> {
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(url, {
      width: size,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    })
    return qrCodeDataUrl
  } catch (error) {
    console.error("Error generating QR code:", error)
    throw new Error("Failed to generate QR code")
  }
}

export async function generateDownloadQRPDF(downloadUrl: string, filename: string): Promise<Blob> {
  try {
    // Generate QR code
    const qrCodeDataUrl = await generateQRCode(downloadUrl, 300)

    // Create PDF with thermal printer dimensions
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [THERMAL_SETTINGS.width, 120], // 80mm width, 120mm height
    })

    // Add title
    pdf.setFontSize(12)
    pdf.setFont("helvetica", "bold")
    pdf.text("Superhero Portrait", THERMAL_SETTINGS.width / 2, 15, { align: "center" })

    // Add QR code
    const qrSize = 50 // 50mm QR code
    const qrX = (THERMAL_SETTINGS.width - qrSize) / 2
    pdf.addImage(qrCodeDataUrl, "PNG", qrX, 25, qrSize, qrSize)

    // Add instructions
    pdf.setFontSize(8)
    pdf.setFont("helvetica", "normal")
    pdf.text("Scan QR code to download", THERMAL_SETTINGS.width / 2, 85, { align: "center" })
    pdf.text("your superhero portrait", THERMAL_SETTINGS.width / 2, 92, { align: "center" })

    // Add URL (truncated if too long)
    const maxUrlLength = 35
    const displayUrl = downloadUrl.length > maxUrlLength ? downloadUrl.substring(0, maxUrlLength) + "..." : downloadUrl

    pdf.setFontSize(6)
    pdf.text(displayUrl, THERMAL_SETTINGS.width / 2, 105, { align: "center" })

    // Add timestamp
    const timestamp = new Date().toLocaleString()
    pdf.text(`Generated: ${timestamp}`, THERMAL_SETTINGS.width / 2, 115, { align: "center" })

    return pdf.output("blob")
  } catch (error) {
    console.error("Error generating QR PDF:", error)
    throw new Error("Failed to generate QR code PDF")
  }
}

export async function generatePortraitPDF(imageUrl: string, filename: string): Promise<Blob> {
  try {
    // Create a temporary image element to get dimensions
    const img = new Image()
    img.crossOrigin = "anonymous"

    return new Promise((resolve, reject) => {
      img.onload = () => {
        try {
          // Calculate dimensions for thermal printer
          const aspectRatio = img.height / img.width
          const printWidth = THERMAL_SETTINGS.imageWidth
          const printHeight = printWidth * aspectRatio

          // Create PDF with appropriate height
          const pdfHeight = printHeight + THERMAL_SETTINGS.margin * 3 + 20 // Extra space for text
          const pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: [THERMAL_SETTINGS.width, pdfHeight],
          })

          // Add title
          pdf.setFontSize(10)
          pdf.setFont("helvetica", "bold")
          pdf.text("Superhero Portrait", THERMAL_SETTINGS.width / 2, 10, { align: "center" })

          // Add image
          const imageX = (THERMAL_SETTINGS.width - printWidth) / 2
          pdf.addImage(imageUrl, "PNG", imageX, 15, printWidth, printHeight)

          // Add timestamp at bottom
          pdf.setFontSize(6)
          pdf.setFont("helvetica", "normal")
          const timestamp = new Date().toLocaleString()
          pdf.text(`Generated: ${timestamp}`, THERMAL_SETTINGS.width / 2, pdfHeight - 5, { align: "center" })

          resolve(pdf.output("blob"))
        } catch (error) {
          reject(error)
        }
      }

      img.onerror = () => {
        reject(new Error("Failed to load image"))
      }

      img.src = imageUrl
    })
  } catch (error) {
    console.error("Error generating portrait PDF:", error)
    throw new Error("Failed to generate portrait PDF")
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
