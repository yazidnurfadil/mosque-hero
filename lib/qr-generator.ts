import QRCode from "qrcode"

export interface QRCodeOptions {
  width?: number
  margin?: number
  color?: {
    dark?: string
    light?: string
  }
  errorCorrectionLevel?: "L" | "M" | "Q" | "H"
}

export class QRCodeGenerator {
  static async generateQRCode(text: string, options: QRCodeOptions = {}): Promise<string> {
    const defaultOptions = {
      width: 200,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
      errorCorrectionLevel: "M" as const,
      ...options,
    }

    try {
      const qrCodeDataURL = await QRCode.toDataURL(text, defaultOptions)
      return qrCodeDataURL
    } catch (error) {
      console.error("Error generating QR code:", error)
      throw new Error("Failed to generate QR code")
    }
  }

  static async generateThermalQRCode(text: string): Promise<string> {
    // Optimized settings for thermal printers
    return this.generateQRCode(text, {
      width: 150,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
      errorCorrectionLevel: "H", // High error correction for thermal printing
    })
  }
}
