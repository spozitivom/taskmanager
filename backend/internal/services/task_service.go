package services

import (
	"errors"
	"strings"

	"github.com/spozitivom/taskmanager/internal/models"
	"github.com/spozitivom/taskmanager/internal/storage"
)

// TaskService реализует бизнес-логику для задач.
type TaskService struct {
	storage *storage.TaskStorage
}

// NewTaskService создаёт новый экземпляр TaskService.
func NewTaskService(storage *storage.TaskStorage) *TaskService {
	return &TaskService{storage: storage}
}

// GetTasks возвращает список всех задач, с сортировкой по дате создания.
func (s *TaskService) GetTasks(sortOrder string) ([]models.Task, error) {
	return s.storage.GetAllSorted(sortOrder)
}

// GetFilteredTasks — получить задачи с учётом фильтров.
func (s *TaskService) GetFilteredTasks(sortOrder, status, priority, stage string) ([]models.Task, error) {
	return s.storage.GetFiltered(sortOrder, status, priority, stage)
}

// GetTaskByID ищет и возвращает задачу по её ID.
func (s *TaskService) GetTaskByID(id uint) (*models.Task, error) {
	return s.storage.GetByID(id)
}

// CreateTask сохраняет новую задачу в базе данных.
// Здесь же можно мягко нормализовать вход и применить дефолты (на случай, если фронт их не прислал).
func (s *TaskService) CreateTask(task *models.Task) error {
	task.Title = strings.TrimSpace(task.Title)
	if task.Title == "" {
		return errors.New("title is required")
	}
	if task.Status == "" {
		task.Status = models.StatusTodo
	}
	priority, err := models.NormalizePriority(task.Priority)
	if err != nil {
		return err
	}
	task.Priority = priority
	stage, err := models.NormalizeStage(task.Stage)
	if err != nil {
		return err
	}
	task.Stage = stage
	// Checked по умолчанию false — задаётся через gorm default, оставляем как есть.
	return s.storage.Create(task)
}

// PatchTask частично обновляет существующую задачу по ID.
// Меняем только те поля, которые действительно пришли (указатели != nil) —
// это решает проблему, когда Checked принудительно сбрасывался в false.
func (s *TaskService) PatchTask(id uint, patch models.TaskPatch) (*models.Task, error) {
	task, err := s.storage.GetByID(id)
	if err != nil {
		return nil, err
	}

	// Доп. нормализация: можно триммить строки, если они пришли.
	if patch.Title != nil {
		t := strings.TrimSpace(*patch.Title)
		patch.Title = &t
	}

	patch.ApplyTo(task)

	// Мини-валидация после применения патча (опционально, но полезно).
	if strings.TrimSpace(task.Title) == "" {
		return nil, errors.New("title cannot be empty")
	}
	if task.Priority, err = models.NormalizePriority(task.Priority); err != nil {
		return nil, err
	}
	if task.Stage, err = models.NormalizeStage(task.Stage); err != nil {
		return nil, err
	}

	if err := s.storage.Update(task); err != nil {
		return nil, err
	}
	return task, nil
}

// DeleteTask удаляет задачу по ID.
func (s *TaskService) DeleteTask(id uint) error {
	return s.storage.Delete(id)
}
