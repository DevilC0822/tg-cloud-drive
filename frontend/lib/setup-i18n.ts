import type { Locale } from "@/lib/i18n"

export interface SetupText {
  checkingStatus: string
  retryStatus: string
  bootTitle: string
  bootDescription: string
  bootErrorTitle: string
  panelBadge: string
  panelTitle: string
  panelDescription: string
  stageTitle: string
  stageDescription: string
  stageCheckpoints: string
  stageMethod: string
  stageStatus: string
  stagePending: string
  stageReady: string
  stageRetest: string
  stageFailed: string
  stepChooseTitle: string
  stepChooseDescription: string
  stepConfigTitle: string
  stepConfigDescription: string
  stepTestTitle: string
  stepTestDescription: string
  officialRequirement: string
  selfHostedRequirement: string
  formTitle: string
  formDescription: string
  sectionMethod: string
  sectionBasics: string
  sectionSelfHosted: string
  sectionSecurity: string
  sectionActions: string
  officialOption: string
  selfHostedOption: string
  officialHint: string
  selfHostedHint: string
  botTokenLabel: string
  botTokenPlaceholder: string
  chatIdLabel: string
  chatIdPlaceholder: string
  apiIdLabel: string
  apiIdPlaceholder: string
  apiHashLabel: string
  apiHashPlaceholder: string
  apiBaseUrlLabel: string
  apiBaseUrlPlaceholder: string
  adminPasswordLabel: string
  adminPasswordHint: string
  adminPasswordPlaceholder: string
  revealSecret: string
  hideSecret: string
  testAction: string
  testingAction: string
  initAction: string
  initializingAction: string
  retestRequired: string
  testSuccess: string
  testFailure: string
  initSuccess: string
  alreadyInitialized: string
  changeInvalidatesTest: string
  resultTitle: string
  resultEmpty: string
  resultPending: string
  resultSuccess: string
  resultFailure: string
  resultStale: string
  resultFresh: string
  resultTestedAt: string
  resultBot: string
  resultChat: string
  resultAdmin: string
  resultOk: string
  resultFailed: string
  resultAdminCount: (count: number) => string
  initializedTitle: string
  initializedDescription: string
  initializedLoginHint: string
  loginToView: string
  enterFiles: string
  goSettings: string
  overviewTitle: string
  overviewDescription: string
  overviewAccessMethod: string
  overviewChatId: string
  overviewBotToken: string
  overviewApiId: string
  overviewApiHash: string
  overviewApiBaseUrl: string
  overviewOfficial: string
  overviewSelfHosted: string
  overviewRefresh: string
  loadingOverview: string
  overviewLoadFailed: string
  requiredField: (label: string) => string
  positiveInteger: (label: string) => string
}

