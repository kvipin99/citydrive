"use client"

import { useState, useEffect } from "react"
import { Type, ZoomIn, ZoomOut, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * FontSizeToggle allows users to dynamically scale the root font size
 * of the application for better accessibility and readability.
 */
export function FontSizeToggle() {
  // Default matches the global CSS 120%
  const [size, setSize] = useState(120)

  // Load saved preference on mount
  useEffect(() => {
    const savedSize = localStorage.getItem("app-font-size")
    if (savedSize) {
      const parsed = parseInt(savedSize)
      setSize(parsed)
      document.documentElement.style.fontSize = `${parsed}%`
    }
  }, [])

  const updateSize = (newSize: number) => {
    // Clamp between 80% and 150% to prevent UI breaking
    const clamped = Math.min(Math.max(newSize, 80), 150)
    setSize(clamped)
    document.documentElement.style.fontSize = `${clamped}%`
    localStorage.setItem("app-font-size", clamped.toString())
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Type className="h-4 w-4" />
          <span className="sr-only">Toggle font size</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Text Size: {size}%
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => updateSize(size + 10)} className="gap-2 cursor-pointer">
          <ZoomIn className="h-4 w-4" />
          <span>Increase</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => updateSize(size - 10)} className="gap-2 cursor-pointer">
          <ZoomOut className="h-4 w-4" />
          <span>Decrease</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => updateSize(120)} className="gap-2 cursor-pointer text-primary">
          <RotateCcw className="h-4 w-4" />
          <span>Reset (Default)</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}