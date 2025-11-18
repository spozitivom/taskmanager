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

func init() {
	gin.SetMode(gin.TestMode)
}

func TestTaskHandler_GetTasksFiltersProjectNone(t *testing.T) {
	handler, deps := newTaskHandlerTestEnv(t)

	taskWithoutProject := models.Task{
		Title:    "Inbox",
		Status:   models.StatusTodo,
		Priority: models.PriorityMedium,
		Stage:    models.StageDefault,
	}
	require.NoError(t, deps.tasks.Create(&taskWithoutProject))

	projectID := uint(42)
	taskWithProject := models.Task{
		Title:     "Roadmap",
		Status:    models.StatusTodo,
		Priority:  models.PriorityLow,
		Stage:     models.StageDefault,
		ProjectID: &projectID,
	}
	require.NoError(t, deps.tasks.Create(&taskWithProject))

	c, w := newJSONContext(http.MethodGet, "/api/tasks?project_id=none", nil)
	c.Set("userID", uint(7))

	handler.GetTasks(c)

	require.Equal(t, http.StatusOK, w.Code)
	var resp []models.Task
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	require.Len(t, resp, 1)
	require.Equal(t, taskWithoutProject.ID, resp[0].ID)
}

func TestTaskHandler_BulkAssignToProject(t *testing.T) {
	handler, deps := newTaskHandlerTestEnv(t)

	owner := models.User{ID: 1, Email: "owner@example.com", Username: "owner", Password: "pwd", MaxProjects: 5}
	require.NoError(t, deps.db.Create(&owner).Error)

	project := models.Project{
		OwnerID:  owner.ID,
		Title:    "Website",
		Status:   models.ProjectStatusActive,
		Priority: models.ProjectPriorityMedium,
	}
	require.NoError(t, deps.db.Create(&project).Error)

	task := models.Task{Title: "Write brief", Status: models.StatusTodo, Priority: models.PriorityMedium, Stage: models.StageDefault}
	require.NoError(t, deps.tasks.Create(&task))

	payload := map[string]any{
		"ids":               []uint{task.ID},
		"project_id":        project.ID,
		"reassign_attached": true,
	}
	body, err := json.Marshal(payload)
	require.NoError(t, err)

	c, w := newJSONContext(http.MethodPost, "/api/tasks/bulk/assign", bytes.NewReader(body))
	c.Set("userID", owner.ID)

	handler.BulkAssign(c)
	flushWriter(c)

	require.Equalf(t, http.StatusNoContent, w.Code, "body=%s", w.Body.String())
	reloaded, err := deps.tasks.GetByID(task.ID)
	require.NoError(t, err)
	require.NotNil(t, reloaded.ProjectID)
	require.Equal(t, project.ID, *reloaded.ProjectID)
}

func TestTaskHandler_BulkAssignUnassignsWhenProjectMissing(t *testing.T) {
	handler, deps := newTaskHandlerTestEnv(t)

	owner := models.User{ID: 1, Email: "owner@example.com", Username: "owner", Password: "pwd", MaxProjects: 5}
	require.NoError(t, deps.db.Create(&owner).Error)

	project := models.Project{
		OwnerID:  owner.ID,
		Title:    "Website",
		Status:   models.ProjectStatusActive,
		Priority: models.ProjectPriorityMedium,
	}
	require.NoError(t, deps.db.Create(&project).Error)

	assignedID := project.ID
	task := models.Task{
		Title:     "Wireframes",
		Status:    models.StatusInProgress,
		Priority:  models.PriorityHigh,
		Stage:     models.StageDefault,
		ProjectID: &assignedID,
	}
	require.NoError(t, deps.tasks.Create(&task))

	payload := map[string]any{
		"ids": []uint{task.ID},
	}
	body, err := json.Marshal(payload)
	require.NoError(t, err)

	c, w := newJSONContext(http.MethodPost, "/api/tasks/bulk/assign", bytes.NewReader(body))
	c.Set("userID", owner.ID)

	handler.BulkAssign(c)
	flushWriter(c)

	require.Equalf(t, http.StatusNoContent, w.Code, "body=%s", w.Body.String())
	reloaded, err := deps.tasks.GetByID(task.ID)
	require.NoError(t, err)
	require.Nil(t, reloaded.ProjectID)
}

func TestTaskHandler_BulkAssignValidatesIDs(t *testing.T) {
	handler, _ := newTaskHandlerTestEnv(t)

	payload := map[string]any{
		"ids": []uint{},
	}
	body, err := json.Marshal(payload)
	require.NoError(t, err)

	c, w := newJSONContext(http.MethodPost, "/api/tasks/bulk/assign", bytes.NewReader(body))
	c.Set("userID", uint(1))

	handler.BulkAssign(c)
	flushWriter(c)

	require.Equal(t, http.StatusBadRequest, w.Code)
}

type handlerTestDeps struct {
	db       *gorm.DB
	tasks    *storage.TaskStorage
	projects *storage.ProjectStorage
	users    *storage.UserStorage
}

func newTaskHandlerTestEnv(t *testing.T) (*TaskHandler, handlerTestDeps) {
	t.Helper()
	dsn := fmt.Sprintf("file:handler-tests-%d?mode=memory&cache=shared", time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&models.User{}, &models.Project{}, &models.Task{}))

	taskStorage := storage.NewTaskStorage(db)
	projectStorage := storage.NewProjectStorage(db)
	userStorage := storage.NewUserStorage(db)

	taskService := services.NewTaskService(taskStorage)
	projectService := services.NewProjectService(projectStorage, taskStorage, userStorage)

	handler := NewTaskHandler(taskService, projectService)
	return handler, handlerTestDeps{
		db:       db,
		tasks:    taskStorage,
		projects: projectStorage,
		users:    userStorage,
	}
}

func newJSONContext(method, target string, body *bytes.Reader) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	var reader *bytes.Reader
	if body == nil {
		reader = bytes.NewReader(nil)
	} else {
		reader = body
	}
	req := httptest.NewRequest(method, target, reader)
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	return c, w
}

func flushWriter(c *gin.Context) {
	c.Writer.WriteHeaderNow()
}
