import { useMemo } from "react"
import { ArrowLeft, Download, ExternalLink, FileType2, Loader2, RefreshCcw } from "lucide-react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { I18nFade } from "@/components/i18n-fade"
import { FilePreviewContent } from "@/components/files/file-preview-content"
import { useI18n } from "@/components/i18n-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useFilePreviewData } from "@/hooks/use-file-preview-data"
import { formatFileSize } from "@/lib/files"
import { buildItemContentUrl } from "@/lib/file-preview"
import { filePreviewMessages } from "@/lib/file-preview-i18n"

function formatDateTime(value: string, locale: "en" | "zh") {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) {
    return "-"
  }

  const localeCode = locale === "zh" ? "zh-CN" : "en-US"
  return new Intl.DateTimeFormat(localeCode, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp)
}

export default function FilePreviewPage() {
  const { locale } = useI18n()
  const text = filePreviewMessages[locale]
  const navigate = useNavigate()
  const location = useLocation()
  const { itemId } = useParams<{ itemId: string }>()

  const {
    item,
    kind,
    loading,
    error,
    reload,
    textPreview,
    torrentPreviewData,
    torrentLoading,
    torrentError,
    textPreviewLimitBytes,
  } = useFilePreviewData(itemId)

  const contentUrl = useMemo(() => (item ? buildItemContentUrl(item.id) : ""), [item])
  const downloadUrl = useMemo(() => (item ? buildItemContentUrl(item.id, true) : ""), [item])

  const goBack = () => {
    navigate({ pathname: "/files", search: location.search })
  }

  return (
    <main className="relative mt-24 px-3 pb-3 md:mt-28 md:px-4 md:pb-4 lg:px-5 lg:pb-5">
      <div className="glass-card rounded-2xl border border-border/55 p-4 md:p-6">
        <I18nFade locale={locale} className="space-y-5">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-muted-foreground" onClick={goBack}>
                <ArrowLeft className="h-4 w-4" />
                {text.backToFiles}
              </Button>

              {item ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-bold text-foreground md:text-2xl">{item.name}</h1>
                    <Badge variant="secondary">{text.kindLabels[kind || "unsupported"]}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{text.fileSize}: {formatFileSize(item.size)}</span>
                    <span>•</span>
                    <span>{text.updatedAt}: {formatDateTime(item.updatedAt, locale)}</span>
                    {item.mimeType ? (
                      <>
                        <span>•</span>
                        <span>{text.mimeType}: {item.mimeType}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={reload}>
                <RefreshCcw className="h-3.5 w-3.5" />
                {text.refresh}
              </Button>

              {item ? (
                <>
                  <Button size="sm" variant="outline" className="h-8 gap-1.5" asChild>
                    <a href={contentUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                      {text.openInNewTab}
                    </a>
                  </Button>
                  <Button size="sm" className="h-8 gap-1.5" asChild>
                    <a href={downloadUrl}>
                      <Download className="h-3.5 w-3.5" />
                      {text.download}
                    </a>
                  </Button>
                </>
              ) : null}
            </div>
          </header>

          {loading ? (
            <div className="flex h-[58vh] items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
              {text.loading}
            </div>
          ) : null}

          {!loading && error ? (
            <div className="rounded-2xl border border-destructive/45 bg-destructive/10 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-lg border border-destructive/35 bg-destructive/15 p-2">
                  <FileType2 className="h-4 w-4 text-destructive" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-base font-semibold text-foreground">{text.notFoundTitle}</h2>
                  <p className="text-sm text-muted-foreground">{text.notFoundDescription}</p>
                  <p className="text-sm text-destructive">{text.loadFailed}: {error}</p>
                  <Button size="sm" variant="outline" onClick={reload}>{text.retry}</Button>
                </div>
              </div>
            </div>
          ) : null}

          {!loading && !error && item && kind ? (
            <FilePreviewContent
              item={item}
              kind={kind}
              contentUrl={contentUrl}
              text={text}
              textPreview={textPreview}
              textPreviewLimitBytes={textPreviewLimitBytes}
              torrentPreviewData={torrentPreviewData}
              torrentLoading={torrentLoading}
              torrentError={torrentError}
            />
          ) : null}
        </I18nFade>
      </div>
    </main>
  )
}
