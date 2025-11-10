package services

import (
	"testing"

	"github.com/spozitivom/taskmanager/internal/models"
	"github.com/spozitivom/taskmanager/internal/storage"
	"github.com/stretchr/testify/require"
)

func TestProjectService_CreateRespectsOwnerLimit(t *testing.T) {
	db := setupTestDB(t)
	require.NoError(t, db.Create(&models.User{
		ID:          1,
		Email:       "owner@example.com",
		Username:    "owner",
		Password:    "secret",
		MaxProjects: 1,
	}).Error)

	service := NewProjectService(
		storage.NewProjectStorage(db),
		storage.NewTaskStorage(db),
		storage.NewUserStorage(db),
	)

	input := &models.ProjectInput{
		Title:    "CRM",
		Status:   models.ProjectStatusActive,
		Priority: models.ProjectPriorityMedium,
	}
	_, err := service.Create(1, input)
	require.NoError(t, err)

	_, err = service.Create(1, input)
	require.ErrorIs(t, err, ErrProjectLimit)
}

func TestProjectService_ToggleCompletedCascade(t *testing.T) {
	db := setupTestDB(t)
	require.NoError(t, db.Create(&models.User{
		ID:          2,
		Email:       "boss@example.com",
		Username:    "boss",
		Password:    "secret",
		MaxProjects: 5,
	}).Error)

	projectStorage := storage.NewProjectStorage(db)
	taskStorage := storage.NewTaskStorage(db)
	userStorage := storage.NewUserStorage(db)
	service := NewProjectService(projectStorage, taskStorage, userStorage)

	project, err := service.Create(2, &models.ProjectInput{
		Title:      "Marketing push",
		Status:     models.ProjectStatusActive,
		Priority:   models.ProjectPriorityHigh,
		TasksLimit: 10,
	})
	require.NoError(t, err)

	tasks := []models.Task{
		{Title: "Prepare landing", Status: models.StatusTodo, Priority: models.PriorityMedium, Stage: models.StageDefault},
		{Title: "QA checklist", Status: models.StatusCompleted, Priority: models.PriorityLow, Stage: models.StageDefault},
	}
	for i := range tasks {
		tasks[i].ProjectID = &project.ID
		require.NoError(t, taskStorage.Create(&tasks[i]))
	}

	updated, err := service.ToggleCompleted(2, project.ID, "cancel_unfinished")
	require.NoError(t, err)
	require.Equal(t, models.ProjectStatusCompleted, updated.Status)

	stored, err := taskStorage.GetFiltered("asc", "", "", "", &project.ID)
	require.NoError(t, err)
	require.Len(t, stored, 2)

	statusByTitle := map[string]string{}
	for _, task := range stored {
		statusByTitle[task.Title] = task.Status
	}
	require.Equal(t, models.StatusCancelled, statusByTitle["Prepare landing"])
	require.Equal(t, models.StatusCompleted, statusByTitle["QA checklist"])
}
