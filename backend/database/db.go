// backend/database/db.go
package database

import (
	"log"
	"os"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// Подключение к БД и возврат *gorm.DB
func Connect() *gorm.DB {
	err := godotenv.Load()
	if err != nil {
		log.Println("⚠️ .env файл не найден, продолжаем...")
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("❌ DATABASE_URL не задана в переменных окружения")
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("❌ Ошибка подключения к БД: ", err)
	}

	return db
}
