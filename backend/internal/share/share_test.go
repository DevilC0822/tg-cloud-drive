package share

import "testing"

func TestGenerateCode_LengthAndAlphabet(t *testing.T) {
	code, err := GenerateCode(12)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if len(code) != 12 {
		t.Fatalf("expected len=12, got %d", len(code))
	}

	allowed := map[rune]bool{}
	for _, r := range base62Alphabet {
		allowed[r] = true
	}

	for _, r := range code {
		if !allowed[r] {
			t.Fatalf("unexpected rune %q in code %q", r, code)
		}
	}
}

