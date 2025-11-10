package services

import (
	"testing"

	"github.com/spozitivom/taskmanager/internal/models"
	"github.com/spozitivom/taskmanager/internal/storage"
	"github.com/stretchr/testify/require"
)

func TestTaskService_CreateTaskNormalizesInput(t *testing.T) {
	db := setupTestDB(t)
	taskStorage := storage.NewTaskStorage(db)
	service := NewTaskService(taskStorage)

	task := &models.Task{
		Title:     "  Write specs  ",
		Priority:  "HIGH",
		Stage:     "   ",
		Status:    "",
		ProjectID: nil,
	}
	err := service.CreateTask(task)
	require.NoError(t, err)

	stored, err := taskStorage.GetAllSorted("desc")
	require.NoError(t, err)
	require.Len(t, stored, 1)
	require.Equal(t, "Write specs", stored[0].Title)
	require.Equal(t, models.PriorityHigh, stored[0].Priority)
	require.Equal(t, models.StageDefault, stored[0].Stage)
	require.Equal(t, models.StatusTodo, stored[0].Status)
}

func TestTaskService_BulkSetStatus(t *testing.T) {
	db := setupTestDB(t)
	taskStorage := storage.NewTaskStorage(db)
	service := NewTaskService(taskStorage)

	t1 := &models.Task{Title: "API", Priority: models.PriorityMedium, Stage: models.StageDefault, Status: models.StatusTodo}
	t2 := &models.Task{Title: "UI", Priority: models.PriorityMedium, Stage: models.StageDefault, Status: models.StatusInProgress}
	require.NoError(t, taskStorage.Create(t1))
	require.NoError(t, taskStorage.Create(t2))

	err := service.BulkSetStatus([]uint{t1.ID, t2.ID}, models.StatusCompleted)
	require.NoError(t, err)

	updated1, err := taskStorage.GetByID(t1.ID)
	require.NoError(t, err)
	require.Equal(t, models.StatusCompleted, updated1.Status)

	updated2, err := taskStorage.GetByID(t2.ID)
	require.NoError(t, err)
	require.Equal(t, models.StatusCompleted, updated2.Status)
	require.Equal(t, models.StatusInProgress, updated2.PreviousStatus)
}
