package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/spozitivom/taskmanager/internal/middleware"
	"github.com/spozitivom/taskmanager/internal/models"
	"github.com/spozitivom/taskmanager/internal/services"
)

// ProjectHandler обслуживает CRUD для проектов.
type ProjectHandler struct {
	Service *services.ProjectService
}

func NewProjectHandler(s *services.ProjectService) *ProjectHandler {
	return &ProjectHandler{Service: s}
}

func (h *ProjectHandler) RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api", middleware.Auth())
	{
		api.GET("/projects", h.ListProjects)
		api.POST("/projects", h.CreateProject)
		api.GET("/projects/:id", h.GetProject)
		api.PATCH("/projects/:id", h.UpdateProject)
		api.POST("/projects/:id/archive", h.ArchiveProject)
		api.POST("/projects/:id/restore", h.RestoreProject)
		api.POST("/projects/:id/toggle-completed", h.ToggleCompleted)
		api.DELETE("/projects/:id", h.DeleteProject)
		api.POST("/projects/from-tasks", h.CreateFromTasks)
	}
}

func (h *ProjectHandler) ListProjects(c *gin.Context) {
	ownerID, ok := userIDFromContext(c)
	if !ok {
		return
	}
	includeArchived := c.DefaultQuery("include_archived", "false") == "true"
	projects, err := h.Service.List(ownerID, includeArchived)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, projects)
}

func (h *ProjectHandler) CreateProject(c *gin.Context) {
	ownerID, ok := userIDFromContext(c)
	if !ok {
		return
	}
	var payload models.ProjectInput
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	project, err := h.Service.Create(ownerID, &payload)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, project)
}

func (h *ProjectHandler) GetProject(c *gin.Context) {
	ownerID, ok := userIDFromContext(c)
	if !ok {
		return
	}
	projectID, ok := parseProjectID(c)
	if !ok {
		return
	}
	project, err := h.Service.Get(ownerID, projectID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, project)
}

func (h *ProjectHandler) UpdateProject(c *gin.Context) {
	ownerID, ok := userIDFromContext(c)
	if !ok {
		return
	}
	projectID, ok := parseProjectID(c)
	if !ok {
		return
	}
	var payload models.ProjectInput
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	project, err := h.Service.Update(ownerID, projectID, &payload)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, project)
}

func (h *ProjectHandler) ArchiveProject(c *gin.Context) {
	ownerID, ok := userIDFromContext(c)
	if !ok {
		return
	}
	projectID, ok := parseProjectID(c)
	if !ok {
		return
	}
	if err := h.Service.Archive(ownerID, projectID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *ProjectHandler) RestoreProject(c *gin.Context) {
	ownerID, ok := userIDFromContext(c)
	if !ok {
		return
	}
	projectID, ok := parseProjectID(c)
	if !ok {
		return
	}
	if err := h.Service.Restore(ownerID, projectID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *ProjectHandler) ToggleCompleted(c *gin.Context) {
	ownerID, ok := userIDFromContext(c)
	if !ok {
		return
	}
	projectID, ok := parseProjectID(c)
	if !ok {
		return
	}
	cascade := c.DefaultQuery("cascade", "cancel_unfinished")
	project, err := h.Service.ToggleCompleted(ownerID, projectID, cascade)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, project)
}

func (h *ProjectHandler) DeleteProject(c *gin.Context) {
	ownerID, ok := userIDFromContext(c)
	if !ok {
		return
	}
	projectID, ok := parseProjectID(c)
	if !ok {
		return
	}
	if err := h.Service.HardDelete(ownerID, projectID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *ProjectHandler) CreateFromTasks(c *gin.Context) {
	ownerID, ok := userIDFromContext(c)
	if !ok {
		return
	}
	var payload models.ProjectFromTasksPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	project, err := h.Service.CreateFromTasks(ownerID, payload)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, project)
}

func parseProjectID(c *gin.Context) (uint, bool) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return 0, false
	}
	return uint(id), true
}
