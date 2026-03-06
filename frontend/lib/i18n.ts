export type Locale = "en" | "zh"

export const DEFAULT_LOCALE: Locale = "en"
export const LOCALE_STORAGE_KEY = "nexus-locale"

export const headerMessages: Record<
  Locale,
  {
    dashboard: string
    files: string
    transfers: string
    settings: string
    shared: string
    pricing: string
    signIn: string
    signOut: string
    language: string
    english: string
    chinese: string
    profile: string
    profileRole: string
    profileStatus: string
    profileStats: string
    profileService: string
    refreshStats: string
    serviceOfficial: string
    serviceSelfHosted: string
    loadingProfile: string
    profileLoadError: string
  }
> = {
  en: {
    dashboard: "Dashboard",
    files: "Files",
    transfers: "Transfers",
    settings: "Settings",
    shared: "Shared",
    pricing: "Pricing",
    signIn: "Sign In",
    signOut: "Log Out",
    language: "Language",
    english: "English",
    chinese: "Chinese",
    profile: "Profile",
    profileRole: "Administrator",
    profileStatus: "Active session",
    profileStats: "Storage Overview",
    profileService: "Service Access",
    refreshStats: "Refresh",
    serviceOfficial: "Official",
    serviceSelfHosted: "Self-hosted",
    loadingProfile: "Loading profile...",
    profileLoadError: "Failed to load profile data",
  },
  zh: {
    dashboard: "仪表盘",
    files: "文件",
    transfers: "传输",
    settings: "设置",
    shared: "共享",
    pricing: "定价",
    signIn: "登录",
    signOut: "退出登录",
    language: "语言",
    english: "英语",
    chinese: "中文",
    profile: "个人信息",
    profileRole: "管理员",
    profileStatus: "当前会话",
    profileStats: "存储概览",
    profileService: "服务接入",
    refreshStats: "刷新",
    serviceOfficial: "官方",
    serviceSelfHosted: "自建",
    loadingProfile: "正在加载资料...",
    profileLoadError: "加载资料失败",
  },
}

export const authMessages: Record<
  Locale,
  {
    title: string
    description: string
    descriptionWithPath: (path: string) => string
    passwordPlaceholder: string
    submit: string
    submitting: string
    cancel: string
    checking: string
    requiredTitle: string
    requiredDescription: string
  }
> = {
  en: {
    title: "Admin Sign In",
    description: "Please enter the admin password to continue.",
    descriptionWithPath: (path) => `Please sign in to continue to ${path}.`,
    passwordPlaceholder: "Admin password",
    submit: "Sign In",
    submitting: "Signing In...",
    cancel: "Cancel",
    checking: "Checking authentication...",
    requiredTitle: "Sign in required",
    requiredDescription: "This page is protected. Please complete sign-in verification.",
  },
  zh: {
    title: "管理员登录",
    description: "请输入管理员密码后继续访问。",
    descriptionWithPath: (path) => `访问 ${path} 需要先完成登录验证。`,
    passwordPlaceholder: "管理员密码",
    submit: "登录",
    submitting: "登录中...",
    cancel: "取消",
    checking: "正在校验登录状态...",
    requiredTitle: "需要登录",
    requiredDescription: "当前页面受保护，请先完成登录验证。",
  },
}

