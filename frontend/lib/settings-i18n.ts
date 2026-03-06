import type { Locale } from "@/lib/i18n"

export interface SettingsText {
  title: string
  subtitle: string
  statusLoaded: string
  statusLoading: string
  reload: string
  tabTransfer: string
  tabStorage: string
  tabSessions: string
  tabTorrent: string
  tabVault: string
  tabService: string
  saveRuntime: string
  saveService: string
  saving: string
  transferUploadConcurrency: string
  transferDownloadConcurrency: string
  transferReservedDiskGb: string
  transferChunkSizeMb: string
  sessionsTtlHours: string
  sessionsCleanupMinutes: string
  storageThumbMaxMb: string
  storageThumbTtlHours: string
  storageThumbConcurrency: string
  torrentPassword: string
  torrentPasswordPlaceholder: string
  torrentDeleteMode: string
  torrentModeNever: string
  torrentModeImmediate: string
  torrentModeFixed: string
  torrentModeRandom: string
  torrentFixedMinutes: string
  torrentRandomMin: string
  torrentRandomMax: string
  vaultEnabled: string
  vaultEnabledYes: string
  vaultEnabledNo: string
  vaultSessionMinutes: string
  vaultPassword: string
  adminPassword: string
  serviceMethod: string
  serviceBotToken: string
  serviceChatId: string
  serviceApiId: string
  serviceApiHash: string
  serviceApiBaseUrl: string
  showBotToken: string
  hideBotToken: string
  showApiHash: string
  hideApiHash: string
  serviceOfficial: string
  serviceSelfHosted: string
  serviceLastResult: string
  serviceRolledBack: string
  loadFailed: string
  saveFailed: string
  saveSuccess: string
  serviceSaveSuccess: string
  serviceSaveRolledBack: string
  requiredField: (label: string) => string
  rangeError: (label: string, min: number, max: number) => string
  positiveInteger: (label: string) => string
  nonNegative: (label: string) => string
}

