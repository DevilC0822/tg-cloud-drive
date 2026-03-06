import type { BackendItemType } from "@/lib/files"
import type { SetupAccessMethod } from "@/lib/profile-api"
import type { TransferJobStatus, TransferStreamStatus } from "@/lib/transfers-api"

export type ThemeToneName =
  | "info"
  | "folder"
  | "document"
  | "audio"
  | "image"
  | "video"
  | "archive"

export type SemanticToneName = "success" | "warning" | "error"
export type GlassGlowTone = "cyan" | "pink" | "orange" | "none"
export type OrbTone = Exclude<GlassGlowTone, "none">

type ToneClasses = {
  text: string
  fill: string
  bg: string
  bgStrong: string
  border: string
  gradient: string
  badge: string
  iconWrap: string
  hoverBorder: string
  hoverBg: string
  glow: string
}

type SemanticClasses = {
  text: string
  fill: string
  bg: string
  border: string
  badge: string
  solid: string
}

type OrbVars = {
  core: string
  fade: string
  glow: string
}

const TONE_CLASS_MAP: Record<ThemeToneName, ToneClasses> = {
  info: {
    text: "text-[var(--tone-info-text)]",
    fill: "fill-[var(--tone-info-text)]",
    bg: "bg-[var(--tone-info-bg)]",
    bgStrong: "bg-[var(--tone-info-bg-strong)]",
    border: "border-[var(--tone-info-border)]",
    gradient: "from-[var(--tone-info-gradient-from)] to-[var(--tone-info-gradient-to)]",
    badge: "border-[var(--tone-info-border)] bg-[var(--tone-info-bg)] text-[var(--tone-info-text)]",
    iconWrap: "border-[var(--tone-info-border)] bg-[var(--tone-info-bg)] text-[var(--tone-info-text)]",
    hoverBorder: "hover:border-[var(--tone-info-border)]",
    hoverBg: "hover:bg-[var(--tone-info-bg)]",
    glow: "hover:shadow-[0_0_30px_var(--tone-info-glow)]",
  },
  folder: {
    text: "text-[var(--tone-folder-text)]",
    fill: "fill-[var(--tone-folder-text)]",
    bg: "bg-[var(--tone-folder-bg)]",
    bgStrong: "bg-[var(--tone-folder-bg-strong)]",
    border: "border-[var(--tone-folder-border)]",
    gradient: "from-[var(--tone-folder-gradient-from)] to-[var(--tone-folder-gradient-to)]",
    badge: "border-[var(--tone-folder-border)] bg-[var(--tone-folder-bg)] text-[var(--tone-folder-text)]",
    iconWrap: "border-[var(--tone-folder-border)] bg-[var(--tone-folder-bg)] text-[var(--tone-folder-text)]",
    hoverBorder: "hover:border-[var(--tone-folder-border)]",
    hoverBg: "hover:bg-[var(--tone-folder-bg)]",
    glow: "hover:shadow-[0_0_30px_var(--tone-folder-glow)]",
  },
  document: {
    text: "text-[var(--tone-document-text)]",
    fill: "fill-[var(--tone-document-text)]",
    bg: "bg-[var(--tone-document-bg)]",
    bgStrong: "bg-[var(--tone-document-bg-strong)]",
    border: "border-[var(--tone-document-border)]",
    gradient: "from-[var(--tone-document-gradient-from)] to-[var(--tone-document-gradient-to)]",
    badge: "border-[var(--tone-document-border)] bg-[var(--tone-document-bg)] text-[var(--tone-document-text)]",
    iconWrap: "border-[var(--tone-document-border)] bg-[var(--tone-document-bg)] text-[var(--tone-document-text)]",
    hoverBorder: "hover:border-[var(--tone-document-border)]",
    hoverBg: "hover:bg-[var(--tone-document-bg)]",
    glow: "hover:shadow-[0_0_30px_var(--tone-document-glow)]",
  },
  audio: {
    text: "text-[var(--tone-audio-text)]",
    fill: "fill-[var(--tone-audio-text)]",
    bg: "bg-[var(--tone-audio-bg)]",
    bgStrong: "bg-[var(--tone-audio-bg-strong)]",
    border: "border-[var(--tone-audio-border)]",
    gradient: "from-[var(--tone-audio-gradient-from)] to-[var(--tone-audio-gradient-to)]",
    badge: "border-[var(--tone-audio-border)] bg-[var(--tone-audio-bg)] text-[var(--tone-audio-text)]",
    iconWrap: "border-[var(--tone-audio-border)] bg-[var(--tone-audio-bg)] text-[var(--tone-audio-text)]",
    hoverBorder: "hover:border-[var(--tone-audio-border)]",
    hoverBg: "hover:bg-[var(--tone-audio-bg)]",
    glow: "hover:shadow-[0_0_30px_var(--tone-audio-glow)]",
  },
  image: {
    text: "text-[var(--tone-image-text)]",
    fill: "fill-[var(--tone-image-text)]",
    bg: "bg-[var(--tone-image-bg)]",
    bgStrong: "bg-[var(--tone-image-bg-strong)]",
    border: "border-[var(--tone-image-border)]",
    gradient: "from-[var(--tone-image-gradient-from)] to-[var(--tone-image-gradient-to)]",
    badge: "border-[var(--tone-image-border)] bg-[var(--tone-image-bg)] text-[var(--tone-image-text)]",
    iconWrap: "border-[var(--tone-image-border)] bg-[var(--tone-image-bg)] text-[var(--tone-image-text)]",
    hoverBorder: "hover:border-[var(--tone-image-border)]",
    hoverBg: "hover:bg-[var(--tone-image-bg)]",
    glow: "hover:shadow-[0_0_30px_var(--tone-image-glow)]",
  },
  video: {
    text: "text-[var(--tone-video-text)]",
    fill: "fill-[var(--tone-video-text)]",
    bg: "bg-[var(--tone-video-bg)]",
    bgStrong: "bg-[var(--tone-video-bg-strong)]",
    border: "border-[var(--tone-video-border)]",
    gradient: "from-[var(--tone-video-gradient-from)] to-[var(--tone-video-gradient-to)]",
    badge: "border-[var(--tone-video-border)] bg-[var(--tone-video-bg)] text-[var(--tone-video-text)]",
    iconWrap: "border-[var(--tone-video-border)] bg-[var(--tone-video-bg)] text-[var(--tone-video-text)]",
    hoverBorder: "hover:border-[var(--tone-video-border)]",
    hoverBg: "hover:bg-[var(--tone-video-bg)]",
    glow: "hover:shadow-[0_0_30px_var(--tone-video-glow)]",
  },
  archive: {
    text: "text-[var(--tone-archive-text)]",
    fill: "fill-[var(--tone-archive-text)]",
    bg: "bg-[var(--tone-archive-bg)]",
    bgStrong: "bg-[var(--tone-archive-bg-strong)]",
    border: "border-[var(--tone-archive-border)]",
    gradient: "from-[var(--tone-archive-gradient-from)] to-[var(--tone-archive-gradient-to)]",
    badge: "border-[var(--tone-archive-border)] bg-[var(--tone-archive-bg)] text-[var(--tone-archive-text)]",
    iconWrap: "border-[var(--tone-archive-border)] bg-[var(--tone-archive-bg)] text-[var(--tone-archive-text)]",
    hoverBorder: "hover:border-[var(--tone-archive-border)]",
    hoverBg: "hover:bg-[var(--tone-archive-bg)]",
    glow: "hover:shadow-[0_0_30px_var(--tone-archive-glow)]",
  },
}