export const filesMessages: Record<
  Locale,
  {
    home: string
    filesTitle: string
    allFiles: string
    sharedFiles: string
    starredFiles: string
    itemCount: (count: number) => string
    emptyTitle: string
    emptyDescription: string
    emptySearchDescription: (query: string) => string
    searchPlaceholder: string
    uploadButton: string
    sortBy: string
    sortName: string
    sortDate: string
    sortSize: string
    sortType: string
    viewGrid: string
    viewList: string
    sectionAll: string
    sectionShared: string
    sectionStarred: string
    sectionVault: string
    loading: string
    failedLoad: string
    retry: string
    paginationPrev: string
    paginationNext: string
    pageSize: string
    listName: string
    listSize: string
    listUpdated: string
    selectedCount: (count: number) => string
    actionOpen: string
    actionPreview: string
    actionDownload: string
    actionShare: string
    actionUnshare: string
    actionRename: string
    actionMove: string
    actionVaultIn: string
    actionVaultOut: string
    actionInfo: string
    actionDelete: string
    actionStar: string
    actionUnstar: string
    actionDeleteSelected: (count: number) => string
    renameTitle: string
    renamePlaceholder: string
    moveTitle: string
    moveDescription: (count: number) => string
    moveDestination: string
    moveRoot: string
    deleteTitle: string
    deleteDescription: (count: number) => string
    infoTitle: string
    cancel: string
    confirm: string
    copiedShareLink: string
    operationFailed: string
    operationUnsupportedFolderShare: string
    operationUnsupportedFolderDownload: string
    operationSelectionShareDisabled: string
    statusVaulted: string
    statusUnvaulted: string
    statusDeleted: string
    statusMoved: string
    statusRenamed: string
    statusStarred: string
    statusUnstarred: string
    statusShared: string
    statusUnshared: string
    newFolderButton: string
    newFolderTitle: string
    newFolderPlaceholder: string
    newFolderDescription: string
    newFolderSuccess: string
    newFolderDisabledInVault: string
    vaultFiles: string
    vaultStatusLoading: string
    vaultNotEnabledTitle: string
    vaultNotEnabledDesc: string
    vaultLockedTitle: string
    vaultLockedDesc: string
    vaultPasswordLabel: string
    vaultPasswordRequired: string
    vaultUnlockAction: string
    vaultUnlocking: string
    vaultUnlockSuccess: string
    vaultLockAction: string
    vaultLockSuccess: string
    vaultUnlockedHint: string
    vaultExpiresAt: string
    vaultProgressTitleIn: string
    vaultProgressTitleOut: string
    vaultProgressTitle: string
    vaultProgressFolder: (index: number, total: number, name: string) => string
    vaultProgressTargetsLabel: (done: number, total: number) => string
    vaultProgressOverallLabel: string
    vaultProgressSucceededTargetsLabel: string
    vaultProgressFailedTargetsLabel: string
    vaultProgressCurrentTargetLabel: string
    vaultProgressNoCurrentTarget: string
    vaultProgressFailuresTitle: string
    vaultProgressInit: string
    vaultProgressProcessing: string
    vaultProgressFinalizing: string
    vaultProgressDone: string
    vaultProgressError: string
    vaultProgressProcessedLabel: string
    vaultProgressTotalItemsLabel: string
    vaultProgressAppliedLabel: string
    vaultProgressSkippedLabel: string
    vaultProgressFailedLabel: string
    vaultProgressClose: string
  }
