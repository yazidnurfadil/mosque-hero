"use client";

import { Download } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Component() {
  // Sample data for generated images
  const imageHistory = [
    {
      id: 1,
      thumbnail: "https://picsum.photos/seed/picsum/200/300?height=80&width=80",
      url: "https://picsum.photos/seed/picsum/200/300",
      generatedDate: "2024-01-15 14:30:22",
    },
    {
      id: 2,
      thumbnail: "https://picsum.photos/seed/picsum/200/300?height=80&width=80",
      url: "https://picsum.photos/seed/picsum/200/300",
      generatedDate: "2024-01-15 13:45:18",
    },
    {
      id: 3,
      thumbnail: "https://picsum.photos/seed/picsum/200/300?height=80&width=80",
      url: "https://picsum.photos/seed/picsum/200/300",
      generatedDate: "2024-01-15 12:20:45",
    },
    {
      id: 4,
      thumbnail: "https://picsum.photos/seed/picsum/200/300?height=80&width=80",
      url: "https://picsum.photos/seed/picsum/200/300",
      generatedDate: "2024-01-15 11:15:33",
    },
    {
      id: 5,
      thumbnail: "https://picsum.photos/seed/picsum/200/300?height=80&width=80",
      url: "https://picsum.photos/seed/picsum/200/300",
      generatedDate: "2024-01-15 10:05:12",
    },
  ];

  const handleDownload = async (url: string) => {
    try {
      // Fetch the image with proper headers
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/octet-stream",
        },
      });

      if (!response.ok) throw new Error("Network response was not ok");

      const blob = await response.blob();

      // Create a blob URL
      const blobUrl = URL.createObjectURL(blob);

      // Extract filename from URL or use default
      const filename =
        url.split("/").pop()?.split("?")[0] || "generated-image.png";

      // Create and trigger download
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (error) {
      console.error("Download failed:", error);

      // Alternative download method
      const link = document.createElement("a");
      link.href = url;
      link.download =
        url.split("/").pop()?.split("?")[0] || "generated-image.png";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const openInNewTab = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-gray-800 hover:bg-gray-800/50">
          <TableHead className=" font-medium">Thumbnail</TableHead>
          <TableHead className=" font-medium">Image URL</TableHead>
          <TableHead className=" font-medium">Generated Date</TableHead>
          <TableHead className=" font-medium text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {imageHistory.map((item) => (
          <TableRow
            key={item.id}
            className="border-gray-800 hover:bg-gray-800/30"
          >
            <TableCell className="py-4">
              <Image
                src={item.thumbnail || "/placeholder.svg"}
                alt="Generated image thumbnail"
                width={60}
                height={60}
                className="rounded-lg object-cover border border-gray-700"
              />
            </TableCell>
            <TableCell className=" font-mono text-sm max-w-xs">
              <div
                className="truncate cursor-pointer hover:text-green-400 transition-colors"
                onClick={() => openInNewTab(item.url)}
                title="Click to open in new tab"
              >
                {item.url}
              </div>
            </TableCell>
            <TableCell className="text-gray-400 text-sm">
              {item.generatedDate}
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(item.url)}
                className="bg-transparent border-gray-700  hover:bg-gray-800 hover:text-white hover:border-gray-600"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