export const settingsMessages: Record<Locale, SettingsText> = {
  en: {
    title: "Settings",
    subtitle: "Manage runtime configuration, vault policy and service access in one place.",
    statusLoaded: "Config loaded",
    statusLoading: "Loading config",
    reload: "Reload",
    tabTransfer: "Transfer",
    tabStorage: "Storage",
    tabSessions: "Sessions",
    tabTorrent: "Torrent",
    tabVault: "Vault",
    tabService: "Service",
    saveRuntime: "Save Runtime Settings",
    saveService: "Save Service Access",
    saving: "Saving...",
    transferUploadConcurrency: "Upload Concurrency",
    transferDownloadConcurrency: "Download Concurrency",
    transferReservedDiskGb: "Reserved Disk (GB)",
    transferChunkSizeMb: "Chunk Size (MB, read-only)",
    sessionsTtlHours: "Upload Session TTL (hours)",
    sessionsCleanupMinutes: "Upload Session Cleanup Interval (minutes)",
    storageThumbMaxMb: "Thumbnail Cache Max (MB)",
    storageThumbTtlHours: "Thumbnail Cache TTL (hours)",
    storageThumbConcurrency: "Thumbnail Generation Concurrency",
    torrentPassword: "qBittorrent Password (optional)",
    torrentPasswordPlaceholder: "Leave empty to keep unchanged",
    torrentDeleteMode: "Source Delete Mode",
    torrentModeNever: "Never",
    torrentModeImmediate: "Immediate",
    torrentModeFixed: "Fixed",
    torrentModeRandom: "Random",
    torrentFixedMinutes: "Fixed Minutes",
    torrentRandomMin: "Random Min Minutes",
    torrentRandomMax: "Random Max Minutes",
    vaultEnabled: "Vault Password",
    vaultEnabledYes: "Enabled",
    vaultEnabledNo: "Disabled",
    vaultSessionMinutes: "Vault Session TTL (minutes)",
    vaultPassword: "New Vault Password",
    adminPassword: "Admin Password (required when changing vault password)",
    serviceMethod: "Access Method",
    serviceBotToken: "Bot Token",
    serviceChatId: "Storage Chat ID",
    serviceApiId: "API ID",
    serviceApiHash: "API Hash",
    serviceApiBaseUrl: "Bot API Base URL",
    showBotToken: "Show Bot Token",
    hideBotToken: "Hide Bot Token",
    showApiHash: "Show API Hash",
    hideApiHash: "Hide API Hash",
    serviceOfficial: "Official Bot API",
    serviceSelfHosted: "Self-hosted Bot API",
    serviceLastResult: "Last switch result",
    serviceRolledBack: "Switch failed and rolled back",
    loadFailed: "Failed to load settings",
    saveFailed: "Failed to save settings",
    saveSuccess: "Runtime settings saved",
    serviceSaveSuccess: "Service access updated",
    serviceSaveRolledBack: "Switch failed and rolled back",
    requiredField: (label) => `${label} is required`,
    rangeError: (label, min, max) => `${label} must be between ${min} and ${max}`,
    positiveInteger: (label) => `${label} must be a positive integer`,
    nonNegative: (label) => `${label} must be non-negative`,
  },
  zh: {
    title: "设置",
    subtitle: "在一个页面统一管理运行参数、密码箱策略与服务接入。",
    statusLoaded: "配置已加载",
    statusLoading: "正在加载配置",
    reload: "重新加载",
    tabTransfer: "传输",
    tabStorage: "存储",
    tabSessions: "会话",
    tabTorrent: "种子",
    tabVault: "密码箱",
    tabService: "服务接入",
    saveRuntime: "保存运行设置",
    saveService: "保存服务接入",
    saving: "保存中...",
    transferUploadConcurrency: "上传并发",
    transferDownloadConcurrency: "下载并发",
    transferReservedDiskGb: "预留磁盘空间（GB）",
    transferChunkSizeMb: "分片大小（MB，只读）",
    sessionsTtlHours: "上传会话 TTL（小时）",
    sessionsCleanupMinutes: "上传会话清理周期（分钟）",
    storageThumbMaxMb: "缩略图缓存上限（MB）",
    storageThumbTtlHours: "缩略图缓存 TTL（小时）",
    storageThumbConcurrency: "缩略图生成并发",
    torrentPassword: "qBittorrent 密码（可选）",
    torrentPasswordPlaceholder: "留空表示不修改",
    torrentDeleteMode: "源文件删除策略",
    torrentModeNever: "不删除",
    torrentModeImmediate: "立即",
    torrentModeFixed: "固定延迟",
    torrentModeRandom: "随机延迟",
    torrentFixedMinutes: "固定分钟数",
    torrentRandomMin: "随机最小分钟数",
    torrentRandomMax: "随机最大分钟数",
    vaultEnabled: "密码箱状态",
    vaultEnabledYes: "已启用",
    vaultEnabledNo: "未启用",
    vaultSessionMinutes: "密码箱会话有效期（分钟）",
    vaultPassword: "新密码箱密码",
    adminPassword: "管理员密码（修改密码箱密码时必填）",
    serviceMethod: "接入方式",
    serviceBotToken: "Bot Token",
    serviceChatId: "存储 Chat ID",
    serviceApiId: "API ID",
    serviceApiHash: "API Hash",
    serviceApiBaseUrl: "Bot API Base URL",
    showBotToken: "显示 Bot Token",
    hideBotToken: "隐藏 Bot Token",
    showApiHash: "显示 API Hash",
    hideApiHash: "隐藏 API Hash",
    serviceOfficial: "官方 Bot API",
    serviceSelfHosted: "自建 Bot API",
    serviceLastResult: "最近一次切换结果",
    serviceRolledBack: "切换失败，已自动回滚",
    loadFailed: "加载设置失败",
    saveFailed: "保存设置失败",
    saveSuccess: "运行设置已保存",
    serviceSaveSuccess: "服务接入已更新",
    serviceSaveRolledBack: "切换失败并已回滚",
    requiredField: (label) => `${label} 不能为空`,
    rangeError: (label, min, max) => `${label} 范围应为 ${min} ~ ${max}`,
    positiveInteger: (label) => `${label} 必须是正整数`,
    nonNegative: (label) => `${label} 不能为负数`,
  },
}
