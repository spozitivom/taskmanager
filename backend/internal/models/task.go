package models

import "time"

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