> = {
  en: {
    home: "Home",
    filesTitle: "Files",
    allFiles: "All Files",
    sharedFiles: "Shared",
    starredFiles: "Starred",
    itemCount: (count) => `${count} items`,
    emptyTitle: "No files found",
    emptyDescription: "This folder is empty. Upload something to get started.",
    emptySearchDescription: (query) => `No files matched "${query}".`,
    searchPlaceholder: "Search files...",
    uploadButton: "Upload",
    sortBy: "Sort",
    sortName: "Name",
    sortDate: "Date",
    sortSize: "Size",
    sortType: "Type",
    viewGrid: "Grid",
    viewList: "List",
    sectionAll: "All",
    sectionShared: "Shared",
    sectionStarred: "Starred",
    sectionVault: "Vault",
    loading: "Loading files...",
    failedLoad: "Failed to load files",
    retry: "Retry",
    paginationPrev: "Previous",
    paginationNext: "Next",
    pageSize: "Page size",
    listName: "Name",
    listSize: "Size",
    listUpdated: "Updated",
    selectedCount: (count) => `${count} selected`,
    actionOpen: "Open",
    actionPreview: "Preview",
    actionDownload: "Download",
    actionShare: "Share",
    actionUnshare: "Unshare",
    actionRename: "Rename",
    actionMove: "Move",
    actionVaultIn: "Move to Vault",
    actionVaultOut: "Remove from Vault",
    actionInfo: "Details",
    actionDelete: "Delete",
    actionStar: "Star",
    actionUnstar: "Unstar",
    actionDeleteSelected: (count) => `Delete Selected (${count})`,
    renameTitle: "Rename",
    renamePlaceholder: "Enter new name",
    moveTitle: "Move Files",
    moveDescription: (count) => `Move ${count} item${count > 1 ? "s" : ""} to another folder.`,
    moveDestination: "Destination",
    moveRoot: "Root",
    deleteTitle: "Delete files",
    deleteDescription: (count) => `This action will permanently delete ${count} item${count > 1 ? "s" : ""}.`,
    infoTitle: "File Details",
    cancel: "Cancel",
    confirm: "Confirm",
    copiedShareLink: "Share link copied to clipboard",
    operationFailed: "Operation failed",
    operationUnsupportedFolderShare: "Folders cannot be shared",
    operationUnsupportedFolderDownload: "Folders cannot be downloaded",
    operationSelectionShareDisabled: "Share is unavailable for multi-selection",
    statusVaulted: "Moved to vault",
    statusUnvaulted: "Removed from vault",
    statusDeleted: "Deleted",
    statusMoved: "Moved",
    statusRenamed: "Renamed",
    statusStarred: "Added to starred",
    statusUnstarred: "Removed from starred",
    statusShared: "Sharing enabled",
    statusUnshared: "Sharing disabled",
    newFolderButton: "New Folder",
    newFolderTitle: "Create Folder",
    newFolderPlaceholder: "Enter folder name",
    newFolderDescription: "The new folder will be created in the current directory.",
    newFolderSuccess: "Folder created",
    newFolderDisabledInVault: "Switch back to Files view before creating folders",
    vaultFiles: "Vault Files",
    vaultStatusLoading: "Checking vault status...",
    vaultNotEnabledTitle: "Vault is not enabled",
    vaultNotEnabledDesc: "Set a vault password in Settings first, then reopen this tab.",
    vaultLockedTitle: "Vault is locked",
    vaultLockedDesc: "Enter your vault password to view protected files.",
    vaultPasswordLabel: "Vault password",
    vaultPasswordRequired: "Please enter vault password",
    vaultUnlockAction: "Unlock",
    vaultUnlocking: "Unlocking...",
    vaultUnlockSuccess: "Vault unlocked",
    vaultLockAction: "Lock now",
    vaultLockSuccess: "Vault locked",
    vaultUnlockedHint: "Showing files currently stored in vault.",
    vaultExpiresAt: "Session expires at",
    vaultProgressTitleIn: "Moving items to vault",
    vaultProgressTitleOut: "Removing items from vault",
    vaultProgressTitle: "Moving folder to vault",
    vaultProgressFolder: (index, total, name) => `Folder ${index}/${Math.max(total, 1)}: ${name}`,
    vaultProgressTargetsLabel: (done, total) => `Targets ${done}/${Math.max(total, 1)}`,
    vaultProgressOverallLabel: "Overall progress",
    vaultProgressSucceededTargetsLabel: "Succeeded targets",
    vaultProgressFailedTargetsLabel: "Failed targets",
    vaultProgressCurrentTargetLabel: "Current target",
    vaultProgressNoCurrentTarget: "Waiting for task...",
    vaultProgressFailuresTitle: "Failed targets",
    vaultProgressInit: "Scanning items...",
    vaultProgressProcessing: "Applying spoiler protection...",
    vaultProgressFinalizing: "Finalizing vault status...",
    vaultProgressDone: "Completed",
    vaultProgressError: "Failed",
    vaultProgressProcessedLabel: "Processed files",
    vaultProgressTotalItemsLabel: "Total items in folder",
    vaultProgressAppliedLabel: "Applied",
    vaultProgressSkippedLabel: "Skipped",
    vaultProgressFailedLabel: "Failed",
    vaultProgressClose: "Close",
  },
  zh: {
    home: "主页",
    filesTitle: "文件",
    allFiles: "所有文件",
    sharedFiles: "共享文件",
    starredFiles: "收藏文件",
    itemCount: (count) => `${count} 个项目`,
    emptyTitle: "没有找到文件",
    emptyDescription: "当前目录为空，上传一些内容开始使用吧。",
    emptySearchDescription: (query) => `没有找到与“${query}”匹配的文件。`,
    searchPlaceholder: "搜索文件...",
    uploadButton: "上传",
    sortBy: "排序",
    sortName: "名称",
    sortDate: "修改时间",
    sortSize: "大小",
    sortType: "类型",
    viewGrid: "网格",
    viewList: "列表",
    sectionAll: "全部",
    sectionShared: "共享",
    sectionStarred: "收藏",
    sectionVault: "密码箱",
    loading: "正在加载文件...",
    failedLoad: "加载文件失败",
    retry: "重试",
    paginationPrev: "上一页",
    paginationNext: "下一页",
    pageSize: "每页数量",
    listName: "名称",
    listSize: "大小",
    listUpdated: "修改时间",
    selectedCount: (count) => `已选 ${count} 项`,
    actionOpen: "打开",
    actionPreview: "预览",
    actionDownload: "下载",
    actionShare: "分享",
    actionUnshare: "取消分享",
    actionRename: "重命名",
    actionMove: "移动",
    actionVaultIn: "移入密码箱",
    actionVaultOut: "移出密码箱",
    actionInfo: "详情",
    actionDelete: "删除",
    actionStar: "收藏",
    actionUnstar: "取消收藏",
    actionDeleteSelected: (count) => `删除选中（${count}）`,
    renameTitle: "重命名",
    renamePlaceholder: "输入新名称",
    moveTitle: "移动文件",
    moveDescription: (count) => `将 ${count} 个项目移动到其他目录。`,
    moveDestination: "目标目录",
    moveRoot: "根目录",
    deleteTitle: "删除文件",
    deleteDescription: (count) => `该操作会永久删除 ${count} 个项目，且不可恢复。`,
    infoTitle: "文件详情",
    cancel: "取消",
    confirm: "确认",
    copiedShareLink: "分享链接已复制到剪贴板",
    operationFailed: "操作失败",
    operationUnsupportedFolderShare: "文件夹暂不支持分享",
    operationUnsupportedFolderDownload: "文件夹暂不支持下载",
    operationSelectionShareDisabled: "多选时不能分享",
    statusVaulted: "已移入密码箱",
    statusUnvaulted: "已移出密码箱",
    statusDeleted: "删除成功",
    statusMoved: "移动成功",
    statusRenamed: "重命名成功",
    statusStarred: "已加入收藏",
    statusUnstarred: "已取消收藏",
    statusShared: "已开启分享",
    statusUnshared: "已取消分享",
    newFolderButton: "新建文件夹",
    newFolderTitle: "新建文件夹",
    newFolderPlaceholder: "请输入文件夹名称",
    newFolderDescription: "创建后会出现在当前目录中，可继续重命名或移动。",
    newFolderSuccess: "文件夹创建成功",
    newFolderDisabledInVault: "请先切回普通文件视图再创建文件夹",
    vaultFiles: "密码箱文件",
    vaultStatusLoading: "正在检查密码箱状态...",
    vaultNotEnabledTitle: "密码箱未启用",
    vaultNotEnabledDesc: "请先在设置页配置密码箱密码，然后再访问此视图。",
    vaultLockedTitle: "密码箱已锁定",
    vaultLockedDesc: "输入密码箱密码后继续查看受保护文件。",
    vaultPasswordLabel: "密码箱密码",
    vaultPasswordRequired: "请输入密码箱密码",
    vaultUnlockAction: "解锁",
    vaultUnlocking: "解锁中...",
    vaultUnlockSuccess: "密码箱已解锁",
    vaultLockAction: "立即锁定",
    vaultLockSuccess: "密码箱已锁定",
    vaultUnlockedHint: "当前仅展示已移入密码箱的文件。",
    vaultExpiresAt: "会话有效期至",
    vaultProgressTitleIn: "正在移入密码箱",
    vaultProgressTitleOut: "正在移出密码箱",
    vaultProgressTitle: "正在移入密码箱",
    vaultProgressFolder: (index, total, name) => `目录 ${index}/${Math.max(total, 1)}：${name}`,
    vaultProgressTargetsLabel: (done, total) => `目标 ${done}/${Math.max(total, 1)}`,
    vaultProgressOverallLabel: "整体进度",
    vaultProgressSucceededTargetsLabel: "成功目标",
    vaultProgressFailedTargetsLabel: "失败目标",
    vaultProgressCurrentTargetLabel: "当前目标",
    vaultProgressNoCurrentTarget: "等待任务开始...",
    vaultProgressFailuresTitle: "失败目标",
    vaultProgressInit: "正在扫描目录...",
    vaultProgressProcessing: "正在处理剧透保护...",
    vaultProgressFinalizing: "正在收尾并更新状态...",
    vaultProgressDone: "处理完成",
    vaultProgressError: "处理失败",
    vaultProgressProcessedLabel: "已处理文件",
    vaultProgressTotalItemsLabel: "目录总项目数",
    vaultProgressAppliedLabel: "已应用",
    vaultProgressSkippedLabel: "已跳过",
    vaultProgressFailedLabel: "失败",
    vaultProgressClose: "关闭",
  },
}

