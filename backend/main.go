// backend/main.go
package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/spozitivom/taskmanager/database"
	"github.com/spozitivom/taskmanager/handlers"
	"github.com/spozitivom/taskmanager/services"
	"github.com/spozitivom/taskmanager/storage"
)

func main() {
	// Получаем подключение к базе данных
	db := database.Connect()

	// Инициализируем слои приложения
	taskStorage := storage.NewTaskStorage(db)
	taskService := services.NewTaskService(taskStorage)

	// Настраиваем маршруты и запускаем сервер
	router := gin.Default()
	handlers.RegisterTaskRoutes(router, taskService)

	log.Println("🚀 Сервер запущен на http://localhost:8081")
	router.Run(":8081")
}
