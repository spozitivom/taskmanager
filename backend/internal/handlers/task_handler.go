package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/spozitivom/taskmanager/internal/middleware"
	"github.com/spozitivom/taskmanager/internal/models"
	"github.com/spozitivom/taskmanager/internal/services"
)

// -------------------------------------
// Конструктор и регистрация маршрутов
// -------------------------------------

type TaskHandler struct{ Service *services.TaskService }

func NewTaskHandler(s *services.TaskService) *TaskHandler { return &TaskHandler{Service: s} }

func (h *TaskHandler) RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api", middleware.Auth())
	api.GET("/tasks", h.GetTasks)
	api.POST("/tasks", h.CreateTask)
	api.PUT("/tasks/:id", h.UpdateTask)
	api.DELETE("/tasks/:id", h.DeleteTask)
}

func GetTasks(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Tasks fetched successfully"})
}

// -------------------------------------
// Handlers
// -------------------------------------

// GET /api/tasks?sort=desc&status=todo...
func (h *TaskHandler) GetTasks(c *gin.Context) {
	sort := c.DefaultQuery("sort", "desc")
	status := c.Query("status")
	prio := c.Query("priority")
	stage := c.Query("stage")

	tasks, err := h.Service.GetFilteredTasks(sort, status, prio, stage)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "can't fetch tasks"})
		return
	}
	c.JSON(http.StatusOK, tasks)
}

// POST /api/tasks
func (h *TaskHandler) CreateTask(c *gin.Context) {
	var t models.Task
	if err := c.ShouldBindJSON(&t); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.Service.CreateTask(&t); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "can't create"})
		return
	}
	c.JSON(http.StatusCreated, t)
}

// PUT /api/tasks/:id
func (h *TaskHandler) UpdateTask(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var in models.Task
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	upd, err := h.Service.UpdateTask(uint(id), &in)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, upd)
}

// DELETE /api/tasks/:id
func (h *TaskHandler) DeleteTask(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := h.Service.DeleteTask(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "delete failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
