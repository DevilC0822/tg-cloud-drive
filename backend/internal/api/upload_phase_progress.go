package api

import (
	"context"
	"io"
	"time"

	"tg-cloud-drive-api/internal/store"
)

const uploadPhaseProgressSyncInterval = 250 * time.Millisecond

type uploadPhaseProgressReporter struct {
	server       *Server
	ctx          context.Context
	session      store.UploadSession
	phaseDetail  string
	progressMode string
	total        int64
	unit         string
	lastSyncAt   time.Time
	lastBytes    int64
	lastSampleAt time.Time
}

func newUploadPhaseProgressReporter(
	server *Server,
	ctx context.Context,
	session store.UploadSession,
	phaseDetail string,
	progressMode string,
	total int64,
	unit string,
) *uploadPhaseProgressReporter {
	return &uploadPhaseProgressReporter{
		server:       server,
		ctx:          ctx,
		session:      session,
		phaseDetail:  phaseDetail,
		progressMode: progressMode,
		total:        maxInt64(total, 0),
		unit:         unit,
	}
}

func (r *uploadPhaseProgressReporter) Reset() {
	r.lastSyncAt = time.Time{}
	r.lastBytes = 0
	r.lastSampleAt = time.Time{}
	r.sync(0, 0)
}

func (r *uploadPhaseProgressReporter) Update(current int64) {
	now := time.Now()
	if current < r.lastBytes {
		r.lastBytes = 0
		r.lastSampleAt = time.Time{}
	}

	speed := int64(0)
	if !r.lastSampleAt.IsZero() && current >= r.lastBytes {
		elapsedMs := now.Sub(r.lastSampleAt).Milliseconds()
		if elapsedMs > 0 {
			speed = ((current - r.lastBytes) * 1000) / elapsedMs
		}
	}

	shouldSync := r.lastSyncAt.IsZero() || now.Sub(r.lastSyncAt) >= uploadPhaseProgressSyncInterval || current >= r.total
	if shouldSync {
		r.sync(current, speed)
		r.lastSyncAt = now
		r.lastBytes = current
		r.lastSampleAt = now
	}
}

func (r *uploadPhaseProgressReporter) Complete() {
	r.sync(r.total, 0)
}

func (r *uploadPhaseProgressReporter) UpdateWithSpeed(current int64, speedBytesPerSecond int64) {
	r.sync(current, speedBytesPerSecond)
}

func (r *uploadPhaseProgressReporter) sync(current int64, speedBytesPerSecond int64) {
	r.server.syncUploadTransferRuntimeStateBySession(r.ctx, r.session, uploadTransferRuntimeState{
		PhaseDetail:         r.phaseDetail,
		ProgressCurrent:     maxInt64(current, 0),
		ProgressTotal:       r.total,
		ProgressUnit:        r.unit,
		ProgressMode:        r.progressMode,
		SpeedBytesPerSecond: maxInt64(speedBytesPerSecond, 0),
	})
}

type uploadPhaseProgressReader struct {
	source    io.Reader
	reporter  *uploadPhaseProgressReporter
	baseBytes int64
	readBytes int64
}

func newUploadPhaseProgressReader(
	source io.Reader,
	reporter *uploadPhaseProgressReporter,
	baseBytes int64,
) io.Reader {
	return &uploadPhaseProgressReader{
		source:    source,
		reporter:  reporter,
		baseBytes: maxInt64(baseBytes, 0),
	}
}

func (r *uploadPhaseProgressReader) Read(p []byte) (int, error) {
	n, err := r.source.Read(p)
	if n > 0 {
		r.readBytes += int64(n)
		r.reporter.Update(r.baseBytes + r.readBytes)
	}
	return n, err
}
