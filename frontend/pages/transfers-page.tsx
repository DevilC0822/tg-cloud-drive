import { motion } from "framer-motion"
import { I18nFade } from "@/components/i18n-fade"
import { useI18n } from "@/components/i18n-provider"
import { HistoryTransferList } from "@/components/transfers/history-transfer-list"
import { LiveTransferList } from "@/components/transfers/live-transfer-list"
import { TransferDetailSheet } from "@/components/transfers/transfer-detail-sheet"
import { TransferHero } from "@/components/transfers/transfer-hero"
import { useTransfers } from "@/hooks/use-transfers"
import { useToast } from "@/hooks/use-toast"
import { transferMessages } from "@/lib/i18n"

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

export default function TransfersPage() {
  const { locale } = useI18n()
  const text = transferMessages[locale]
  const { toast } = useToast()
  const transfers = useTransfers()

  const openDetail = async (transferId: string) => {
    try {
      await transfers.openDetail(transferId)
    } catch (error) {
      toast({
        variant: "destructive",
        title: text.detailTitle,
        description: error instanceof Error ? error.message : text.retry,
      })
    }
  }

  const deleteHistory = async (transferId: string) => {
    try {
      await transfers.removeHistoryItem(transferId)
    } catch (error) {
      toast({
        variant: "destructive",
        title: text.deleteHistory,
        description: error instanceof Error ? error.message : text.retry,
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
            <LiveTransferList
              items={transfers.activeTransfers}
              initialLoading={transfers.activeInitialLoading}
              refreshing={transfers.activeRefreshing}
              text={text}
              onOpenDetail={(id) => void openDetail(id)}
            />
          </motion.div>
        </I18nFade>

        <I18nFade locale={locale}>
          <motion.div variants={ITEM_VARIANTS}>
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
              onOpenDetail={(id) => void openDetail(id)}
              onDelete={(id) => void deleteHistory(id)}
            />
          </motion.div>
        </I18nFade>
      </motion.div>

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
    </main>
  )
}
