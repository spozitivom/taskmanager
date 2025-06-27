package storage

import (
	"github.com/spozitivom/taskmanager/database"
	"github.com/spozitivom/taskmanager/models"
)

func GetAllTasks() []models.Task {
	var tasks []models.Task
	database.DB.Find(&tasks)
	return tasks
}

func AddTask(task models.Task) models.Task {
	database.DB.Create(&task)
	return task
}

func UpdateTask(id int, updated models.Task) (*models.Task, bool) {
	var task models.Task
	if err := database.DB.First(&task, id).Error; err != nil {
		return nil, false
	}
	task.Title = updated.Title
	task.Checked = updated.Checked
	database.DB.Save(&task)
	return &task, true
}

func DeleteTask(id int) bool {
	result := database.DB.Delete(&models.Task{}, id)
	return result.RowsAffected > 0
}
