package database

import (
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/spozitivom/taskmanager/models" // подкорректируй путь
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

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

	// Авто-миграция моделей
	err = db.AutoMigrate(&models.Task{})
	if err != nil {
		log.Fatal("❌ Ошибка при авто-миграции:", err)
	}

	log.Println("✅ Подключение к БД установлено, миграция прошла успешно")
	return db
}
