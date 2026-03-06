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

const SECTION_TRANSITION = { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const }

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
    <main className="relative mt-24 px-3 pb-6 md:mt-28 md:px-4 lg:px-5">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <I18nFade locale={locale}>
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={SECTION_TRANSITION}>
            <TransferHero
              activeTransfers={transfers.activeTransfers}
              historyTransfers={transfers.historyTransfers}
              streamStatus={transfers.streamStatus}
              text={text}
            />
          </motion.div>
        </I18nFade>

        <I18nFade locale={locale}>
          <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SECTION_TRANSITION, delay: 0.04 }}>
            <LiveTransferList
              items={transfers.activeTransfers}
              loading={transfers.activeLoading}
              text={text}
              onOpenDetail={(id) => void openDetail(id)}
            />
          </motion.div>
        </I18nFade>

        <I18nFade locale={locale}>
          <motion.div initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SECTION_TRANSITION, delay: 0.08 }}>
            <HistoryTransferList
              items={transfers.historyTransfers}
              query={transfers.historyQuery}
              pagination={transfers.historyPagination}
              loading={transfers.historyLoading}
              text={text}
              onChangeFilters={transfers.updateFilters}
              onChangePage={transfers.changePage}
              onChangePageSize={transfers.changePageSize}
              onOpenDetail={(id) => void openDetail(id)}
              onDelete={(id) => void deleteHistory(id)}
            />
          </motion.div>
        </I18nFade>
      </div>

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