const SEMANTIC_CLASS_MAP: Record<SemanticToneName, SemanticClasses> = {
  success: {
    text: "text-[var(--semantic-success-text)]",
    fill: "fill-[var(--semantic-success-text)]",
    bg: "bg-[var(--semantic-success-bg)]",
    border: "border-[var(--semantic-success-border)]",
    badge: "border-[var(--semantic-success-border)] bg-[var(--semantic-success-bg)] text-[var(--semantic-success-text)]",
    solid: "bg-[var(--semantic-success-text)] text-[var(--semantic-success-foreground)]",
  },
  warning: {
    text: "text-[var(--semantic-warning-text)]",
    fill: "fill-[var(--semantic-warning-text)]",
    bg: "bg-[var(--semantic-warning-bg)]",
    border: "border-[var(--semantic-warning-border)]",
    badge: "border-[var(--semantic-warning-border)] bg-[var(--semantic-warning-bg)] text-[var(--semantic-warning-text)]",
    solid: "bg-[var(--semantic-warning-text)] text-[var(--semantic-warning-foreground)]",
  },
  error: {
    text: "text-[var(--semantic-error-text)]",
    fill: "fill-[var(--semantic-error-text)]",
    bg: "bg-[var(--semantic-error-bg)]",
    border: "border-[var(--semantic-error-border)]",
    badge: "border-[var(--semantic-error-border)] bg-[var(--semantic-error-bg)] text-[var(--semantic-error-text)]",
    solid: "bg-[var(--semantic-error-text)] text-[var(--semantic-error-foreground)]",
  },
}

