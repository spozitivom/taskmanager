// backend/handlers/task_handler.go
package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/spozitivom/taskmanager/models"
	"github.com/spozitivom/taskmanager/services"
)

type TaskHandler struct {
	Service *services.TaskService
}

// Регистрирует все маршруты
func RegisterTaskRoutes(r *gin.Engine, service *services.TaskService) {
	h := &TaskHandler{Service: service}
	api := r.Group("/tasks")
	{
		api.GET("", h.GetTasks)
		api.POST("", h.CreateTask)
		api.PUT("/:id", h.UpdateTask)
		api.DELETE("/:id", h.DeleteTask)
	}
}

// Получение задач
func (h *TaskHandler) GetTasks(c *gin.Context) {
	order := c.DefaultQuery("sort", "desc")
	if order != "asc" && order != "desc" {
		order = "desc"
	}

	tasks, err := h.Service.GetTasks(order)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении задач"})
		return
	}

	c.JSON(http.StatusOK, tasks)
}

// Создание задачи
func (h *TaskHandler) CreateTask(c *gin.Context) {
	var task models.Task
	if err := c.ShouldBindJSON(&task); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.Service.CreateTask(&task); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при создании"})
		return
	}

	c.JSON(http.StatusCreated, task)
}

// Обновление задачи
func (h *TaskHandler) UpdateTask(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный ID"})
		return
	}

	var input models.Task
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updated, err := h.Service.UpdateTask(id, &input)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Задача не найдена"})
		return
	}

	c.JSON(http.StatusOK, updated)
}

// Удаление задачи
func (h *TaskHandler) DeleteTask(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный ID"})
		return
	}

	if err := h.Service.DeleteTask(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при удалении"})
		return
	}

	c.Status(http.StatusNoContent)
}
