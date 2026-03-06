"use client"

import { ChevronRight, Home } from "lucide-react"
import type { BreadcrumbItem } from "@/lib/files"
import type { filesMessages } from "@/lib/i18n"

interface FilesBreadcrumbsProps {
  text: (typeof filesMessages)["en"]
  isVaultSection: boolean
  breadcrumbs: BreadcrumbItem[]
  onNavigate: (folderId: string) => void
}

export function FilesBreadcrumbs({ text, isVaultSection, breadcrumbs, onNavigate }: FilesBreadcrumbsProps) {
  if (isVaultSection) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
        <span>{text.sectionVault}</span>
      </div>
    )
  }

  return (
    <>
      <button
        className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => onNavigate("root")}
      >
        <Home className="h-4 w-4" />
        <span>{text.home}</span>
      </button>
      {breadcrumbs.slice(1).map((crumb) => (
        <div key={crumb.id} className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          <button className="text-muted-foreground hover:text-foreground" onClick={() => onNavigate(crumb.id)}>
            {crumb.name}
          </button>
        </div>
      ))}
    </>
  )
}