export const uploadMessages: Record<
  Locale,
  {
    title: string
    subtitle: string
    viewTransfers: string
    tabLocal: string
    tabTorrent: string
    localDropTitle: string
    localDropHint: string
    localDropActive: string
    torrentUrlLabel: string
    torrentUrlPlaceholder: string
    torrentFileLabel: string
    torrentPreview: string
    torrentCreate: string
    torrentChooseFiles: string
    torrentNoPreview: string
    uploading: string
    uploaded: string
    failed: string
    retry: string
    close: string
    clearCompleted: string
  }
> = {
  en: {
    title: "Upload",
    subtitle: "Upload local files or create torrent tasks",
    viewTransfers: "View transfers",
    tabLocal: "Local Files",
    tabTorrent: "Torrent",
    localDropTitle: "Drop files here",
    localDropHint: "or click to choose files",
    localDropActive: "Release to upload",
    torrentUrlLabel: "Torrent URL",
    torrentUrlPlaceholder: "https://example.com/file.torrent",
    torrentFileLabel: "Torrent file",
    torrentPreview: "Preview",
    torrentCreate: "Create task",
    torrentChooseFiles: "Select files",
    torrentNoPreview: "Preview metadata to choose files",
    uploading: "Uploading",
    uploaded: "Completed",
    failed: "Failed",
    retry: "Retry",
    close: "Close",
    clearCompleted: "Clear completed",
  },
  zh: {
    title: "上传",
    subtitle: "支持本地文件上传与种子任务创建",
    viewTransfers: "查看传输",
    tabLocal: "本地文件",
    tabTorrent: "种子任务",
    localDropTitle: "拖拽文件到此处",
    localDropHint: "或点击选择文件",
    localDropActive: "释放以上传",
    torrentUrlLabel: "种子 URL",
    torrentUrlPlaceholder: "https://example.com/file.torrent",
    torrentFileLabel: "种子文件",
    torrentPreview: "预览",
    torrentCreate: "创建任务",
    torrentChooseFiles: "选择文件",
    torrentNoPreview: "先预览元信息后选择要下载的文件",
    uploading: "上传中",
    uploaded: "已完成",
    failed: "失败",
    retry: "重试",
    close: "关闭",
    clearCompleted: "清除已完成",
  },
}

