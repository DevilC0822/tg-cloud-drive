"use client"

import { Button } from "@/components/ui/button"
import type { FilesPagination } from "@/lib/files"
import type { filesMessages } from "@/lib/i18n"

interface FilesPaginationFooterProps {
  text: (typeof filesMessages)["en"]
  pagination: FilesPagination
  onPageChange: (page: number) => void
}

export function FilesPaginationFooter({ text, pagination, onPageChange }: FilesPaginationFooterProps) {
  return (
    <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
      <div className="text-xs text-muted-foreground">
        {pagination.page} / {Math.max(1, pagination.totalPages)}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => onPageChange(pagination.page - 1)} disabled={pagination.page <= 1}>
          {text.paginationPrev}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={pagination.page >= pagination.totalPages}
        >
          {text.paginationNext}
        </Button>
      </div>
    </div>
  )
}
