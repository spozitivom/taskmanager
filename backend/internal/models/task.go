package models

import (
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"gorm.io/gorm"
)

// --- Справочники значений ---
const (
	// Статусы задачи
	StatusTodo       = "todo"
	StatusInProgress = "in_progress"
	StatusReview     = "in_review"
	StatusCompleted  = "completed"
	StatusCancelled  = "cancelled"
)

const (
	// Приоритеты задачи
	PriorityLow    = "low"
	PriorityMedium = "medium"
	PriorityHigh   = "high"
)

const (
	// Этап по умолчанию — совпадает с колонкой Kanban
	StageDefault = "todo"
)

const stageMaxLength = 64

var (
	errInvalidPriority = errors.New("priority must be low, medium or high")
	errStageTooLong    = errors.New("stage must be 64 characters or fewer")
	errInvalidStatus   = errors.New("invalid task status")
)

var validPriorities = map[string]struct{}{
	PriorityLow:    {},
	PriorityMedium: {},
	PriorityHigh:   {},
}

var validTaskStatuses = map[string]struct{}{
	StatusTodo:       {},
	StatusInProgress: {},
	StatusReview:     {},
	StatusCompleted:  {},
	StatusCancelled:  {},
}

// Task — сущность задачи
type Task struct {
	ID uint `gorm:"primaryKey" json:"id"`

	// Если привязываешь задачи к пользователю — оставь, иначе удали следующие 2 поля:
	// UserID uint `gorm:"index;not null" json:"user_id"`
	// User   User `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE;" json:"-"`

	Title       string `gorm:"type:varchar(255);not null" json:"title"`
	Description string `gorm:"type:text" json:"description"`

	Status         string     `gorm:"type:varchar(32);default:todo;index:idx_tasks_status" json:"status"`
	PreviousStatus string     `gorm:"type:varchar(32);default:'';" json:"previous_status,omitempty"`
	Priority       string     `gorm:"type:varchar(16);default:medium;index:idx_tasks_priority" json:"priority"`
	Stage          string     `gorm:"type:varchar(64);default:todo;index:idx_tasks_stage" json:"stage"`
	StartAt        *time.Time `json:"start_at,omitempty"`
	EndAt          *time.Time `json:"end_at,omitempty"`
	AllDay         bool       `json:"all_day"`

	ProjectID *uint    `gorm:"index" json:"project_id,omitempty"`
	Project   *Project `json:"project,omitempty"`

	CreatedAt time.Time      `gorm:"autoCreateTime;index:idx_tasks_created_at" json:"created_at"`
	UpdatedAt time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

// NormalizePriority приводит значение приоритета к нижнему регистру и проверяет допустимость.
// Пустое значение заменяется на PriorityMedium.
func NormalizePriority(p string) (string, error) {
	p = strings.ToLower(strings.TrimSpace(p))
	if p == "" {
		return PriorityMedium, nil
	}
	if _, ok := validPriorities[p]; !ok {
		return "", errInvalidPriority
	}
	return p, nil
}

func NormalizeTaskStatus(status string) (string, error) {
	status = strings.TrimSpace(status)
	if status == "" {
		return StatusTodo, nil
	}
	if _, ok := validTaskStatuses[status]; !ok {
		return "", errInvalidStatus
	}
	return status, nil
}

// NormalizeStage подрезает пробелы и контролирует длину значения этапа.
// При пустом значении возвращается StageDefault.
func NormalizeStage(stage string) (string, error) {
	stage = strings.TrimSpace(stage)
	if stage == "" {
		return StageDefault, nil
	}
	if utf8.RuneCountInString(stage) > stageMaxLength {
		return "", errStageTooLong
	}
	return stage, nil
}

// ApplyStatusTransition обновляет статус и previous_status согласно правилам чекбокса.
func (t *Task) ApplyStatusTransition(next string) {
	if next == StatusCompleted && t.Status != StatusCompleted {
		t.PreviousStatus = t.Status
	}
	if next != StatusCompleted && t.Status == StatusCompleted {
		// сбрасываем previous_status, так как задача возвращается в активное состояние
		t.PreviousStatus = ""
	}
	t.Status = next
}
