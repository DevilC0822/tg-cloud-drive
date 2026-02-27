import { useMemo } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { ActionStatusPill } from '@/components/ui/HeroActionPrimitives';
import { CleanupMenu, type CleanupMenuProps } from '@/components/transfer/CleanupMenu';
import { TransferSearchField } from '@/components/transfer/TransferSearchField';

export interface TransferHeaderProps extends CleanupMenuProps {
  activeCount: number;
  issueCount: number;
  query: string;
  onQueryChange: (next: string) => void;
  onJumpToActive: () => void;
  onJumpToAttention: () => void;
}

/**
 * 传输中心页头：标题 + 内联统计 + 全局搜索 + 管理菜单
 */
export function TransferHeader({
  activeCount,
  issueCount,
  query,
  onQueryChange,
  onJumpToActive,
  onJumpToAttention,
  completedUploadCount,
  uploadTaskCount,
  endedDownloadCount,
  historyTotalCount,
  onCleanup,
}: TransferHeaderProps) {
  const issueTone = useMemo(() => {
    if (issueCount > 0) return 'warning' as const;
    return 'success' as const;
  }, [issueCount]);

  return (
    <section className="px-3 py-3 md:px-5 md:py-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 md:gap-x-3">
            <h1 className="inline-flex items-center gap-2 text-base font-semibold text-neutral-900 md:text-lg dark:text-neutral-100">
              <ArrowLeftRight className="h-4 w-4 text-neutral-500 md:h-5 md:w-5 dark:text-neutral-400" />
              传输中心
            </h1>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onJumpToActive}
                className="cursor-pointer rounded-full p-0.5 focus-visible:ring-2 focus-visible:ring-[var(--theme-primary-a55)]"
              >
                <ActionStatusPill tone="brand">进行中 {activeCount}</ActionStatusPill>
              </button>

              <button
                type="button"
                onClick={onJumpToAttention}
                disabled={issueCount === 0}
                className={`rounded-full p-0.5 focus-visible:ring-2 focus-visible:ring-[var(--theme-primary-a55)] ${
                  issueCount === 0 ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                }`}
              >
                <ActionStatusPill tone={issueTone}>
                  {issueCount > 0 ? `待处理 ${issueCount}` : '暂无待处理'}
                </ActionStatusPill>
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <TransferSearchField
            value={query}
            onValueChange={onQueryChange}
            className="min-w-0 flex-1 md:w-[360px] md:flex-none"
          />
          <CleanupMenu
            completedUploadCount={completedUploadCount}
            uploadTaskCount={uploadTaskCount}
            endedDownloadCount={endedDownloadCount}
            historyTotalCount={historyTotalCount}
            onCleanup={onCleanup}
          />
        </div>
      </div>
    </section>
  );
}
