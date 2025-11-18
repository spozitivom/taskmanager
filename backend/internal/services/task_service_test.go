package services

import (
	"testing"
	"time"

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

func TestTaskService_PatchTaskAppliesNormalization(t *testing.T) {
	db := setupTestDB(t)
	taskStorage := storage.NewTaskStorage(db)
	service := NewTaskService(taskStorage)

	original := &models.Task{
		Title:          "Initial   ",
		Description:    "Draft",
		Stage:          models.StageDefault,
		Status:         models.StatusInProgress,
		Priority:       models.PriorityMedium,
		PreviousStatus: "",
	}
	require.NoError(t, taskStorage.Create(original))

	title := "  Updated spec  "
	description := "New scope"
	stage := "   review  "
	status := models.StatusCompleted
	priority := "HIGH"
	start := time.Now().Add(24 * time.Hour).UTC().Truncate(time.Hour)
	end := start.Add(2 * time.Hour)

	patched, err := service.PatchTask(original.ID, models.TaskPatch{
		Title:       &title,
		Description: &description,
		Stage:       &stage,
		Status:      &status,
		Priority:    &priority,
		StartAt: models.OptionalTime{
			Value:   &start,
			Present: true,
		},
		EndAt: models.OptionalTime{
			Value:   &end,
			Present: true,
		},
	})
	require.NoError(t, err)
	require.Equal(t, "Updated spec", patched.Title)
	require.Equal(t, "New scope", patched.Description)
	require.Equal(t, "review", patched.Stage)
	require.Equal(t, models.StatusCompleted, patched.Status)
	require.Equal(t, models.StatusInProgress, patched.PreviousStatus)
	require.Equal(t, models.PriorityHigh, patched.Priority)

	fromDB, err := taskStorage.GetByID(original.ID)
	require.NoError(t, err)
	require.Equal(t, patched.Title, fromDB.Title)
	require.Equal(t, patched.Stage, fromDB.Stage)
	require.Equal(t, patched.Priority, fromDB.Priority)
	require.Equal(t, patched.Status, fromDB.Status)
	require.Equal(t, patched.PreviousStatus, fromDB.PreviousStatus)
	require.NotNil(t, patched.StartAt)
	require.NotNil(t, patched.EndAt)
	require.NotNil(t, fromDB.StartAt)
	require.NotNil(t, fromDB.EndAt)
	require.Equal(t, patched.StartAt.UTC(), fromDB.StartAt.UTC())
	require.Equal(t, patched.EndAt.UTC(), fromDB.EndAt.UTC())
}

func TestTaskService_PatchTaskRejectsEmptyTitle(t *testing.T) {
	db := setupTestDB(t)
	taskStorage := storage.NewTaskStorage(db)
	service := NewTaskService(taskStorage)

	task := &models.Task{
		Title:    "Valid",
		Status:   models.StatusTodo,
		Priority: models.PriorityMedium,
		Stage:    models.StageDefault,
	}
	require.NoError(t, taskStorage.Create(task))

	empty := "   "
	_, err := service.PatchTask(task.ID, models.TaskPatch{
		Title: &empty,
	})
	require.Error(t, err)

	stored, err := taskStorage.GetByID(task.ID)
	require.NoError(t, err)
	require.Equal(t, "Valid", stored.Title)
}
