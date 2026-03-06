package api

import "sync"

const (
	vaultBatchProgressEventInit       = "init"
	vaultBatchProgressEventTargetInit = "target_start"
	vaultBatchProgressEventTarget     = "target_progress"
	vaultBatchProgressEventTargetDone = "target_done"
	vaultBatchProgressEventDone       = "done"
	vaultBatchProgressEventError      = "error"

	vaultBatchParallelismMin     = 2
	vaultBatchParallelismMax     = 4
	vaultBatchParallelismDefault = 2
)

type batchSetItemVaultRequest struct {
	Enabled *bool    `json:"enabled"`
	ItemIDs []string `json:"itemIds"`
}

type vaultBatchFailure struct {
	ItemID string `json:"itemId"`
	Name   string `json:"name"`
	Stage  string `json:"stage"`
	Error  string `json:"error"`
}

type vaultBatchSummary struct {
	TotalTargets           int                 `json:"totalTargets"`
	SucceededTargets       int                 `json:"succeededTargets"`
	FailedTargets          int                 `json:"failedTargets"`
	TotalItems             int                 `json:"totalItems"`
	UpdatedItems           int64               `json:"updatedItems"`
	EligibleSpoilerFiles   int                 `json:"eligibleSpoilerFiles"`
	ProcessedEligibleFiles int                 `json:"processedEligibleFiles"`
	AppliedSpoilerFiles    int                 `json:"appliedSpoilerFiles"`
	SkippedSpoilerFiles    int                 `json:"skippedSpoilerFiles"`
	FailedSpoilerFiles     int                 `json:"failedSpoilerFiles"`
	Failures               []vaultBatchFailure `json:"failures"`
}

type vaultBatchProgressEvent struct {
	Type                   string             `json:"type"`
	Enabled                *bool              `json:"enabled,omitempty"`
	Stage                  string             `json:"stage,omitempty"`
	Message                string             `json:"message,omitempty"`
	TotalTargets           int                `json:"totalTargets"`
	DoneTargets            int                `json:"doneTargets"`
	SucceededTargets       int                `json:"succeededTargets"`
	FailedTargets          int                `json:"failedTargets"`
	Percent                float64            `json:"percent"`
	CurrentItemID          string             `json:"currentItemId,omitempty"`
	CurrentItemName        string             `json:"currentItemName,omitempty"`
	CurrentItemType        string             `json:"currentItemType,omitempty"`
	CurrentItemPercent     float64            `json:"currentItemPercent"`
	TotalItems             int                `json:"totalItems"`
	EligibleSpoilerFiles   int                `json:"eligibleSpoilerFiles"`
	ProcessedEligibleFiles int                `json:"processedEligibleFiles"`
	AppliedSpoilerFiles    int                `json:"appliedSpoilerFiles"`
	SkippedSpoilerFiles    int                `json:"skippedSpoilerFiles"`
	FailedSpoilerFiles     int                `json:"failedSpoilerFiles"`
	Summary                *vaultBatchSummary `json:"summary,omitempty"`
}

type vaultBatchProgressReporter func(vaultBatchProgressEvent) error

type vaultBatchStats struct {
	TotalItems             int
	UpdatedItems           int64
	EligibleSpoilerFiles   int
	ProcessedEligibleFiles int
	AppliedSpoilerFiles    int
	SkippedSpoilerFiles    int
	FailedSpoilerFiles     int
}

type vaultBatchTargetResult struct {
	itemID   string
	name     string
	itemType string
	success  bool
	stage    string
	message  string
	stats    vaultBatchStats
}

type vaultBatchState struct {
	mu       sync.Mutex
	enabled  bool
	summary  vaultBatchSummary
	reporter vaultBatchProgressReporter
	failed   bool
}
