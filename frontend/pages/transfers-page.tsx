import { useState } from "react"
import { useAtomValue } from "jotai"
import { motion } from "framer-motion"
import { I18nFade } from "@/components/i18n-fade"
import { useI18n } from "@/components/i18n-provider"
import { HistoryTransferList } from "@/components/transfers/history-transfer-list"
import { LiveTransferList } from "@/components/transfers/live-transfer-list"
import { TorrentTaskList } from "@/components/transfers/torrent-task-list"
import { TorrentTaskSheet } from "@/components/transfers/torrent-task-sheet"
import { TransferDetailSheet } from "@/components/transfers/transfer-detail-sheet"
import { TransferHero } from "@/components/transfers/transfer-hero"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTorrentTaskHistory } from "@/hooks/use-torrent-task-history"
import { useTransfers } from "@/hooks/use-transfers"
import { useToast } from "@/hooks/use-toast"
import { transferMessages } from "@/lib/i18n"
import { mergeActiveTransfersWithUploadTasks, type TransferJobListItem } from "@/lib/transfer-live-items"
import type { transferMessages as transferMessageType } from "@/lib/i18n"
import { uploadTasksAtom } from "@/stores/upload-atoms"

const CONTAINER_VARIANTS = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.05,
    },
  },
}

const ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
    },
  },
}

type TransferText = (typeof transferMessageType)["en"]

function TabsHeader({ text }: { text: TransferText }) {
  return (
    <div className="rounded-[32px] border border-border/60 bg-secondary/15 p-3">
      <TabsList className="h-auto w-full flex-wrap gap-2 rounded-[24px] bg-background/45 p-2">
        <TabsTrigger value="jobs" className="min-h-11 min-w-[180px] grow rounded-2xl text-sm font-semibold">
          {text.jobsTab}
        </TabsTrigger>
        <TabsTrigger value="torrent" className="min-h-11 min-w-[180px] grow rounded-2xl text-sm font-semibold">
          {text.torrentTab}
        </TabsTrigger>
      </TabsList>
    </div>
  )
}

function JobsTab({
  transfers,
  liveTransfers,
  text,
  onOpenDetail,
  onDeleteActive,
  onDeleteHistory,
}: {
  transfers: ReturnType<typeof useTransfers>
  liveTransfers: TransferJobListItem[]
  text: TransferText
  onOpenDetail: (id: string) => void
  onDeleteActive: (id: string) => void
  onDeleteHistory: (id: string) => void
}) {
  return (
    <TabsContent value="jobs" className="space-y-8">
      <LiveTransferList
        items={liveTransfers}
        initialLoading={transfers.activeInitialLoading}
        refreshing={transfers.activeRefreshing}
        text={text}
        onOpenDetail={onOpenDetail}
        onDelete={onDeleteActive}
      />

      <HistoryTransferList
        items={transfers.historyTransfers}
        query={transfers.historyQuery}
        pagination={transfers.historyPagination}
        initialLoading={transfers.historyInitialLoading}
        refreshing={transfers.historyRefreshing}
        text={text}
        onChangeFilters={transfers.updateFilters}
        onChangePage={transfers.changePage}
        onChangePageSize={transfers.changePageSize}
        onOpenDetail={onOpenDetail}
        onDelete={onDeleteHistory}
      />
    </TabsContent>
  )
}

function TorrentTab({
  torrentTasks,
  text,
  onOpenDetail,
  onDelete,
}: {
  torrentTasks: ReturnType<typeof useTorrentTaskHistory>
  text: TransferText
  onOpenDetail: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <TabsContent value="torrent">
      <TorrentTaskList
        items={torrentTasks.items}
        query={torrentTasks.query}
        pagination={torrentTasks.pagination}
        initialLoading={torrentTasks.initialLoading}
        refreshing={torrentTasks.refreshing}
        text={text}
        onChangeStatus={torrentTasks.changeStatus}
        onChangePage={torrentTasks.changePage}
        onChangePageSize={torrentTasks.changePageSize}
        onOpenDetail={onOpenDetail}
        onDelete={onDelete}
      />
    </TabsContent>
  )
}

