package models

import (
	"time"

	"gorm.io/gorm"
)

type Task struct {
	gorm.Model           // добавляет ID, CreatedAt, UpdatedAt, DeletedAt
	ID         uint      `json:"id" gorm:"primaryKey"`
	Title      string    `json:"title"`
	Checked    bool      `json:"checked"`
	CreatedAt  time.Time `json:"created_at"`
}
