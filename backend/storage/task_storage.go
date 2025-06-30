// backend/storage/task_storage.go
package storage

import (
	"github.com/spozitivom/taskmanager/models"
	"gorm.io/gorm"
)

type TaskStorage struct {
	DB *gorm.DB
}

func NewTaskStorage(db *gorm.DB) *TaskStorage {
	return &TaskStorage{DB: db}
}

func (s *TaskStorage) GetAllTasks(order string) ([]models.Task, error) {
	var tasks []models.Task
	if err := s.DB.Order("created_at " + order).Find(&tasks).Error; err != nil {
		return nil, err
	}
	return tasks, nil
}

func (s *TaskStorage) CreateTask(task *models.Task) error {
	return s.DB.Create(task).Error
}

func (s *TaskStorage) UpdateTask(task *models.Task) error {
	return s.DB.Save(task).Error
}

func (s *TaskStorage) DeleteTask(id int) error {
	return s.DB.Delete(&models.Task{}, id).Error
}

func (s *TaskStorage) GetTaskByID(id int) (*models.Task, error) {
	var task models.Task
	if err := s.DB.First(&task, id).Error; err != nil {
		return nil, err
	}
	return &task, nil
}
