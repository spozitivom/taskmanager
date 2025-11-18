package services

import (
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"github.com/spozitivom/taskmanager/internal/models"
	"github.com/spozitivom/taskmanager/internal/storage"
	"gorm.io/gorm"
)

const maxAvatarBytes = 2 * 1024 * 1024

var allowedLanguages = map[string]struct{}{
	"en": {},
	"ru": {},
}

var allowedThemes = map[string]struct{}{
	"light":  {},
	"dark":   {},
	"system": {},
}

// UserService инкапсулирует операции с профилем пользователя.
type UserService struct {
	db       *gorm.DB
	users    *storage.UserStorage
	projects *storage.ProjectStorage
	tasks    *storage.TaskStorage
}

func NewUserService(db *gorm.DB, users *storage.UserStorage, projects *storage.ProjectStorage, tasks *storage.TaskStorage) *UserService {
	return &UserService{
		db:       db,
		users:    users,
		projects: projects,
		tasks:    tasks,
	}
}

func (s *UserService) GetProfile(userID uint) (*models.User, error) {
	return s.users.GetByID(userID)
}

func (s *UserService) UpdateProfile(userID uint, fullName *string, avatar *string, removeAvatar bool) (*models.User, error) {
	user, err := s.users.GetByID(userID)
	if err != nil {
		return nil, err
	}

	if fullName != nil {
		user.FullName = strings.TrimSpace(*fullName)
	}

	if removeAvatar {
		user.AvatarURL = ""
	} else if avatar != nil {
		normalized, err := normalizeAvatar(*avatar)
		if err != nil {
			return nil, err
		}
		user.AvatarURL = normalized
	}

	if err := s.users.Update(user); err != nil {
		return nil, err
	}
	return user, nil
}

func (s *UserService) UpdatePassword(userID uint, current, next string) error {
	user, err := s.users.GetByID(userID)
	if err != nil {
		return err
	}

	current = strings.TrimSpace(current)
	next = strings.TrimSpace(next)
	if len(next) < 6 {
		return errors.New("new password must be at least 6 characters")
	}
	if err := CheckPassword(user.Password, current); err != nil {
		return errors.New("current password is incorrect")
	}
	if current == next {
		return errors.New("new password must differ from current password")
	}

	hash, err := HashPassword(next)
	if err != nil {
		return err
	}
	user.Password = hash
	return s.users.Update(user)
}

func (s *UserService) UpdateSettings(userID uint, language, theme string) (*models.User, error) {
	user, err := s.users.GetByID(userID)
	if err != nil {
		return nil, err
	}

	if lang := strings.TrimSpace(language); lang != "" {
		if _, ok := allowedLanguages[lang]; !ok {
			return nil, errors.New("unsupported language")
		}
		user.Language = lang
	}

	if t := strings.TrimSpace(theme); t != "" {
		if _, ok := allowedThemes[t]; !ok {
			return nil, errors.New("unsupported theme")
		}
		user.Theme = t
	}

	if err := s.users.Update(user); err != nil {
		return nil, err
	}
	return user, nil
}

func (s *UserService) DeleteAccount(userID uint) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var projectIDs []uint
		if err := tx.Model(&models.Project{}).Where("owner_id = ?", userID).Pluck("id", &projectIDs).Error; err != nil {
			return err
		}

		if len(projectIDs) > 0 {
			if err := tx.Unscoped().Where("project_id IN ?", projectIDs).Delete(&models.Task{}).Error; err != nil {
				return err
			}
			if err := tx.Unscoped().Where("owner_id = ?", userID).Delete(&models.Project{}).Error; err != nil {
				return err
			}
		} else {
			if err := tx.Unscoped().Where("owner_id = ?", userID).Delete(&models.Project{}).Error; err != nil {
				return err
			}
		}

		if err := tx.Unscoped().Delete(&models.User{}, userID).Error; err != nil {
			return err
		}
		return nil
	})
}

func normalizeAvatar(avatar string) (string, error) {
	avatar = strings.TrimSpace(avatar)
	if avatar == "" {
		return "", nil
	}

	lower := strings.ToLower(avatar)
	isDataURL := strings.HasPrefix(lower, "data:image/")
	if !isDataURL && !strings.HasPrefix(lower, "http://") && !strings.HasPrefix(lower, "https://") {
		return "", errors.New("avatar must be a JPEG/PNG/WebP image")
	}

	if isDataURL {
		if !strings.Contains(lower, "jpeg") && !strings.Contains(lower, "jpg") &&
			!strings.Contains(lower, "png") && !strings.Contains(lower, "webp") {
			return "", errors.New("avatar must be a JPEG/PNG/WebP image")
		}
		dataIdx := strings.Index(avatar, ",")
		if dataIdx == -1 || dataIdx >= len(avatar)-1 {
			return "", errors.New("invalid avatar payload")
		}
		rawData := avatar[dataIdx+1:]
		if len(rawData) > base64.StdEncoding.EncodedLen(maxAvatarBytes) {
			return "", fmt.Errorf("avatar is too large (max %d bytes)", maxAvatarBytes)
		}

		if decodedLen := len(rawData) * 3 / 4; decodedLen > maxAvatarBytes {
			return "", fmt.Errorf("avatar is too large (max %d bytes)", maxAvatarBytes)
		}

		if decoded, err := base64.StdEncoding.DecodeString(rawData); err != nil {
			return "", errors.New("invalid avatar encoding")
		} else if len(decoded) > maxAvatarBytes {
			return "", fmt.Errorf("avatar is too large (max %d bytes)", maxAvatarBytes)
		}
	}

	return avatar, nil
}
