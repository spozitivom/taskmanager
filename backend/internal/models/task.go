package models

import (
	"errors"
	"strings"
	"time"
	"unicode/utf8"
)

// --- Справочники значений ---
const (
	// Статусы задачи
	StatusTodo       = "todo"
	StatusInProgress = "in_progress"
	StatusDone       = "done"
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
)

var validPriorities = map[string]struct{}{
	PriorityLow:    {},
	PriorityMedium: {},
	PriorityHigh:   {},
}

// Task — сущность задачи
type Task struct {
	ID uint `gorm:"primaryKey" json:"id"`

	// Если привязываешь задачи к пользователю — оставь, иначе удали следующие 2 поля:
	// UserID uint `gorm:"index;not null" json:"user_id"`
	// User   User `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE;" json:"-"`

	Title       string `gorm:"type:varchar(255);not null" json:"title"`
	Description string `gorm:"type:text" json:"description"`

	Status   string `gorm:"type:varchar(32);default:todo;index:idx_tasks_status" json:"status"`
	Priority string `gorm:"type:varchar(16);default:medium;index:idx_tasks_priority" json:"priority"`
	Stage    string `gorm:"type:varchar(64);default:todo;index:idx_tasks_stage" json:"stage"`

	Checked bool `gorm:"default:false;index:idx_tasks_checked" json:"checked"`

	CreatedAt time.Time `gorm:"autoCreateTime;index:idx_tasks_created_at" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`
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
