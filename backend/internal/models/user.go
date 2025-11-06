package models

import "time"

// User — учетная запись
type User struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Email     string    `gorm:"type:varchar(255);uniqueIndex:uniq_users_email" json:"email"`
	Username  string    `gorm:"type:varchar(64);uniqueIndex:uniq_users_username" json:"username"`
	Password  string    `gorm:"type:varchar(255);not null" json:"-"` // не выдаем в JSON
	Role      string    `gorm:"type:varchar(32);default:user" json:"role"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime"  json:"updated_at"`
}
