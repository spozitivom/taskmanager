package services

import (
	"github.com/spozitivom/taskmanager/database"
	"github.com/spozitivom/taskmanager/models"
)

// Получить все задачи
func GetAllTasks() ([]models.Task, error) {
	var tasks []models.Task
	result := database.DB.Find(&tasks)
	return tasks, result.Error
}

// Создать задачу
func CreateTask(task *models.Task) error {
	result := database.DB.Create(task)
	return result.Error
}

// Обновить задачу
func UpdateTask(id uint, updated models.Task) (*models.Task, error) {
	var task models.Task
	if err := database.DB.First(&task, id).Error; err != nil {
		return nil, err
	}
	task.Title = updated.Title
	task.Checked = updated.Checked
	if err := database.DB.Save(&task).Error; err != nil {
		return nil, err
	}
	return &task, nil
}

// Удалить задачу
func DeleteTask(id uint) error {
	result := database.DB.Delete(&models.Task{}, id)
	return result.Error
}
