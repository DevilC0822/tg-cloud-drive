package api

import (
	"context"
	"time"
)

const uploadSessionOperationTimeout = 30 * time.Minute

func newUploadSessionOperationContext(ctx context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.WithoutCancel(ctx), uploadSessionOperationTimeout)
}
