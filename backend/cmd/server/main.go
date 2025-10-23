package main

import (
	"log"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	dbPkg "github.com/spozitivom/taskmanager/internal/db"
	"github.com/spozitivom/taskmanager/internal/handlers"
	"github.com/spozitivom/taskmanager/internal/routes"
	"github.com/spozitivom/taskmanager/internal/services"
	"github.com/spozitivom/taskmanager/internal/storage"
)

func main() {
	// 🔧 Загружаем переменные окружения из .env
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️ .env файл не найден, продолжаем с переменными окружения")
	}

	// 📦 Подключаем базу данных
	dbConn := dbPkg.Connect()

	// 🧱 Инициализируем уровни приложения
	taskStorage := storage.NewTaskStorage(dbConn)
	taskService := services.NewTaskService(taskStorage)
	taskHandler := handlers.NewTaskHandler(taskService)

	// 🌐 Создаём Gin роутер
	router := gin.Default()
	router.Use(cors.Default())

	// 🧭 Регистрируем маршруты
	taskHandler.RegisterRoutes(router)
	routes.SetupRoutes(router, dbConn)

	// 🚀 Запускаем сервер
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("🚀 Сервер запущен на http://localhost:%s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("❌ Ошибка запуска сервера: %v", err)
	}
}
