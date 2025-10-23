package models

import "time"

// Task представляет задачу в системе
type Task struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Title       string    `gorm:"not null" json:"title"`            // Название задачи
	Description string    `gorm:"type:text" json:"description"`     // Описание задачи
	Status      string    `gorm:"default:'todo'" json:"status"`     // "todo", "in_progress", "done"
	Priority    string    `gorm:"default:'medium'" json:"priority"` // "low", "medium", "high"
	Stage       string    `gorm:"default:'Общее'" json:"stage"`     // Этап: "Архитектура", "Фронтенд", "Бэкенд"
	Checked     bool      `gorm:"default:false" json:"checked"`     // Выполнена или нет
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"` // Время создания
}
