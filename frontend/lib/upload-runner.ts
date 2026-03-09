import type { FileItem } from "@/lib/files"
import {
  completeUploadSession,
  createUploadSession,
  fetchUploadSession,
  uploadSessionChunk,
  type UploadProcess,
  type UploadSession,
} from "@/lib/uploads-api"

interface UploadRunnerCallbacks {
  onSessionResolved?: (payload: { session: UploadSession; transferJobId?: string | null }) => void
  onChunkProgress?: (payload: { uploadedCount: number; totalChunks: number }) => void
}

interface UploadExistingSessionInput {
  file: File
  sessionId: string
  callbacks?: UploadRunnerCallbacks
}

interface UploadNewSessionInput {
  file: File
  parentId: string | null
  transferBatchId?: string
  callbacks?: UploadRunnerCallbacks
}

interface UploadRunnerResult {
  item: FileItem
  session: UploadSession
  uploadProcess?: UploadProcess
}

interface UploadPreparedSessionResult {
  session: UploadSession
  uploadProcess?: UploadProcess
}

interface UploadFinalizeResult {
  item: FileItem
  uploadProcess?: UploadProcess
}

export async function uploadFileChunksToExistingSession(input: UploadExistingSessionInput): Promise<UploadPreparedSessionResult> {
  const session = await fetchUploadSession(input.sessionId)
  input.callbacks?.onSessionResolved?.({ session })
  const uploadProcess = await uploadFileChunksToResolvedSession(input.file, session, input.callbacks)
  return { session, uploadProcess }
}

export async function uploadFileChunksToNewSession(input: UploadNewSessionInput): Promise<UploadPreparedSessionResult> {
  const created = await createUploadSession(input.file, input.parentId, input.transferBatchId)
  input.callbacks?.onSessionResolved?.(created)
  const uploadProcess = await uploadFileChunksToResolvedSession(input.file, created.session, input.callbacks)
  return { session: created.session, uploadProcess }
}

export async function finalizeUploadSession(sessionId: string): Promise<UploadFinalizeResult> {
  const completed = await completeUploadSession(sessionId)
  return {
    item: completed.item,
    uploadProcess: completed.uploadProcess,
  }
}

export async function uploadFileToExistingSession(input: UploadExistingSessionInput): Promise<UploadRunnerResult> {
  const prepared = await uploadFileChunksToExistingSession(input)
  const completed = await finalizeUploadSession(prepared.session.id)
  return {
    item: completed.item,
    session: prepared.session,
    uploadProcess: completed.uploadProcess ?? prepared.uploadProcess,
  }
}

export async function uploadFileToNewSession(input: UploadNewSessionInput): Promise<UploadRunnerResult> {
  const prepared = await uploadFileChunksToNewSession(input)
  const completed = await finalizeUploadSession(prepared.session.id)
  return {
    item: completed.item,
    session: prepared.session,
    uploadProcess: completed.uploadProcess ?? prepared.uploadProcess,
  }
}

async function uploadFileChunksToResolvedSession(
  file: File,
  session: UploadSession,
  callbacks?: UploadRunnerCallbacks,
): Promise<UploadProcess | undefined> {
  const uploadedSet = new Set(session.uploadedChunks || [])
  callbacks?.onChunkProgress?.({
    uploadedCount: uploadedSet.size,
    totalChunks: session.totalChunks,
  })

  let latestProcess: UploadProcess | undefined
  for (let chunkIndex = 0; chunkIndex < session.totalChunks; chunkIndex += 1) {
    if (uploadedSet.has(chunkIndex)) {
      continue
    }

    const from = chunkIndex * session.chunkSize
    const to = Math.min(file.size, from + session.chunkSize)
    const chunk = file.slice(from, to)
    const uploaded = await uploadSessionChunk(session.id, chunkIndex, chunk, file.name)
    if (uploaded.uploadProcess) {
      latestProcess = uploaded.uploadProcess
    }

    uploadedSet.add(chunkIndex)
    callbacks?.onChunkProgress?.({
      uploadedCount: Math.max(uploadedSet.size, uploaded.progress.uploadedCount),
      totalChunks: uploaded.progress.totalChunks,
    })
  }

  return latestProcess
}
