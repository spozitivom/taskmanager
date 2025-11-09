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
	Service  *services.TaskService
	Projects *services.ProjectService
}

// Конструктор
func NewTaskHandler(s *services.TaskService, p *services.ProjectService) *TaskHandler {
	return &TaskHandler{Service: s, Projects: p}
}

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
		api.POST("/tasks/bulk/delete", h.BulkDelete)
		api.POST("/tasks/bulk/status", h.BulkStatus)
		api.POST("/tasks/bulk/assign", h.BulkAssign)
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
	var projectID *uint
	if pidStr := c.Query("project_id"); pidStr != "" {
		if pidStr == "none" {
			zero := uint(0)
			projectID = &zero
		} else if pid, err := strconv.ParseUint(pidStr, 10, 64); err == nil {
			parsed := uint(pid)
			projectID = &parsed
		}
	}

	tasks, err := h.Service.GetFilteredTasks(sort, status, prio, stage, projectID)
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
	if _, ok := userIDFromContext(c); !ok {
		return
	}
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
	if _, ok := userIDFromContext(c); !ok {
		return
	}
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
	if _, ok := userIDFromContext(c); !ok {
		return
	}
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
	if _, ok := userIDFromContext(c); !ok {
		return
	}
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

type bulkIDsPayload struct {
	IDs []uint `json:"ids"`
}

type bulkStatusPayload struct {
	IDs    []uint `json:"ids"`
	Status string `json:"status"`
}

type bulkAssignPayload struct {
	IDs              []uint `json:"ids"`
	ProjectID        *uint  `json:"project_id"`
	ReassignAttached bool   `json:"reassign_attached"`
}

func (h *TaskHandler) BulkDelete(c *gin.Context) {
	if _, ok := userIDFromContext(c); !ok {
		return
	}
	var payload bulkIDsPayload
	if err := c.ShouldBindJSON(&payload); err != nil || len(payload.IDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ids are required"})
		return
	}
	if err := h.Service.BulkDelete(payload.IDs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *TaskHandler) BulkStatus(c *gin.Context) {
	if _, ok := userIDFromContext(c); !ok {
		return
	}
	var payload bulkStatusPayload
	if err := c.ShouldBindJSON(&payload); err != nil || len(payload.IDs) == 0 || payload.Status == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ids and status are required"})
		return
	}
	if err := h.Service.BulkSetStatus(payload.IDs, payload.Status); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *TaskHandler) BulkAssign(c *gin.Context) {
	userID, ok := userIDFromContext(c)
	if !ok {
		return
	}
	var payload bulkAssignPayload
	if err := c.ShouldBindJSON(&payload); err != nil || len(payload.IDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ids are required"})
		return
	}
	if payload.ProjectID == nil {
		if err := h.Service.UnassignFromProject(payload.IDs); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Status(http.StatusNoContent)
		return
	}
	if err := h.Projects.AssignTasks(userID, *payload.ProjectID, payload.IDs, payload.ReassignAttached); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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
