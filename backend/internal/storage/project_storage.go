package storage

import (
	"time"

	"github.com/spozitivom/taskmanager/internal/models"
	"gorm.io/gorm"
)

type ProjectStorage struct {
	db *gorm.DB
}

func NewProjectStorage(db *gorm.DB) *ProjectStorage {
	return &ProjectStorage{db: db}
}

func (s *ProjectStorage) List(ownerID uint, includeArchived bool) ([]models.Project, error) {
	query := s.db.Where("owner_id = ?", ownerID)
	if !includeArchived {
		query = query.Where("archived_at IS NULL")
	}
	var projects []models.Project
	if err := query.Order("created_at DESC").Find(&projects).Error; err != nil {
		return nil, err
	}
	return projects, nil
}

func (s *ProjectStorage) CountByOwner(ownerID uint) (int64, error) {
	var count int64
	err := s.db.Model(&models.Project{}).Where("owner_id = ? AND deleted_at IS NULL", ownerID).Count(&count).Error
	return count, err
}

func (s *ProjectStorage) Create(p *models.Project) error {
	return s.db.Create(p).Error
}

func (s *ProjectStorage) Get(ownerID, id uint) (*models.Project, error) {
	var project models.Project
	if err := s.db.Where("owner_id = ?", ownerID).First(&project, id).Error; err != nil {
		return nil, err
	}
	return &project, nil
}

func (s *ProjectStorage) Update(project *models.Project) error {
	return s.db.Save(project).Error
}

func (s *ProjectStorage) Archive(project *models.Project) error {
	now := time.Now()
	project.ArchivedAt = &now
	return s.db.Save(project).Error
}

func (s *ProjectStorage) Restore(project *models.Project) error {
	project.ArchivedAt = nil
	return s.db.Save(project).Error
}

func (s *ProjectStorage) HardDelete(project *models.Project) error {
	return s.db.Unscoped().Delete(project).Error
}
