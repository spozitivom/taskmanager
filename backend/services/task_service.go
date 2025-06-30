// backend/services/task_service.go
package services

import (
	"github.com/spozitivom/taskmanager/models"
	"github.com/spozitivom/taskmanager/storage"
)

type TaskService struct {
	Storage *storage.TaskStorage
}

func NewTaskService(storage *storage.TaskStorage) *TaskService {
	return &TaskService{Storage: storage}
}

func (s *TaskService) GetTasks(order string) ([]models.Task, error) {
	return s.Storage.GetAllTasks(order)
}

func (s *TaskService) CreateTask(task *models.Task) error {
	return s.Storage.CreateTask(task)
}

func (s *TaskService) UpdateTask(id int, input *models.Task) (*models.Task, error) {
	task, err := s.Storage.GetTaskByID(id)
	if err != nil {
		return nil, err
	}

	task.Checked = input.Checked
	task.Title = input.Title

	err = s.Storage.UpdateTask(task)
	return task, err
}

func (s *TaskService) DeleteTask(id int) error {
	return s.Storage.DeleteTask(id)
}
