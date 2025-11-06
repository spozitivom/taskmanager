package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/spozitivom/taskmanager/internal/middleware"
	"github.com/spozitivom/taskmanager/internal/models"
	"github.com/spozitivom/taskmanager/internal/services"
)

// TaskHandler — слой HTTP-обработчиков поверх бизнес-логики (TaskService)
type TaskHandler struct {
	Service *services.TaskService
}

// Конструктор
func NewTaskHandler(s *services.TaskService) *TaskHandler { return &TaskHandler{Service: s} }

// Регистрация маршрутов.
// Важно: добавлен PATCH для частичных обновлений.
// Auth middleware оставлен как у тебя; при необходимости можно вынести публичные GET.
func (h *TaskHandler) RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api", middleware.Auth())
	{
		api.GET("/tasks", h.GetTasks)
		api.POST("/tasks", h.CreateTask)
		api.PUT("/tasks/:id", h.UpdateTask)    // совместимость со старым контрактом
		api.PATCH("/tasks/:id", h.PatchTask)   // частичные обновления через TaskPatch
		api.DELETE("/tasks/:id", h.DeleteTask) // 204 No Content — без тела
	}
}

// -------------------------
// Handlers
// -------------------------

// GET /api/tasks?sort=desc&status=todo&priority=high&stage=Бэкенд
// Возвращает список задач с учётом фильтров и сортировки.
// Код 200, тело — JSON-массив задач.
func (h *TaskHandler) GetTasks(c *gin.Context) {
	sort := c.DefaultQuery("sort", "desc")
	status := c.Query("status")
	prio := c.Query("priority")
	stage := c.Query("stage")

	tasks, err := h.Service.GetFilteredTasks(sort, status, prio, stage)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch tasks"})
		return
	}
	c.JSON(http.StatusOK, tasks)
}

// POST /api/tasks
// Создаёт задачу. Код 201, тело — созданная задача.
// По желанию добавляем Location-заголовок.
// internal/handlers/task_handler.go

func (h *TaskHandler) CreateTask(c *gin.Context) {
	var t models.Task
	if err := c.ShouldBindJSON(&t); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	if err := h.Service.CreateTask(&t); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, t)
}

// PUT /api/tasks/:id
// Полное обновление (оставлено для совместимости).
// ВАЖНО: в сервисе оно теперь проксируется в Patch-логику, чтобы не затирать поля.
func (h *TaskHandler) UpdateTask(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return // parseID уже ответил 400
	}

	var p models.TaskPatch
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	if p.IsEmpty() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "empty payload"})
		return
	}

	upd, err := h.Service.PatchTask(id, p)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}
	c.JSON(http.StatusOK, upd)
}

// PATCH /api/tasks/:id
// Частичное обновление. Меняем только присланные поля (через TaskPatch).
func (h *TaskHandler) PatchTask(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}

	var p models.TaskPatch
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	if p.IsEmpty() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "empty payload"})
		return
	}

	upd, err := h.Service.PatchTask(id, p)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}
	c.JSON(http.StatusOK, upd)
}

// DELETE /api/tasks/:id
// Удаление. Возвращаем 204 No Content (без тела), чтобы фронт не пытался парсить JSON.
func (h *TaskHandler) DeleteTask(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}

	if err := h.Service.DeleteTask(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "delete failed"})
		return
	}
	c.Status(http.StatusNoContent)
}

// -------------------------
// Helpers
// -------------------------

// parseID — безопасно парсит :id, отдает 400 при ошибке.
func parseID(c *gin.Context) (uint, bool) {
	raw := c.Param("id")
	n, err := strconv.ParseUint(raw, 10, 64)
	if err != nil || n == 0 || n > uint64(^uint(0)) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return 0, false
	}
	return uint(n), true
}