function TransferSheets({
  transfers,
  torrentTasks,
  text,
}: {
  transfers: ReturnType<typeof useTransfers>
  torrentTasks: ReturnType<typeof useTorrentTaskHistory>
  text: TransferText
}) {
  return (
    <>
      <TransferDetailSheet
        open={transfers.detail.open}
        loading={transfers.detail.loading}
        detail={transfers.detail.data}
        text={text}
        onOpenChange={(open) => {
          if (!open) {
            transfers.closeDetail()
          }
        }}
      />

      <TorrentTaskSheet
        open={torrentTasks.detail.open}
        loading={torrentTasks.detail.loading}
        detail={torrentTasks.detail.data}
        text={text}
        onOpenChange={(open) => {
          if (!open) {
            torrentTasks.closeDetail()
          }
        }}
      />
    </>
  )
}

export default function TransfersPage() {
  const [activeTab, setActiveTab] = useState("jobs")
  const { locale } = useI18n()
  const text = transferMessages[locale]
  const { toast } = useToast()
  const transfers = useTransfers()
  const torrentTasks = useTorrentTaskHistory()
  const uploadTasks = useAtomValue(uploadTasksAtom)
  const liveTransfers = mergeActiveTransfersWithUploadTasks(transfers.activeTransfers, uploadTasks)

  const showErrorToast = (title: string, error: unknown) => {
    toast({
      variant: "destructive",
      title,
      description: error instanceof Error ? error.message : text.retry,
    })
  }

  const openDetail = async (transferId: string) => {
    try {
      await transfers.openDetail(transferId)
    } catch (error) {
      showErrorToast(text.detailTitle, error)
    }
  }

  const deleteHistory = async (transferId: string) => {
    try {
      await transfers.removeHistoryItem(transferId)
    } catch (error) {
      showErrorToast(text.deleteHistory, error)
    }
  }

  const deleteActive = async (transferId: string) => {
    try {
      await transfers.removeActiveItem(transferId)
    } catch (error) {
      showErrorToast(text.deleteHistory, error)
    }
  }

  const openTorrentDetail = async (taskId: string) => {
    try {
      await torrentTasks.openDetail(taskId)
    } catch (error) {
      showErrorToast(text.torrentDetailTitle, new Error(torrentTasks.readError(error, text.retry)))
    }
  }

  const deleteTorrentHistory = async (taskId: string) => {
    try {
      const warnings = await torrentTasks.removeTask(taskId)
      if (warnings.length > 0) {
        toast({
          variant: "destructive",
          title: text.deleteTorrentTask,
          description: warnings.join("；"),
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: text.deleteTorrentTask,
        description: torrentTasks.readError(error, text.retry),
      })
    }
  }

  return (
    <main className="relative mt-24 px-3 pb-8 md:mt-28 md:px-4 lg:px-5">
      <motion.div
        variants={CONTAINER_VARIANTS}
        initial="hidden"
        animate="visible"
        className="mx-auto flex w-full max-w-7xl flex-col gap-8 md:gap-10"
      >
        <I18nFade locale={locale}>
          <motion.div variants={ITEM_VARIANTS}>
            <TransferHero
              activeTransfers={transfers.activeTransfers}
              historyTransfers={transfers.historyTransfers}
              streamStatus={transfers.streamStatus}
              text={text}
            />
          </motion.div>
        </I18nFade>

        <I18nFade locale={locale}>
          <motion.div variants={ITEM_VARIANTS}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-6">
              <TabsHeader text={text} />
              <JobsTab
                transfers={transfers}
                liveTransfers={liveTransfers}
                text={text}
                onOpenDetail={(id) => void openDetail(id)}
                onDeleteActive={(id) => void deleteActive(id)}
                onDeleteHistory={(id) => void deleteHistory(id)}
              />
              <TorrentTab
                torrentTasks={torrentTasks}
                text={text}
                onOpenDetail={(id) => void openTorrentDetail(id)}
                onDelete={(id) => void deleteTorrentHistory(id)}
              />
            </Tabs>
          </motion.div>
        </I18nFade>
      </motion.div>

      <TransferSheets transfers={transfers} torrentTasks={torrentTasks} text={text} />
    </main>
  )
}
