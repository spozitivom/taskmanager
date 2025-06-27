package models

type Task struct {
	ID      uint   `json:"id" gorm:"primaryKey"`
	Title   string `json:"title" binding:"required"` // 🔹 теперь обязательное поле
	Checked bool   `json:"checked"`
}
