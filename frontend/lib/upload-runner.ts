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

export async function uploadFileToExistingSession(input: UploadExistingSessionInput): Promise<UploadRunnerResult> {
  const session = await fetchUploadSession(input.sessionId)
  input.callbacks?.onSessionResolved?.({ session })
  return uploadFileToResolvedSession(input.file, session, input.callbacks)
}

export async function uploadFileToNewSession(input: UploadNewSessionInput): Promise<UploadRunnerResult> {
  const created = await createUploadSession(input.file, input.parentId, input.transferBatchId)
  input.callbacks?.onSessionResolved?.(created)
  return uploadFileToResolvedSession(input.file, created.session, input.callbacks)
}

async function uploadFileToResolvedSession(
  file: File,
  session: UploadSession,
  callbacks?: UploadRunnerCallbacks,
): Promise<UploadRunnerResult> {
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

  const completed = await completeUploadSession(session.id)
  return {
    item: completed.item,
    session,
    uploadProcess: completed.uploadProcess ?? latestProcess,
  }
}
