package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/spozitivom/taskmanager/database"
	"github.com/spozitivom/taskmanager/handlers"
	"github.com/spozitivom/taskmanager/middleware"
	"github.com/spozitivom/taskmanager/models"
)

func main() {
	router := gin.Default()

	// Подключаемся к БД
	database.Connect()

	// Миграция таблицы Task
	database.DB.AutoMigrate(&models.Task{})

	// UTF-8 middleware
	router.Use(middleware.ForceUTF8())

	router.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "Сервер работает"})
	})

	// Роуты
	router.GET("/tasks", handlers.GetTasks)
	router.POST("/tasks", handlers.CreateTask)
	router.PUT("/tasks/:id", handlers.UpdateTask)
	router.DELETE("/tasks/:id", handlers.DeleteTask)

	// Запуск
	router.Run(":3000")
}
