package main

import (
	"log"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"github.com/spozitivom/taskmanager/database"
	"github.com/spozitivom/taskmanager/handlers"
	"github.com/spozitivom/taskmanager/services"
	"github.com/spozitivom/taskmanager/storage"
)

func main() {
	// 🔧 Загружаем переменные окружения из .env
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️ .env файл не найден, продолжаем с переменными окружения")
	}

	// 📦 Подключаем базу данных
	db := database.Connect()

	// 🧱 Инициализируем уровни приложения:
	// Хранилище → Сервис → Обработчик
	taskStorage := storage.NewTaskStorage(db)
	taskService := services.NewTaskService(taskStorage)
	taskHandler := handlers.NewTaskHandler(taskService)

	// 🌐 Создаём Gin роутер
	router := gin.Default()

	// ✅ Включаем CORS (для локальной разработки разрешаем всё)
	router.Use(cors.Default())

	// 🧭 Регистрируем маршруты задач
	taskHandler.RegisterRoutes(router)

	// 🚀 Стартуем сервер
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081" // По умолчанию
	}
	log.Printf("🚀 Сервер запущен на http://localhost:%s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("❌ Ошибка запуска сервера: %v", err)
	}
}
