package models

import "time"

type User struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	Email     string `gorm:"unique;not null" json:"email"`
	Password  string `json:"password"`
	Role      string `gorm:"default:user" json:"role"`
	CreatedAt time.Time
}