export const transferMessages: Record<
  Locale,
  {
    title: string
    subtitle: string
    liveTitle: string
    liveSubtitle: string
    historyTitle: string
    historySubtitle: string
    detailTitle: string
    detailSubtitle: string
    streamConnected: string
    streamReconnecting: string
    streamError: string
    summaryActive: string
    summaryFailed: string
    summaryCompleted: string
    summaryActiveValue: (count: number) => string
    summaryFailedValue: (count: number) => string
    summaryCompletedValue: (count: number) => string
    filtersDirection: string
    filtersStatus: string
    filtersSource: string
    filtersSearch: string
    filtersSearchPlaceholder: string
    all: string
    directionUpload: string
    directionDownload: string
    statusRunning: string
    statusCompleted: string
    statusError: string
    statusCanceled: string
    sourceUploadSession: string
    sourceUploadBatch: string
    sourceTorrentTask: string
    sourceDownloadTask: string
    phaseUploadingChunks: string
    phaseFinalizing: string
    phaseDownloading: string
    phaseQueued: string
    phaseTorrentDownloading: string
    phaseAwaitingSelection: string
    phaseTorrentUploading: string
    phaseIdle: string
    emptyLiveTitle: string
    emptyLiveDescription: string
    emptyHistoryTitle: string
    emptyHistoryDescription: string
    openDetail: string
    deleteHistory: string
    loadMore: string
    retry: string
    sessions: string
    sessionDetail: string
    batchDetail: string
    torrentDetail: string
    downloadDetail: string
    uploadedChunks: string
    missingChunks: string
    selectedFiles: string
    trackerHosts: string
    lastError: string
    targetFile: string
    totalSize: string
    itemCount: string
    startedAt: string
    updatedAt: string
    finishedAt: string
    recentItems: string
    uploaded: string
    failed: string
    canceled: string
    noIssues: string
    pageSize: string
    prevPage: string
    nextPage: string
  }
