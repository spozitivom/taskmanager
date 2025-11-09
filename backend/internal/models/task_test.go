package models

import "testing"

func TestNormalizePriority(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{"empty defaults to medium", "", PriorityMedium, false},
		{"trims and lowercases", " High ", PriorityHigh, false},
		{"invalid value", "urgent", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NormalizePriority(tt.input)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("NormalizePriority(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestNormalizeStage(t *testing.T) {
	tooLong := make([]rune, stageMaxLength+1)
	for i := range tooLong {
		tooLong[i] = 'a'
	}

	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{"empty defaults", "", StageDefault, false},
		{"trims whitespace", "  Backend  ", "Backend", false},
		{"within limit", "Deployment", "Deployment", false},
		{"too long", string(tooLong), "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NormalizeStage(tt.input)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("NormalizeStage(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
