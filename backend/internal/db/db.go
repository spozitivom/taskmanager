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

	// пул соединений
	sqlDB, _ := db.DB()
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)

	return db
}
