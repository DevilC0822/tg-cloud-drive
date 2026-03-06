interface ApiErrorPayload {
  error?: string
  message?: string
  details?: unknown
  [key: string]: unknown
}

export class ApiError extends Error {
  status: number
  code?: string
  payload?: ApiErrorPayload

  constructor(message: string, status: number, code?: string, payload?: ApiErrorPayload) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.payload = payload
  }
}

async function buildApiError(res: Response): Promise<ApiError> {
  const status = res.status

  try {
    const payload = (await res.json()) as ApiErrorPayload
    return new ApiError(payload.message || `请求失败（${status}）`, status, payload.error, payload)
  } catch {
    return new ApiError(`请求失败（${status}）`, status)
  }
}

export async function apiFetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  })

  if (!res.ok) {
    throw await buildApiError(res)
  }

  const rawBody = await res.text()
  if (!rawBody.trim()) {
    return {} as T
  }
  return JSON.parse(rawBody) as T
}
