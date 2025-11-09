package storage

import (
	"github.com/spozitivom/taskmanager/internal/models"
	"gorm.io/gorm"
)

// TaskStorage отвечает за работу с задачами в БД (CRUD)
type TaskStorage struct {
	db *gorm.DB
}

// NewTaskStorage создаёт новый экземпляр хранилища задач
func NewTaskStorage(db *gorm.DB) *TaskStorage {
	return &TaskStorage{db: db}
}

// GetAllSorted возвращает все задачи, отсортированные по created_at
func (s *TaskStorage) GetAllSorted(sortOrder string) ([]models.Task, error) {
	if sortOrder != "asc" && sortOrder != "desc" {
		sortOrder = "desc"
	}
	var tasks []models.Task
	err := s.db.Order("created_at " + sortOrder).Find(&tasks).Error
	return tasks, err
}

// 🔍 GetFiltered — возвращает задачи по фильтрам + сортировке
func (s *TaskStorage) GetFiltered(sortOrder, status, priority, stage string, projectID *uint) ([]models.Task, error) {
	if sortOrder != "asc" && sortOrder != "desc" {
		sortOrder = "desc"
	}

	query := s.db.Model(&models.Task{})

	if status != "" {
		query = query.Where("status = ?", status)
	}
	if priority != "" {
		query = query.Where("priority = ?", priority)
	}
	if stage != "" {
		query = query.Where("stage = ?", stage)
	}
	if projectID != nil {
		if *projectID == 0 {
			query = query.Where("project_id IS NULL")
		} else {
			query = query.Where("project_id = ?", *projectID)
		}
	}

	var tasks []models.Task
	err := query.Order("created_at " + sortOrder).Find(&tasks).Error
	return tasks, err
}

// GetByID возвращает задачу по ID
func (s *TaskStorage) GetByID(id uint) (*models.Task, error) {
	var task models.Task
	err := s.db.First(&task, id).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

// Create сохраняет новую задачу в БД
func (s *TaskStorage) Create(task *models.Task) error {
	return s.db.Create(task).Error
}

// Update сохраняет изменения существующей задачи
func (s *TaskStorage) Update(task *models.Task) error {
	return s.db.Save(task).Error
}

// Delete удаляет задачу по ID
func (s *TaskStorage) Delete(id uint) error {
	return s.db.Delete(&models.Task{}, id).Error
}

func (s *TaskStorage) BulkDelete(ids []uint) error {
	if len(ids) == 0 {
		return nil
	}
	return s.db.Where("id IN ?", ids).Delete(&models.Task{}).Error
}

func (s *TaskStorage) GetByIDs(ids []uint) ([]models.Task, error) {
	if len(ids) == 0 {
		return []models.Task{}, nil
	}
	var tasks []models.Task
	if err := s.db.Where("id IN ?", ids).Find(&tasks).Error; err != nil {
		return nil, err
	}
	return tasks, nil
}

func (s *TaskStorage) SaveAll(tasks []models.Task) error {
	if len(tasks) == 0 {
		return nil
	}
	for _, task := range tasks {
		if err := s.db.Save(&task).Error; err != nil {
			return err
		}
	}
	return nil
}

func (s *TaskStorage) CountByProject(projectID uint) (int64, error) {
	var count int64
	if err := s.db.Model(&models.Task{}).Where("project_id = ?", projectID).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func (s *TaskStorage) SoftDeleteByProject(projectID uint) error {
	return s.db.Where("project_id = ?", projectID).Delete(&models.Task{}).Error
}

func (s *TaskStorage) RestoreByProject(projectID uint) error {
	return s.db.Unscoped().Model(&models.Task{}).
		Where("project_id = ?", projectID).
		Update("deleted_at", nil).Error
}
