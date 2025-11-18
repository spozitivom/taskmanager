package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/spozitivom/taskmanager/internal/models"
	"github.com/spozitivom/taskmanager/internal/services"
	"github.com/spozitivom/taskmanager/internal/storage"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestIntegration_TaskCRUD(t *testing.T) {
	router, db := setupTaskRouter(t)
	token := mustJWT(t, 1, "user")

	// Create
	createPayload := map[string]any{
		"title":       "Spec draft",
		"description": "Describe API",
		"status":      models.StatusTodo,
		"priority":    models.PriorityMedium,
		"stage":       models.StageDefault,
	}
	var created models.Task
	doAuthorizedJSON(t, router, token, http.MethodPost, "/api/tasks", createPayload, http.StatusCreated, &created)
	require.NotZero(t, created.ID)

	// Read list
	var tasks []models.Task
	doAuthorizedJSON(t, router, token, http.MethodGet, "/api/tasks", nil, http.StatusOK, &tasks)
	require.Len(t, tasks, 1)

	// Update
	updatePayload := map[string]any{"title": "Spec draft v2"}
	var updated models.Task
	doAuthorizedJSON(t, router, token, http.MethodPatch, "/api/tasks/"+idToStr(created.ID), updatePayload, http.StatusOK, &updated)
	require.Equal(t, "Spec draft v2", updated.Title)

	// Delete
	doAuthorizedJSON(t, router, token, http.MethodDelete, "/api/tasks/"+idToStr(created.ID), nil, http.StatusNoContent, nil)

	// Ensure deleted in list
	doAuthorizedJSON(t, router, token, http.MethodGet, "/api/tasks", nil, http.StatusOK, &tasks)
	require.Empty(t, tasks)

	_ = db // keep for symmetry; sqlite is in-memory and closes with router
}

func TestIntegration_ProjectCRUD(t *testing.T) {
	handler, deps := newProjectHandlerTestEnv(t)

	// Create
	created, err := handler.Service.Create(1, &models.ProjectInput{
		Title:    "Website",
		Status:   models.ProjectStatusActive,
		Priority: models.ProjectPriorityMedium,
	})
	require.NoError(t, err)
	require.NotZero(t, created.ID)

	// Read single via service
	fetched, err := handler.Service.Get(1, created.ID)
	require.NoError(t, err)
	require.Equal(t, created.ID, fetched.ID)

	// Update
	updated, err := handler.Service.Update(1, created.ID, &models.ProjectInput{
		Title:       fetched.Title,
		Description: "Landing page redesign",
		Status:      fetched.Status,
		Priority:    fetched.Priority,
		TasksLimit:  fetched.TasksLimit,
	})
	require.NoError(t, err)
	require.Equal(t, "Landing page redesign", updated.Description)

	// Delete
	require.NoError(t, handler.Service.HardDelete(1, created.ID))

	// Ensure gone
	var remaining []models.Project
	require.NoError(t, deps.db.Where("id = ?", created.ID).Find(&remaining).Error)
	require.Empty(t, remaining)
}

func TestIntegration_ProjectDeleteCascadesTasks(t *testing.T) {
	handler, deps := newProjectHandlerTestEnv(t)

	created, err := handler.Service.Create(1, &models.ProjectInput{
		Title:    "Cascade",
		Status:   models.ProjectStatusActive,
		Priority: models.ProjectPriorityMedium,
	})
	require.NoError(t, err)

	task := models.Task{
		Title:     "Child",
		Status:    models.StatusTodo,
		Priority:  models.PriorityMedium,
		Stage:     models.StageDefault,
		ProjectID: &created.ID,
	}
	require.NoError(t, deps.tasks.Create(&task))

	require.NoError(t, handler.Service.HardDelete(1, created.ID))

	var active []models.Task
	require.NoError(t, deps.db.Where("project_id = ?", created.ID).Find(&active).Error)
	require.Empty(t, active)

	var deleted []models.Task
	require.NoError(t, deps.db.Unscoped().Where("project_id = ?", created.ID).Find(&deleted).Error)
	require.Len(t, deleted, 1)
	require.True(t, deleted[0].DeletedAt.Valid)
}

// ----------------- helpers -----------------

func setupTaskRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	t.Setenv("JWT_SECRET", "insecure-test-secret")
	gin.SetMode(gin.TestMode)

	dsn := fmt.Sprintf("file:integration-tests-%d?mode=memory&cache=shared", time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&models.User{}, &models.Project{}, &models.Task{}))
	require.NoError(t, db.Create(&models.User{
		ID:       1,
		Email:    "user@example.com",
		Username: "user",
		Password: "hash",
		Role:     "user",
	}).Error)

	taskStorage := storage.NewTaskStorage(db)
	projectStorage := storage.NewProjectStorage(db)
	userStorage := storage.NewUserStorage(db)

	taskService := services.NewTaskService(taskStorage)
	projectService := services.NewProjectService(projectStorage, taskStorage, userStorage)

	taskHandler := NewTaskHandler(taskService, projectService)
	projectHandler := NewProjectHandler(projectService)

	router := gin.New()
	taskHandler.RegisterRoutes(router)
	projectHandler.RegisterRoutes(router)
	return router, db
}

func newProjectHandlerTestEnv(t *testing.T) (*ProjectHandler, handlerTestDeps) {
	t.Helper()
	dsn := fmt.Sprintf("file:project-handler-%d?mode=memory&cache=shared", time.Now().UnixNano())
	dbConn, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, dbConn.AutoMigrate(&models.User{}, &models.Project{}, &models.Task{}))
	require.NoError(t, dbConn.Create(&models.User{
		ID:          1,
		Email:       "owner@example.com",
		Username:    "owner",
		Password:    "hash",
		MaxProjects: 10,
		Role:        "user",
	}).Error)

	taskStorage := storage.NewTaskStorage(dbConn)
	projectStorage := storage.NewProjectStorage(dbConn)
	userStorage := storage.NewUserStorage(dbConn)

	projectService := services.NewProjectService(projectStorage, taskStorage, userStorage)
	return NewProjectHandler(projectService), handlerTestDeps{
		db:       dbConn,
		tasks:    taskStorage,
		projects: projectStorage,
		users:    userStorage,
	}
}

func doAuthorizedJSON(t *testing.T, router *gin.Engine, token, method, path string, payload any, wantStatus int, out any) {
	t.Helper()
	var body *bytes.Reader
	if payload != nil {
		raw, err := json.Marshal(payload)
		require.NoError(t, err)
		body = bytes.NewReader(raw)
	} else {
		body = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, body)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	if payload != nil {
		req.ContentLength = int64(body.Len())
	}

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if wantStatus >= 0 {
		require.Equalf(t, wantStatus, w.Code, "body=%s", w.Body.String())
	}
	if out != nil && w.Body.Len() > 0 {
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), out))
	}
}

func mustJWT(t *testing.T, userID uint, role string) string {
	t.Helper()
	token, err := services.GenerateJWT(userID, role)
	require.NoError(t, err)
	return token
}

func idToStr(id uint) string {
	return fmt.Sprintf("%d", id)
}
