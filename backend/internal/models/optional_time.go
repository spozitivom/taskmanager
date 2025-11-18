package models

import (
	"encoding/json"
	"time"
)

// OptionalTime хранит RFC3339 дату/время и флаг присутствия поля в payload.
type OptionalTime struct {
	Value   *time.Time
	Present bool
}

// UnmarshalJSON помечает поле как присутствующее даже если там null.
func (ot *OptionalTime) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		ot.Value = nil
		ot.Present = true
		return nil
	}

	var raw string
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	if raw == "" {
		ot.Value = nil
		ot.Present = true
		return nil
	}

	parsed, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return err
	}
	ot.Value = &parsed
	ot.Present = true
	return nil
}
