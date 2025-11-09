package models

import (
	"errors"
	"strings"
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

const (
	ProjectStatusPlanned   = "planned"
	ProjectStatusActive    = "active"
	ProjectStatusFrozen    = "frozen"
	ProjectStatusCompleted = "completed"
)

const (
	ProjectPriorityLow      = "low"
	ProjectPriorityMedium   = "medium"
	ProjectPriorityHigh     = "high"
	ProjectPriorityCritical = "critical"
)

const DefaultProjectTasksLimit = 100

var (
	errInvalidProjectStatus   = errors.New("invalid project status")
	errInvalidProjectPriority = errors.New("invalid project priority")
)

var projectStatusSet = map[string]struct{}{
	ProjectStatusPlanned:   {},
	ProjectStatusActive:    {},
	ProjectStatusFrozen:    {},
	ProjectStatusCompleted: {},
}

var projectPrioritySet = map[string]struct{}{
	ProjectPriorityLow:      {},
	ProjectPriorityMedium:   {},
	ProjectPriorityHigh:     {},
	ProjectPriorityCritical: {},
}

type Project struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	OwnerID     uint           `gorm:"index;not null" json:"owner_id"`
	Title       string         `gorm:"type:varchar(255);not null" json:"title"`
	Description string         `gorm:"type:text" json:"description"`
	Status      string         `gorm:"type:varchar(32);default:planned;index" json:"status"`
	Priority    string         `gorm:"type:varchar(16);default:medium;index" json:"priority"`
	Deadline    *time.Time     `json:"deadline,omitempty"`
	ProgressPct int            `gorm:"type:smallint;default:0" json:"progress_pct"`
	TasksLimit  int            `gorm:"default:100" json:"tasks_limit"`
	Tags        datatypes.JSON `gorm:"type:jsonb" json:"tags,omitempty"`
	ArchivedAt  *time.Time     `gorm:"index" json:"archived_at,omitempty"`
	CreatedAt   time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	Members    []ProjectMember `json:"members,omitempty"`
	TasksCount int64           `gorm:"-" json:"tasks_count"`
}

type ProjectMember struct {
	ProjectID   uint              `gorm:"primaryKey" json:"project_id"`
	UserID      uint              `gorm:"primaryKey" json:"user_id"`
	Role        string            `gorm:"type:varchar(16);not null" json:"role"`
	Permissions datatypes.JSONMap `gorm:"type:jsonb" json:"permissions,omitempty"`
	CreatedAt   time.Time         `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time         `gorm:"autoUpdateTime" json:"updated_at"`
}

func NormalizeProjectStatus(status string) (string, error) {
	status = strings.TrimSpace(status)
	if status == "" {
		return ProjectStatusPlanned, nil
	}
	if _, ok := projectStatusSet[status]; !ok {
		return "", errInvalidProjectStatus
	}
	return status, nil
}

func NormalizeProjectPriority(priority string) (string, error) {
	priority = strings.TrimSpace(priority)
	if priority == "" {
		return ProjectPriorityMedium, nil
	}
	priority = strings.ToLower(priority)
	if _, ok := projectPrioritySet[priority]; !ok {
		return "", errInvalidProjectPriority
	}
	return priority, nil
}
