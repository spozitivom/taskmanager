package db

import (
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/spozitivom/taskmanager/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Connect() *gorm.DB {
	dsn := os.Getenv("DB_DSN")
	if strings.TrimSpace(dsn) == "" {
		host := os.Getenv("DB_HOST")
		port := os.Getenv("DB_PORT")
		user := os.Getenv("DB_USER")
		pass := os.Getenv("DB_PASS")
		name := os.Getenv("DB_NAME")
		ssl := os.Getenv("DB_SSLMODE")
		if ssl == "" {
			ssl = "disable"
		}
		dsn = fmt.Sprintf(
			"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s TimeZone=UTC",
			host, port, user, pass, name, ssl,
		)
	}

	cfg := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	}
	db, err := gorm.Open(postgres.Open(dsn), cfg)
	if err != nil {
		log.Fatalf("DB connect error: %v", err)
	}

	// миграции схемы
	if err := db.AutoMigrate(
		&models.User{},
		&models.Task{},
		&models.Project{},
		&models.ProjectMember{},
	); err != nil {
		log.Fatalf("AutoMigrate error: %v", err)
	}
	migrateDeadlineColumn(db)

	// пул соединений
	sqlDB, _ := db.DB()
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)

	return db
}

func migrateDeadlineColumn(db *gorm.DB) {
	if db == nil {
		return
	}
	if !db.Migrator().HasColumn(&models.Task{}, "deadline") {
		return
	}
	if !db.Migrator().HasColumn(&models.Task{}, "end_at") {
		if err := db.Migrator().AddColumn(&models.Task{}, "EndAt"); err != nil {
			log.Printf("failed to add end_at column: %v", err)
			return
		}
	}
	if err := db.Exec("UPDATE tasks SET end_at = deadline WHERE deadline IS NOT NULL AND (end_at IS NULL OR end_at = deadline)").Error; err != nil {
		log.Printf("failed to copy legacy deadline to end_at: %v", err)
	}
	type legacyTask struct {
		Deadline *time.Time
	}
	if err := db.Migrator().DropColumn(&legacyTask{}, "deadline"); err != nil {
		log.Printf("failed to drop legacy deadline column: %v", err)
	}
}
