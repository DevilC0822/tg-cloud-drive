import { useMemo, useState } from 'react';
import { Check, Download, ShieldAlert, Trash2, Upload, ChevronDown, Clock3, AlertTriangle } from 'lucide-react';
import { Dropdown as HeroDropdown, Label as HeroLabel, Separator as HeroSeparator } from '@heroui/react';
import { NumberFieldInput } from '@/components/ui/NumberFieldInput';
import { ActionTextButton } from '@/components/ui/HeroActionPrimitives';
import type { TransferCleanupAction } from '@/components/transfer/transferCleanupTypes';

export interface CleanupMenuProps {
  completedUploadCount: number;
  uploadTaskCount: number;
  endedDownloadCount: number;
  historyTotalCount: number;
  onCleanup: (action: TransferCleanupAction) => void;
}

function parseCleanupDays(raw: string, fallback: number): number {
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(3650, Math.max(1, Math.floor(parsed)));
}

/**
 * 「管理」下拉菜单：统一收纳清理/批量操作
 */
export function CleanupMenu({
  completedUploadCount,
  uploadTaskCount,
  endedDownloadCount,
  historyTotalCount,
  onCleanup,
}: CleanupMenuProps) {
  const [cleanupDaysInput, setCleanupDaysInput] = useState('7');

  const hasAnyQuickActions = useMemo(() => {
    return completedUploadCount > 0 || endedDownloadCount > 0 || uploadTaskCount > 0;
  }, [completedUploadCount, endedDownloadCount, uploadTaskCount]);

  return (
    <HeroDropdown>
      <HeroDropdown.Trigger>
        <ActionTextButton
          density="cozy"
          trailingIcon={<ChevronDown className="h-4 w-4" />}
          className="h-10! px-3! py-0! text-sm"
        >
          管理
        </ActionTextButton>
      </HeroDropdown.Trigger>
      <HeroDropdown.Popover
        placement="bottom end"
        className="popover-warm z-50 w-[min(340px,calc(100svw-24px))] !max-w-[calc(100svw-24px)] overflow-hidden rounded-3xl p-0"
      >
        <div className="border-b border-[var(--theme-primary-a16)] bg-[var(--theme-primary-a08)] px-4 py-3 dark:border-white/6 dark:bg-white/4">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            <ShieldAlert className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
            管理操作
          </div>
          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">清理与批量操作统一入口。</div>
        </div>

        {hasAnyQuickActions ? (
          <HeroDropdown.Menu
            aria-label="传输中心快捷操作"
            className="p-2"
            onAction={(key) => {
              const id = String(key);
              if (id === 'clear-completed-uploads') onCleanup({ type: 'clear-completed-uploads' });
              if (id === 'clear-all-uploads') onCleanup({ type: 'clear-all-uploads' });
              if (id === 'clear-finished-downloads') onCleanup({ type: 'clear-finished-downloads' });
            }}
          >
            <HeroDropdown.Item
              id="clear-completed-uploads"
              textValue="清理已完成上传"
              isDisabled={completedUploadCount === 0}
            >
              <Check className="h-4 w-4 text-current" />
              <HeroLabel>清理已完成上传</HeroLabel>
            </HeroDropdown.Item>

            <HeroDropdown.Item
              id="clear-finished-downloads"
              textValue="清理已结束下载"
              isDisabled={endedDownloadCount === 0}
            >
              <Download className="h-4 w-4 text-current" />
              <HeroLabel>清理已结束下载</HeroLabel>
            </HeroDropdown.Item>

            <HeroDropdown.Item
              id="clear-all-uploads"
              textValue="清空上传队列"
              variant="danger"
              isDisabled={uploadTaskCount === 0}
            >
              <Upload className="h-4 w-4 text-current" />
              <HeroLabel>清空上传队列</HeroLabel>
            </HeroDropdown.Item>
          </HeroDropdown.Menu>
        ) : (
          <div className="px-4 py-5 text-sm text-neutral-500 dark:text-neutral-400">暂无可清理的上传/下载队列。</div>
        )}

        <HeroSeparator />

        <div className="px-4 py-4">
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-200">
            <Clock3 className="h-3.5 w-3.5" />
            历史清理
          </div>
          <div className="mt-3 flex items-center gap-2">
            <NumberFieldInput
              min={1}
              max={3650}
              value={cleanupDaysInput}
              onValueChange={setCleanupDaysInput}
              placeholder="天数"
              className="w-[128px]"
            />
            <ActionTextButton
              tone="warning"
              density="cozy"
              isDisabled={historyTotalCount === 0}
              onPress={() => onCleanup({ type: 'clear-history-by-days', days: parseCleanupDays(cleanupDaysInput, 7) })}
              className="h-10! px-3! py-0! text-sm"
            >
              清理早于 N 天
            </ActionTextButton>
          </div>
          <div className="mt-2 text-[11px] leading-4 text-neutral-500 dark:text-neutral-400">
            仅影响文件传输历史，不会删除真实文件内容。
          </div>

          <div className="mt-4 rounded-2xl border border-red-200/70 bg-red-50/70 p-3 dark:border-red-900/40 dark:bg-red-900/15">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-red-600 dark:text-red-300" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-red-700 dark:text-red-200">危险操作</div>
                <div className="mt-0.5 text-[11px] leading-4 text-red-700/80 dark:text-red-300/80">
                  清空后不可恢复，请谨慎使用。
                </div>
              </div>
            </div>
            <div className="mt-3">
              <ActionTextButton
                tone="danger"
                density="cozy"
                isDisabled={historyTotalCount === 0}
                onPress={() => onCleanup({ type: 'clear-history' })}
                leadingIcon={<Trash2 className="h-4 w-4" />}
                className="h-10! w-full justify-center px-3! py-0! text-sm"
              >
                清空全部历史
              </ActionTextButton>
            </div>
          </div>
        </div>
      </HeroDropdown.Popover>
    </HeroDropdown>
  );
}
