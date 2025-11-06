package models

// TaskPatch — DTO для частичных обновлений
type TaskPatch struct {
	Title       *string `json:"title,omitempty"`
	Description *string `json:"description,omitempty"`
	Status      *string `json:"status,omitempty"`
	Priority    *string `json:"priority,omitempty"`
	Stage       *string `json:"stage,omitempty"`
	Checked     *bool   `json:"checked,omitempty"`
}

func (p TaskPatch) ApplyTo(t *Task) {
	if p.Title != nil {
		t.Title = *p.Title
	}
	if p.Description != nil {
		t.Description = *p.Description
	}
	if p.Status != nil {
		t.Status = *p.Status
	}
	if p.Priority != nil {
		t.Priority = *p.Priority
	}
	if p.Stage != nil {
		t.Stage = *p.Stage
	}
	if p.Checked != nil {
		t.Checked = *p.Checked
	}
}

// IsEmpty помогает понять, пришли ли какие-либо поля в патче.
func (p TaskPatch) IsEmpty() bool {
	return p.Title == nil &&
		p.Description == nil &&
		p.Status == nil &&
		p.Priority == nil &&
		p.Stage == nil &&
		p.Checked == nil
}
