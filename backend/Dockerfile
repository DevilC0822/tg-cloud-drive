# 构建阶段
FROM golang:1.23 AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY cmd ./cmd
COPY internal ./internal

RUN CGO_ENABLED=0 GOOS=linux go build -o /out/server ./cmd/server

# 运行阶段（包含 ffmpeg）
FROM debian:bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /
COPY --from=builder /out/server /server

RUN useradd --system --uid 10001 --create-home --shell /usr/sbin/nologin app \
  && mkdir -p /var/lib/tgcd-thumbnail-cache \
  && mkdir -p /var/lib/tgcd-runtime/self-hosted-bot-api \
  && mkdir -p /var/lib/tgcd-runtime/self-hosted-bot-api-upload \
  && chown -R app:app /var/lib/tgcd-thumbnail-cache \
  && chown -R app:app /var/lib/tgcd-runtime

EXPOSE 8080
USER app

ENTRYPOINT ["/server"]
