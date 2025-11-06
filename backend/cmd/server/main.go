package main

import (
	"log"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	appdb "github.com/spozitivom/taskmanager/internal/db"
	"github.com/spozitivom/taskmanager/internal/handlers"
	"github.com/spozitivom/taskmanager/internal/middleware"
	"github.com/spozitivom/taskmanager/internal/services"
	"github.com/spozitivom/taskmanager/internal/storage"
)

func main() {
	// Загружаем переменные окружения из .env (если файл есть).
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️ .env файл не найден, продолжаем с переменными окружения")
	}

	// Подключаемся к БД и инициализируем слои приложения.
	db := appdb.Connect()

	taskStorage := storage.NewTaskStorage(db)
	taskService := services.NewTaskService(taskStorage)
	taskHandler := handlers.NewTaskHandler(taskService)

	authHandler := &handlers.AuthHandler{DB: db}

	// Готовим Gin.
	router := gin.Default()
	router.Use(cors.Default())
	router.Use(middleware.Recover())
	router.Use(middleware.ForceUTF8())

	// Публичные эндпоинты авторизации.
	router.POST("/api/auth/register", authHandler.Register)
	router.POST("/api/auth/login", authHandler.Login)

	// Защищённые задачи.
	taskHandler.RegisterRoutes(router)

	// Запускаем сервер.
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("🚀 Сервер запущен на http://localhost:%s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("❌ Ошибка запуска сервера: %v", err)
	}
}
