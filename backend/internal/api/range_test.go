package api

import "testing"

func TestParseSingleRange_NoHeader(t *testing.T) {
	br, partial, err := parseSingleRange("", 100)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if partial {
		t.Fatalf("expected partial=false")
	}
	if br.Start != 0 || br.End != 99 {
		t.Fatalf("unexpected range: %+v", br)
	}
}

func TestParseSingleRange_Basic(t *testing.T) {
	tests := []struct {
		name    string
		header  string
		size    int64
		start   int64
		end     int64
		partial bool
		wantErr error
	}{
		{name: "single", header: "bytes=0-0", size: 100, start: 0, end: 0, partial: true},
		{name: "openEnd", header: "bytes=10-", size: 100, start: 10, end: 99, partial: true},
		{name: "clampEnd", header: "bytes=10-999", size: 100, start: 10, end: 99, partial: true},
		{name: "suffix", header: "bytes=-1", size: 100, start: 99, end: 99, partial: true},
		{name: "suffixClamp", header: "bytes=-200", size: 100, start: 0, end: 99, partial: true},
		{name: "multi", header: "bytes=0-1,2-3", size: 100, wantErr: errMultipleRangesNotAllow},
		{name: "invalidUnit", header: "items=0-1", size: 100, wantErr: errInvalidRangeHeader},
		{name: "invalidOrder", header: "bytes=10-9", size: 100, wantErr: errInvalidRangeHeader},
		{name: "startTooLarge", header: "bytes=100-100", size: 100, wantErr: errRangeNotSatisfiable},
		{name: "zeroSizeNoHeader", header: "", size: 0, start: 0, end: -1, partial: false},
		{name: "zeroSizeWithHeader", header: "bytes=0-0", size: 0, wantErr: errRangeNotSatisfiable, partial: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			br, partial, err := parseSingleRange(tt.header, tt.size)
			if tt.wantErr != nil {
				if err == nil {
					t.Fatalf("expected err %v, got nil", tt.wantErr)
				}
				if err != tt.wantErr {
					t.Fatalf("expected err %v, got %v", tt.wantErr, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected err: %v", err)
			}
			if partial != tt.partial {
				t.Fatalf("expected partial=%v, got %v", tt.partial, partial)
			}
			if br.Start != tt.start || br.End != tt.end {
				t.Fatalf("unexpected range: %+v", br)
			}
		})
	}
}

