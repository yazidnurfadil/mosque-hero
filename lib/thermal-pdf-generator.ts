import jsPDF from "jspdf"

export interface ThermalPrintOptions {
  paperWidth?: number // in mm
  paperHeight?: number // in mm
  margin?: number // in mm
  dpi?: number
}

export class ThermalPDFGenerator {
  private static readonly THERMAL_PAPER_WIDTH = 58 // 58mm thermal paper
  private static readonly THERMAL_PAPER_HEIGHT = 80 // Adjustable height
  private static readonly DEFAULT_MARGIN = 2

  static async generatePortraitPDF(
    imageUrl: string,
    qrCodeDataURL: string,
    options: ThermalPrintOptions = {},
  ): Promise<Blob> {
    const {
      paperWidth = this.THERMAL_PAPER_WIDTH,
      paperHeight = this.THERMAL_PAPER_HEIGHT,
      margin = this.DEFAULT_MARGIN,
    } = options

    // Create PDF with thermal paper dimensions
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [paperWidth, paperHeight],
      compress: true,
    })

    try {
      // Load the portrait image
      const img = new Image()
      img.crossOrigin = "anonymous"

      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = imageUrl
      })

      // Calculate image dimensions to fit thermal paper
      const maxImageWidth = paperWidth - margin * 2
      const maxImageHeight = paperHeight * 0.7 // Reserve space for QR code

      const aspectRatio = img.width / img.height
      let imageWidth = maxImageWidth
      let imageHeight = imageWidth / aspectRatio

      if (imageHeight > maxImageHeight) {
        imageHeight = maxImageHeight
        imageWidth = imageHeight * aspectRatio
      }

      // Center the image
      const imageX = (paperWidth - imageWidth) / 2
      const imageY = margin

      // Add the portrait image
      pdf.addImage(img, "PNG", imageX, imageY, imageWidth, imageHeight, undefined, "FAST")

      // Add QR code below the image
      const qrSize = 15 // 15mm QR code
      const qrX = (paperWidth - qrSize) / 2
      const qrY = imageY + imageHeight + margin

      pdf.addImage(qrCodeDataURL, "PNG", qrX, qrY, qrSize, qrSize, undefined, "FAST")

      // Add download text
      pdf.setFontSize(6)
      pdf.setFont("helvetica", "normal")
      const downloadText = "Scan to download"
      const textWidth = pdf.getTextWidth(downloadText)
      const textX = (paperWidth - textWidth) / 2
      const textY = qrY + qrSize + 3

      pdf.text(downloadText, textX, textY)

      return pdf.output("blob")
    } catch (error) {
      console.error("Error generating thermal PDF:", error)
      throw new Error("Failed to generate thermal printer PDF")
    }
  }

  static async generateQRCodeOnlyPDF(
    downloadUrl: string,
    qrCodeDataURL: string,
    options: ThermalPrintOptions = {},
  ): Promise<Blob> {
    const {
      paperWidth = this.THERMAL_PAPER_WIDTH,
      paperHeight = 40, // Shorter for QR code only
      margin = this.DEFAULT_MARGIN,
    } = options

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [paperWidth, paperHeight],
      compress: true,
    })

    try {
      // Add title
      pdf.setFontSize(8)
      pdf.setFont("helvetica", "bold")
      const title = "Superhero Portrait"
      const titleWidth = pdf.getTextWidth(title)
      const titleX = (paperWidth - titleWidth) / 2
      pdf.text(title, titleX, margin + 4)

      // Add QR code
      const qrSize = 20 // 20mm QR code
      const qrX = (paperWidth - qrSize) / 2
      const qrY = margin + 8

      pdf.addImage(qrCodeDataURL, "PNG", qrX, qrY, qrSize, qrSize, undefined, "FAST")

      // Add download instructions
      pdf.setFontSize(6)
      pdf.setFont("helvetica", "normal")
      const instructions = ["Scan QR code to download", "your superhero portrait"]

      instructions.forEach((line, index) => {
        const lineWidth = pdf.getTextWidth(line)
        const lineX = (paperWidth - lineWidth) / 2
        const lineY = qrY + qrSize + 4 + index * 3
        pdf.text(line, lineX, lineY)
      })

      return pdf.output("blob")
    } catch (error) {
      console.error("Error generating QR code PDF:", error)
      throw new Error("Failed to generate QR code PDF")
    }
  }

  static downloadPDF(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}
