package models

import "time"

// ProjectInput описывает данные для создания/обновления проекта.
type ProjectInput struct {
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Status      string     `json:"status"`
	Priority    string     `json:"priority"`
	Deadline    *time.Time `json:"deadline"`
	ProgressPct int        `json:"progress_pct"`
	TasksLimit  int        `json:"tasks_limit"`
	Tags        []string   `json:"tags"`
}

// ProjectFromTasksPayload создаёт проект и привязывает выбранные задачи.
type ProjectFromTasksPayload struct {
	ProjectInput     ProjectInput `json:"project"`
	TaskIDs          []uint       `json:"task_ids"`
	ReassignAttached bool         `json:"reassign_attached"`
}
