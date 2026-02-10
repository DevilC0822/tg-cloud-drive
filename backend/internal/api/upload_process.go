package api

type videoUploadProcessMeta struct {
	FaststartApplied  bool
	FaststartFallback bool
	PreviewAttached   bool
	PreviewFallback   bool
}

type uploadProcessDTO struct {
	VideoFaststartApplied  bool `json:"videoFaststartApplied"`
	VideoFaststartFallback bool `json:"videoFaststartFallback"`
	VideoPreviewAttached   bool `json:"videoPreviewAttached"`
	VideoPreviewFallback   bool `json:"videoPreviewFallback"`
}

func toUploadProcessDTO(meta *videoUploadProcessMeta) *uploadProcessDTO {
	if meta == nil {
		return nil
	}
	return &uploadProcessDTO{
		VideoFaststartApplied:  meta.FaststartApplied,
		VideoFaststartFallback: meta.FaststartFallback,
		VideoPreviewAttached:   meta.PreviewAttached,
		VideoPreviewFallback:   meta.PreviewFallback,
	}
}