const GLASS_GLOW_CLASS_MAP: Record<GlassGlowTone, string> = {
  cyan: TONE_CLASS_MAP.info.glow,
  pink: TONE_CLASS_MAP.video.glow,
  orange: TONE_CLASS_MAP.archive.glow,
  none: "",
}

const ORB_VAR_MAP: Record<OrbTone, OrbVars> = {
  cyan: {
    core: "var(--tone-info-orb-core)",
    fade: "var(--tone-info-orb-fade)",
    glow: "var(--tone-info-glow)",
  },
  pink: {
    core: "var(--tone-video-orb-core)",
    fade: "var(--tone-video-orb-fade)",
    glow: "var(--tone-video-glow)",
  },
  orange: {
    core: "var(--tone-archive-orb-core)",
    fade: "var(--tone-archive-orb-fade)",
    glow: "var(--tone-archive-glow)",
  },
}

const TRANSFER_STATUS_BADGE_MAP: Record<TransferJobStatus, string> = {
  running: TONE_CLASS_MAP.info.badge,
  completed: SEMANTIC_CLASS_MAP.success.badge,
  error: SEMANTIC_CLASS_MAP.error.badge,
  canceled: SEMANTIC_CLASS_MAP.warning.badge,
}

const TRANSFER_STREAM_BADGE_MAP: Record<TransferStreamStatus, string> = {
  connected: TONE_CLASS_MAP.info.badge,
  reconnecting: SEMANTIC_CLASS_MAP.warning.badge,
  error: SEMANTIC_CLASS_MAP.error.badge,
}

const SERVICE_TONE_MAP: Record<SetupAccessMethod, string> = {
  official_bot_api: TONE_CLASS_MAP.info.badge,
  self_hosted_bot_api: SEMANTIC_CLASS_MAP.success.badge,
  mtproto: TONE_CLASS_MAP.document.badge,
}

export const themeToneClasses = TONE_CLASS_MAP
export const semanticToneClasses = SEMANTIC_CLASS_MAP
export const glassGlowClasses = GLASS_GLOW_CLASS_MAP
export const floatingOrbVars = ORB_VAR_MAP

export const animatedBackgroundVars = {
  particleColors: [
    "var(--tone-info-particle)",
    "var(--tone-video-particle)",
    "var(--tone-archive-particle)",
  ],
  connectionColors: [
    "var(--tone-info-connection)",
    "var(--tone-video-connection)",
    "var(--tone-archive-connection)",
  ],
  meshGradient:
    "linear-gradient(135deg, var(--theme-mesh-start) 0%, var(--theme-mesh-middle) 50%, var(--theme-mesh-end) 100%)",
} as const

export function getFileToneName(type: BackendItemType): ThemeToneName {
  if (type === "folder") return "folder"
  if (type === "image") return "image"
  if (type === "document") return "document"
  if (type === "video") return "video"
  if (type === "audio") return "audio"
  if (type === "archive") return "archive"
  return "info"
}

export function getFileToneClasses(type: BackendItemType) {
  return TONE_CLASS_MAP[getFileToneName(type)]
}

export function getTransferStatusToneClasses(status: TransferJobStatus) {
  return TRANSFER_STATUS_BADGE_MAP[status]
}

export function getTransferStreamToneClasses(status: TransferStreamStatus) {
  return TRANSFER_STREAM_BADGE_MAP[status]
}

export function getServiceToneClasses(method: SetupAccessMethod) {
  return SERVICE_TONE_MAP[method]
}
