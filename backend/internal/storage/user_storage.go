package storage

import (
	"github.com/spozitivom/taskmanager/internal/models"
	"gorm.io/gorm"
)

type UserStorage struct {
	db *gorm.DB
}

func NewUserStorage(db *gorm.DB) *UserStorage {
	return &UserStorage{db: db}
}

func (s *UserStorage) GetByID(id uint) (*models.User, error) {
	var user models.User
	if err := s.db.First(&user, id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *UserStorage) Update(user *models.User) error {
	return s.db.Save(user).Error
}

func (s *UserStorage) DeleteByID(id uint) error {
	return s.db.Unscoped().Delete(&models.User{}, id).Error
}