export const setupMessages: Record<Locale, SetupText> = {
  en: {
    checkingStatus: "Checking system status",
    retryStatus: "Retry",
    bootTitle: "Checking setup",
    bootDescription: "Confirming whether this system has already been initialized.",
    bootErrorTitle: "Unable to read setup status",
    panelBadge: "System Setup",
    panelTitle: "Connect Telegram",
    panelDescription: "Fill in the settings, test once, then finish initialization.",
    stageTitle: "Setup flow",
    stageDescription: "Only keep the fields you need. The current state is shown on the right.",
    stageCheckpoints: "Checkpoints",
    stageMethod: "Current method",
    stageStatus: "Test status",
    stagePending: "Pending test",
    stageReady: "Ready to initialize",
    stageRetest: "Needs retest",
    stageFailed: "Test failed",
    stepChooseTitle: "Choose access method",
    stepChooseDescription: "Pick official Bot API or your own service.",
    stepConfigTitle: "Fill in connection settings",
    stepConfigDescription: "Enter Bot Token, storage Chat ID, and admin password.",
    stepTestTitle: "Test and initialize",
    stepTestDescription: "Only initialize after the current form passes the test.",
    officialRequirement: "Official mode only needs Bot Token, Chat ID, and admin password.",
    selfHostedRequirement: "Self-hosted mode also needs API ID, API Hash, and Base URL.",
    formTitle: "Connection settings",
    formDescription: "Edit the current method settings here. Any change requires a new test.",
    sectionMethod: "Access method",
    sectionBasics: "Basic settings",
    sectionSelfHosted: "Self-hosted service",
    sectionSecurity: "Admin sign-in",
    sectionActions: "Initialize",
    officialOption: "Official",
    selfHostedOption: "Self-hosted",
    officialHint: "Use Telegram official Bot API.",
    selfHostedHint: "Use your own Bot API service.",
    botTokenLabel: "Bot Token",
    botTokenPlaceholder: "123456:ABCDEF...",
    chatIdLabel: "Storage Chat ID",
    chatIdPlaceholder: "-1001234567890",
    apiIdLabel: "API ID",
    apiIdPlaceholder: "2040",
    apiHashLabel: "API Hash",
    apiHashPlaceholder: "Telegram API hash",
    apiBaseUrlLabel: "Bot API Base URL",
    apiBaseUrlPlaceholder: "http://telegram-bot-api:8081",
    adminPasswordLabel: "Admin Password",
    adminPasswordHint: "This password will be used for future sign-in.",
    adminPasswordPlaceholder: "Password for admin sign-in",
    revealSecret: "Show secret",
    hideSecret: "Hide secret",
    testAction: "Test Connection",
    testingAction: "Testing...",
    initAction: "Initialize System",
    initializingAction: "Initializing...",
    retestRequired: "Run a successful connection test on the current form before initialization.",
    testSuccess: "Connection test passed.",
    testFailure: "Connection test failed.",
    initSuccess: "Initialization completed.",
    alreadyInitialized: "This instance was already initialized.",
    changeInvalidatesTest: "Configuration changed. Re-run the connection test before initialization.",
    resultTitle: "Validation Report",
    resultEmpty: "No validation report yet.",
    resultPending: "Run a connection test to inspect bot, chat, and admin status.",
    resultSuccess: "Current configuration is validated and ready to initialize.",
    resultFailure: "Validation failed. Inspect the failing step before continuing.",
    resultStale: "Stale report",
    resultFresh: "Current report",
    resultTestedAt: "Tested at",
    resultBot: "Bot identity",
    resultChat: "Chat access",
    resultAdmin: "Admin role",
    resultOk: "OK",
    resultFailed: "Failed",
    resultAdminCount: (count) => `admin count: ${count}`,
    initializedTitle: "System is already initialized.",
    initializedDescription: "Sign in to view the current access configuration.",
    initializedLoginHint: "After sign-in you can see a read-only setup overview.",
    loginToView: "Sign In to View",
    enterFiles: "Enter Files",
    goSettings: "Open Settings",
    overviewTitle: "Current access settings",
    overviewDescription: "Read-only summary of the current Telegram connection.",
    overviewAccessMethod: "Access Method",
    overviewChatId: "Storage Chat ID",
    overviewBotToken: "Bot Token",
    overviewApiId: "API ID",
    overviewApiHash: "API Hash",
    overviewApiBaseUrl: "Bot API Base URL",
    overviewOfficial: "Official Bot API",
    overviewSelfHosted: "Self-hosted Bot API",
    overviewRefresh: "Refresh",
    loadingOverview: "Loading setup overview...",
    overviewLoadFailed: "Failed to load setup overview.",
    requiredField: (label) => `${label} is required`,
    positiveInteger: (label) => `${label} must be a positive integer`,
  },
  zh: {
    checkingStatus: "正在检查系统状态",
    retryStatus: "重试",
    bootTitle: "正在检查 setup",
    bootDescription: "先确认这个系统是否已经完成初始化。",
    bootErrorTitle: "读取 setup 状态失败",
    panelBadge: "系统初始化",
    panelTitle: "连接 Telegram",
    panelDescription: "填好配置，测试通过后再完成初始化。",
    stageTitle: "初始化流程",
    stageDescription: "这里只保留必要配置，当前状态会实时显示。",
    stageCheckpoints: "步骤",
    stageMethod: "当前方式",
    stageStatus: "测试状态",
    stagePending: "待测试",
    stageReady: "可以初始化",
    stageRetest: "需要重测",
    stageFailed: "测试失败",
    stepChooseTitle: "选择接入方式",
    stepChooseDescription: "先选官方还是自建接入。",
    stepConfigTitle: "填写连接参数",
    stepConfigDescription: "填 Bot Token、存储 Chat ID 和管理员密码。",
    stepTestTitle: "测试并初始化",
    stepTestDescription: "当前表单测试通过后，再执行初始化。",
    officialRequirement: "官方模式只需要 Bot Token、Chat ID 和管理员密码。",
    selfHostedRequirement: "自建模式还需要 API ID、API Hash 和 Base URL。",
    formTitle: "连接参数",
    formDescription: "按当前方式填写配置，修改后需要重新测试。",
    sectionMethod: "接入方式",
    sectionBasics: "基础配置",
    sectionSelfHosted: "自建服务",
    sectionSecurity: "后台登录",
    sectionActions: "执行初始化",
    officialOption: "官方",
    selfHostedOption: "自建",
    officialHint: "使用 Telegram 官方 Bot API。",
    selfHostedHint: "使用你自己的 Bot API 服务。",
    botTokenLabel: "Bot Token",
    botTokenPlaceholder: "123456:ABCDEF...",
    chatIdLabel: "存储 Chat ID",
    chatIdPlaceholder: "-1001234567890",
    apiIdLabel: "API ID",
    apiIdPlaceholder: "2040",
    apiHashLabel: "API Hash",
    apiHashPlaceholder: "Telegram API Hash",
    apiBaseUrlLabel: "Bot API Base URL",
    apiBaseUrlPlaceholder: "http://telegram-bot-api:8081",
    adminPasswordLabel: "管理员密码",
    adminPasswordHint: "初始化完成后，后台登录会用到这个密码。",
    adminPasswordPlaceholder: "请输入管理员密码",
    revealSecret: "显示密文",
    hideSecret: "隐藏密文",
    testAction: "测试连接",
    testingAction: "测试中...",
    initAction: "确认初始化",
    initializingAction: "初始化中...",
    retestRequired: "请先基于当前表单完成一次成功的连接测试，再执行初始化。",
    testSuccess: "连接测试通过。",
    testFailure: "连接测试失败。",
    initSuccess: "初始化完成。",
    alreadyInitialized: "当前实例已经完成初始化。",
    changeInvalidatesTest: "配置已变更，需要重新测试连接后才能初始化。",
    resultTitle: "验证报告",
    resultEmpty: "还没有验证报告。",
    resultPending: "先执行一次连接测试，查看 Bot、Chat 和管理员权限状态。",
    resultSuccess: "当前配置已验证通过，可以执行初始化。",
    resultFailure: "验证未通过，请先处理失败步骤。",
    resultStale: "过期报告",
    resultFresh: "当前报告",
    resultTestedAt: "测试时间",
    resultBot: "Bot 身份",
    resultChat: "Chat 访问",
    resultAdmin: "管理员权限",
    resultOk: "通过",
    resultFailed: "失败",
    resultAdminCount: (count) => `管理员数量：${count}`,
    initializedTitle: "系统已初始化",
    initializedDescription: "如需查看当前接入配置，请先登录。",
    initializedLoginHint: "登录后可以查看只读的初始化概览。",
    loginToView: "登录后查看",
    enterFiles: "进入文件页",
    goSettings: "打开设置",
    overviewTitle: "当前接入配置",
    overviewDescription: "这里显示当前 Telegram 接入方式和基础信息。",
    overviewAccessMethod: "接入方式",
    overviewChatId: "存储 Chat ID",
    overviewBotToken: "Bot Token",
    overviewApiId: "API ID",
    overviewApiHash: "API Hash",
    overviewApiBaseUrl: "Bot API Base URL",
    overviewOfficial: "官方 Bot API",
    overviewSelfHosted: "自建 Bot API",
    overviewRefresh: "刷新",
    loadingOverview: "正在加载 setup 概览...",
    overviewLoadFailed: "加载 setup 概览失败。",
    requiredField: (label) => `${label} 不能为空`,
    positiveInteger: (label) => `${label} 必须是正整数`,
  },
}
