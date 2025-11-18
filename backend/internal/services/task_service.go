package services

import (
	"errors"
	"strings"
	"time"

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
func (s *TaskService) GetFilteredTasks(sortOrder, status, priority, stage string, projectID *uint) ([]models.Task, error) {
	return s.storage.GetFiltered(sortOrder, status, priority, stage, projectID)
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
	status, err := models.NormalizeTaskStatus(task.Status)
	if err != nil {
		return err
	}
	task.Status = status
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
	if err := normalizeTaskSchedule(task); err != nil {
		return err
	}
	// Completion статус по умолчанию — активный (todo), additional fields заполняются ниже.
	return s.storage.Create(task)
}

// PatchTask частично обновляет существующую задачу по ID.
// Меняем только те поля, которые действительно пришли (указатели != nil).
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
	if task.Status, err = models.NormalizeTaskStatus(task.Status); err != nil {
		return nil, err
	}
	if err := normalizeTaskSchedule(task); err != nil {
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

// BulkDelete — пакетное удаление задач.
func (s *TaskService) BulkDelete(ids []uint) error {
	return s.storage.BulkDelete(ids)
}

// BulkSetStatus обновляет статус сразу у нескольких задач.
func (s *TaskService) BulkSetStatus(ids []uint, status string) error {
	tasks, err := s.storage.GetByIDs(ids)
	if err != nil {
		return err
	}
	if len(tasks) == 0 {
		return nil
	}
	nextStatus, err := models.NormalizeTaskStatus(status)
	if err != nil {
		return err
	}
	for i := range tasks {
		tasks[i].ApplyStatusTransition(nextStatus)
	}
	return s.storage.SaveAll(tasks)
}

// UnassignFromProject убирает связи задач с проектом.
func (s *TaskService) UnassignFromProject(ids []uint) error {
	tasks, err := s.storage.GetByIDs(ids)
	if err != nil {
		return err
	}
	for i := range tasks {
		tasks[i].ProjectID = nil
	}
	return s.storage.SaveAll(tasks)
}

func normalizeTaskSchedule(task *models.Task) error {
	if task.StartAt != nil && task.EndAt != nil {
		if task.EndAt.Before(*task.StartAt) {
			return errors.New("end_at must be greater than or equal to start_at")
		}
	}
	if task.StartAt == nil && task.EndAt != nil {
		start := *task.EndAt
		task.StartAt = &start
	}
	if task.EndAt == nil && task.StartAt != nil {
		end := *task.StartAt
		task.EndAt = &end
	}
	if task.AllDay {
		if task.StartAt != nil {
			start := startOfDayUTC(*task.StartAt)
			task.StartAt = &start
		}
		if task.EndAt != nil {
			end := endOfDayUTC(*task.EndAt)
			task.EndAt = &end
		}
	}
	return nil
}

func startOfDayUTC(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

func endOfDayUTC(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 23, 59, 59, int(time.Second-time.Nanosecond), time.UTC)
}
