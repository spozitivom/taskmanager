package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/spozitivom/taskmanager/internal/models"
	"github.com/spozitivom/taskmanager/internal/storage"
	"gorm.io/gorm"
)

var (
	ErrProjectLimit    = errors.New("project limit reached")
	ErrTasksLimit      = errors.New("tasks limit reached")
	ErrProjectNotFound = errors.New("project not found")
)

// ProjectService инкапсулирует бизнес-логику проектов и связанных задач.
type ProjectService struct {
	projects *storage.ProjectStorage
	tasks    *storage.TaskStorage
	users    *storage.UserStorage
}

func NewProjectService(p *storage.ProjectStorage, t *storage.TaskStorage, u *storage.UserStorage) *ProjectService {
	return &ProjectService{projects: p, tasks: t, users: u}
}

func (s *ProjectService) List(ownerID uint, includeArchived bool) ([]models.Project, error) {
	projects, err := s.projects.List(ownerID, includeArchived)
	if err != nil {
		return nil, err
	}
	for i := range projects {
		count, err := s.tasks.CountByProject(projects[i].ID)
		if err != nil {
			return nil, err
		}
		projects[i].TasksCount = count
	}
	return projects, nil
}

func (s *ProjectService) Get(ownerID, projectID uint) (*models.Project, error) {
	project, err := s.projects.Get(ownerID, projectID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrProjectNotFound
		}
		return nil, err
	}
	return project, nil
}

func (s *ProjectService) Create(ownerID uint, payload *models.ProjectInput) (*models.Project, error) {
	owner, err := s.users.GetByID(ownerID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("owner not found")
		}
		return nil, err
	}

	count, err := s.projects.CountByOwner(ownerID)
	if err != nil {
		return nil, err
	}
	if owner.MaxProjects > 0 && count >= int64(owner.MaxProjects) {
		return nil, ErrProjectLimit
	}

	normalized, err := normalizeProjectPayload(payload)
	if err != nil {
		return nil, err
	}

	project := &models.Project{
		OwnerID:     ownerID,
		Title:       normalized.Title,
		Description: normalized.Description,
		Status:      normalized.Status,
		Priority:    normalized.Priority,
		Deadline:    normalized.Deadline,
		ProgressPct: normalized.ProgressPct,
		TasksLimit:  normalized.TasksLimit,
	}

	if len(normalized.Tags) > 0 {
		data, _ := json.Marshal(normalized.Tags)
		project.Tags = data
	}

	if err := s.projects.Create(project); err != nil {
		return nil, err
	}
	return project, nil
}

func (s *ProjectService) Update(ownerID, id uint, payload *models.ProjectInput) (*models.Project, error) {
	project, err := s.Get(ownerID, id)
	if err != nil {
		return nil, err
	}

	normalized, err := normalizeProjectPayload(payload)
	if err != nil {
		return nil, err
	}

	if normalized.Title != "" {
		project.Title = normalized.Title
	}
	if normalized.Description != "" {
		project.Description = normalized.Description
	}
	project.Status = normalized.Status
	project.Priority = normalized.Priority
	project.Deadline = normalized.Deadline
	project.ProgressPct = normalized.ProgressPct
	project.TasksLimit = normalized.TasksLimit

	if normalized.Tags != nil {
		data, _ := json.Marshal(normalized.Tags)
		project.Tags = data
	}

	if err := s.projects.Update(project); err != nil {
		return nil, err
	}
	return project, nil
}

func (s *ProjectService) Archive(ownerID, id uint) error {
	project, err := s.Get(ownerID, id)
	if err != nil {
		return err
	}
	if project.ArchivedAt != nil {
		return nil
	}
	if err := s.projects.Archive(project); err != nil {
		return err
	}
	return s.tasks.SoftDeleteByProject(project.ID)
}

func (s *ProjectService) Restore(ownerID, id uint) error {
	project, err := s.Get(ownerID, id)
	if err != nil {
		return err
	}
	if project.ArchivedAt == nil {
		return nil
	}
	if err := s.projects.Restore(project); err != nil {
		return err
	}
	return s.tasks.RestoreByProject(project.ID)
}

