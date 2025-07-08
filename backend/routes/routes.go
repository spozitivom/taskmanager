package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/spozitivom/taskmanager/handlers"
	"github.com/spozitivom/taskmanager/middleware"
	"gorm.io/gorm"
)

func SetupRoutes(r *gin.Engine, db *gorm.DB) {
	authHandler := handlers.AuthHandler{DB: db}
	r.POST("/api/auth/register", authHandler.Register)
	r.POST("/api/auth/login", authHandler.Login)

	// Защищённые маршруты
	api := r.Group("/api")
	api.Use(middleware.Auth())
	// api.GET("/tasks", handlers.GetTasks) // пример
}