> = {
  en: {
    title: "Transfers",
    subtitle: "Live queue, archive, and drill-down telemetry for uploads, downloads, and torrent jobs.",
    liveTitle: "Live Queue",
    liveSubtitle: "Streaming status from the server. Running jobs stay here until they settle.",
    historyTitle: "History Archive",
    historySubtitle: "Terminal jobs with server-side filters and detail drill-down.",
    detailTitle: "Transfer Detail",
    detailSubtitle: "Source-specific payload, progress context, and recent child items.",
    streamConnected: "Live stream connected",
    streamReconnecting: "Reconnecting stream",
    streamError: "Stream decode error",
    summaryActive: "Running now",
    summaryFailed: "Failed jobs",
    summaryCompleted: "Completed 24h",
    summaryActiveValue: (count) => `${count} active`,
    summaryFailedValue: (count) => `${count} failed`,
    summaryCompletedValue: (count) => `${count} finished`,
    filtersDirection: "Direction",
    filtersStatus: "Status",
    filtersSource: "Source",
    filtersSearch: "Search",
    filtersSearchPlaceholder: "Search by name or source ref",
    all: "All",
    directionUpload: "Upload",
    directionDownload: "Download",
    statusRunning: "Running",
    statusCompleted: "Completed",
    statusError: "Error",
    statusCanceled: "Canceled",
    sourceUploadSession: "Single upload",
    sourceUploadBatch: "Batch upload",
    sourceTorrentTask: "Torrent task",
    sourceDownloadTask: "Download task",
    phaseUploadingChunks: "Uploading chunks",
    phaseFinalizing: "Finalizing",
    phaseDownloading: "Downloading",
    phaseQueued: "Queued",
    phaseTorrentDownloading: "Torrent download",
    phaseAwaitingSelection: "Awaiting selection",
    phaseTorrentUploading: "Torrent upload",
    phaseIdle: "Idle",
    emptyLiveTitle: "No active transfers",
    emptyLiveDescription: "New uploads, downloads, and torrent jobs will appear here in real time.",
    emptyHistoryTitle: "No archived transfers",
    emptyHistoryDescription: "Completed or failed jobs will land here once the server finalizes them.",
    openDetail: "Details",
    deleteHistory: "Delete",
    loadMore: "Load",
    retry: "Retry",
    sessions: "Sessions",
    sessionDetail: "Upload session detail",
    batchDetail: "Batch session detail",
    torrentDetail: "Torrent file detail",
    downloadDetail: "Download detail",
    uploadedChunks: "Uploaded chunks",
    missingChunks: "Missing chunks",
    selectedFiles: "Selected files",
    trackerHosts: "Tracker hosts",
    lastError: "Last error",
    targetFile: "Target file",
    totalSize: "Total size",
    itemCount: "Item count",
    startedAt: "Started",
    updatedAt: "Updated",
    finishedAt: "Finished",
    recentItems: "Recent items",
    uploaded: "Uploaded",
    failed: "Failed",
    canceled: "Canceled",
    noIssues: "No issues",
    pageSize: "Page size",
    prevPage: "Previous",
    nextPage: "Next",
  },
  zh: {
    title: "传输",
    subtitle: "统一查看上传、下载和种子任务的实时进度、历史归档与明细。",
    liveTitle: "当前传输",
    liveSubtitle: "服务端实时推送的运行中作业，结束后自动移入历史归档。",
    historyTitle: "历史归档",
    historySubtitle: "已完成、失败或取消的传输记录，支持服务端筛选与详情展开。",
    detailTitle: "传输明细",
    detailSubtitle: "按来源类型展示会话、文件、分片和最近状态。",
    streamConnected: "实时流已连接",
    streamReconnecting: "实时流重连中",
    streamError: "实时流解析失败",
    summaryActive: "当前运行",
    summaryFailed: "失败任务",
    summaryCompleted: "24 小时完成",
    summaryActiveValue: (count) => `${count} 个运行中`,
    summaryFailedValue: (count) => `${count} 个失败`,
    summaryCompletedValue: (count) => `${count} 个已完成`,
    filtersDirection: "方向",
    filtersStatus: "状态",
    filtersSource: "来源",
    filtersSearch: "搜索",
    filtersSearchPlaceholder: "按名称或来源标识搜索",
    all: "全部",
    directionUpload: "上传",
    directionDownload: "下载",
    statusRunning: "运行中",
    statusCompleted: "已完成",
    statusError: "失败",
    statusCanceled: "已取消",
    sourceUploadSession: "单文件上传",
    sourceUploadBatch: "批量上传",
    sourceTorrentTask: "种子任务",
    sourceDownloadTask: "下载任务",
    phaseUploadingChunks: "分片上传中",
    phaseFinalizing: "收尾处理中",
    phaseDownloading: "下载中",
    phaseQueued: "排队中",
    phaseTorrentDownloading: "种子下载中",
    phaseAwaitingSelection: "等待文件选择",
    phaseTorrentUploading: "种子上传中",
    phaseIdle: "空闲",
    emptyLiveTitle: "暂无运行中的传输",
    emptyLiveDescription: "新的上传、下载或种子任务开始后，会实时出现在这里。",
    emptyHistoryTitle: "暂无历史记录",
    emptyHistoryDescription: "服务端完成归档后，已结束任务会出现在这里。",
    openDetail: "查看明细",
    deleteHistory: "删除",
    loadMore: "加载",
    retry: "重试",
    sessions: "会话",
    sessionDetail: "上传会话明细",
    batchDetail: "批量子会话",
    torrentDetail: "种子文件明细",
    downloadDetail: "下载详情",
    uploadedChunks: "已上传分片",
    missingChunks: "缺失分片",
    selectedFiles: "已选文件",
    trackerHosts: "Tracker 主机",
    lastError: "最近错误",
    targetFile: "目标文件",
    totalSize: "总大小",
    itemCount: "项目数",
    startedAt: "开始时间",
    updatedAt: "最近更新",
    finishedAt: "结束时间",
    recentItems: "最近子项",
    uploaded: "已上传",
    failed: "失败",
    canceled: "取消",
    noIssues: "无异常",
    pageSize: "每页数量",
    prevPage: "上一页",
    nextPage: "下一页",
  },
}

export function parseLocale(value: string | null): Locale {
  if (value === "zh") {
    return "zh"
  }

  return "en"
}