func (s *ProjectService) HardDelete(ownerID, id uint) error {
	project, err := s.Get(ownerID, id)
	if err != nil {
		return err
	}
	if err := s.projects.HardDelete(project); err != nil {
		return err
	}
	return s.tasks.SoftDeleteByProject(project.ID)
}

func (s *ProjectService) ToggleCompleted(ownerID, id uint, cascade string) (*models.Project, error) {
	project, err := s.Get(ownerID, id)
	if err != nil {
		return nil, err
	}

	completed := project.Status == models.ProjectStatusCompleted
	if completed {
		project.Status = models.ProjectStatusActive
	} else {
		project.Status = models.ProjectStatusCompleted
	}
	if err := s.projects.Update(project); err != nil {
		return nil, err
	}

	if !completed && cascade != "none" {
		tasks, err := s.tasks.GetFiltered("desc", "", "", "", &project.ID)
		if err != nil {
			return nil, err
		}
		for i := range tasks {
			switch cascade {
			case "complete_all":
				tasks[i].ApplyStatusTransition(models.StatusCompleted)
			default:
				if tasks[i].Status != models.StatusCompleted {
					tasks[i].ApplyStatusTransition(models.StatusCancelled)
				}
			}
		}
		if err := s.tasks.SaveAll(tasks); err != nil {
			return nil, err
		}
	}

	return project, nil
}

func (s *ProjectService) AssignTasks(ownerID, projectID uint, taskIDs []uint, reassign bool) error {
	project, err := s.Get(ownerID, projectID)
	if err != nil {
		return err
	}

	tasks, err := s.tasks.GetByIDs(taskIDs)
	if err != nil {
		return err
	}
	if len(tasks) == 0 {
		return nil
	}

	// enforce tasks limit
	count, err := s.tasks.CountByProject(project.ID)
	if err != nil {
		return err
	}
	added := 0
	for i := range tasks {
		if tasks[i].ProjectID != nil {
			if *tasks[i].ProjectID == project.ID {
				continue
			}
			if !reassign {
				continue
			}
		}
		added++
	}
	if int(count)+added > project.TasksLimit {
		return ErrTasksLimit
	}

	for i := range tasks {
		if tasks[i].ProjectID != nil {
			if *tasks[i].ProjectID == project.ID {
				continue
			}
			if !reassign {
				continue
			}
		}
		tasks[i].ProjectID = &project.ID
	}
	return s.tasks.SaveAll(tasks)
}

func (s *ProjectService) CreateFromTasks(ownerID uint, payload models.ProjectFromTasksPayload) (*models.Project, error) {
	project, err := s.Create(ownerID, &payload.ProjectInput)
	if err != nil {
		return nil, err
	}
	if err := s.AssignTasks(ownerID, project.ID, payload.TaskIDs, payload.ReassignAttached); err != nil {
		return nil, err
	}
	return project, nil
}

// normalizeProjectPayload применяет дефолты и проверки.
func normalizeProjectPayload(p *models.ProjectInput) (*models.ProjectInput, error) {
	if p == nil {
		return nil, errors.New("empty payload")
	}
	cloned := *p
	cloned.Title = strings.TrimSpace(cloned.Title)
	if cloned.Title == "" {
		return nil, errors.New("title is required")
	}
	status, err := models.NormalizeProjectStatus(cloned.Status)
	if err != nil {
		return nil, err
	}
	cloned.Status = status

	priority, err := models.NormalizeProjectPriority(cloned.Priority)
	if err != nil {
		return nil, err
	}
	cloned.Priority = priority

	if cloned.TasksLimit <= 0 {
		cloned.TasksLimit = models.DefaultProjectTasksLimit
	}
	if cloned.TasksLimit > 500 {
		cloned.TasksLimit = 500
	}
	if cloned.ProgressPct < 0 {
		cloned.ProgressPct = 0
	}
	if cloned.ProgressPct > 100 {
		cloned.ProgressPct = 100
	}
	return &cloned, nil
}
