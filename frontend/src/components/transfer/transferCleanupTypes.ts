/**
 * 传输中心清理/批量操作类型。
 *
 * 设计目标：
 * - 统一清理入口：管理菜单与危险确认弹窗都只需要透出一个回调
 * - 明确可扩展：后续新增清理动作只需要扩展该 union
 */
export type TransferCleanupAction =
  | { type: 'clear-completed-uploads' }
  | { type: 'clear-all-uploads' }
  | { type: 'clear-finished-downloads' }
  | { type: 'clear-history' }
  | { type: 'clear-history-by-days'; days: number }
  | { type: 'remove-history-item'; id: string }
  | { type: 'delete-torrent-task'; id: string };
