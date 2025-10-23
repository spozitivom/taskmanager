package services

import (
	"github.com/spozitivom/taskmanager/internal/models"
	"github.com/spozitivom/taskmanager/internal/storage"
)

// TaskService реализует бизнес-логику для задач.
type TaskService struct {
	storage *storage.TaskStorage
}

// NewTaskService создаёт новый экземпляр TaskService
func NewTaskService(storage *storage.TaskStorage) *TaskService {
	return &TaskService{storage: storage}
}

// GetTasks возвращает список всех задач, отсортированных по дате создания.
func (s *TaskService) GetTasks(sortOrder string) ([]models.Task, error) {
	return s.storage.GetAllSorted(sortOrder)
}

// 🔍 GetFilteredTasks — получить задачи с учётом фильтров
func (s *TaskService) GetFilteredTasks(sortOrder, status, priority, stage string) ([]models.Task, error) {
	return s.storage.GetFiltered(sortOrder, status, priority, stage)
}

// GetTaskByID ищет и возвращает задачу по её ID.
func (s *TaskService) GetTaskByID(id uint) (*models.Task, error) {
	return s.storage.GetByID(id)
}

// CreateTask сохраняет новую задачу в базе данных.
func (s *TaskService) CreateTask(task *models.Task) error {
	return s.storage.Create(task)
}

// UpdateTask обновляет существующую задачу по ID.
func (s *TaskService) UpdateTask(id uint, input *models.Task) (*models.Task, error) {
	task, err := s.storage.GetByID(id)
	if err != nil {
		return nil, err
	}

	// Обновляем только непустые поля (можно сделать через вспомогательную функцию или вручную)
	if input.Title != "" {
		task.Title = input.Title
	}
	task.Checked = input.Checked // логическое поле можно просто обновлять
	if input.Description != "" {
		task.Description = input.Description
	}
	if input.Status != "" {
		task.Status = input.Status
	}
	if input.Priority != "" {
		task.Priority = input.Priority
	}
	if input.Stage != "" {
		task.Stage = input.Stage
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
