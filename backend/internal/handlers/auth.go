package handlers

import (
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/spozitivom/taskmanager/internal/models"
	"github.com/spozitivom/taskmanager/internal/services"
	"gorm.io/gorm"
)

type AuthHandler struct {
	DB *gorm.DB
}

// POST /api/auth/register
// Принимает: { "email": "...", "username": "...", "password": "..." } — email ИЛИ username обязателен.
func (h *AuthHandler) Register(c *gin.Context) {
	var req struct {
		Email    string `json:"email"`
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	username := strings.ToLower(strings.TrimSpace(req.Username))
	pass := strings.TrimSpace(req.Password)

	log.Printf("register payload: email=%q username=%q password_len=%d", email, username, len(req.Password))

	// Валидация
	if pass == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "password is required"})
		return
	}
	if email == "" && username == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email or username is required"})
		return
	}

	// Конфликты
	if email != "" {
		var cnt int64
		_ = h.DB.Model(&models.User{}).Where("email = ?", email).Count(&cnt).Error
		if cnt > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
			return
		}
	}
	if username != "" {
		var cnt int64
		_ = h.DB.Model(&models.User{}).Where("username = ?", username).Count(&cnt).Error
		if cnt > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "username already taken"})
			return
		}
	}

	// Хэш пароля
	hash, err := services.HashPassword(pass)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	user := models.User{
		Email:    email,
		Username: username,
		Password: hash,
		Language: "en",
		Theme:    "light",
	}

	// Сохранение
	if err := h.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "user registered"})
}

// POST /api/auth/login
// Принимает: { "email": "...", "username": "...", "password": "..." } — любой из идентификаторов.
func (h *AuthHandler) Login(c *gin.Context) {
	var req struct {
		Email    string `json:"email"`
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	ident := strings.ToLower(strings.TrimSpace(req.Email))
	if ident == "" {
		ident = strings.ToLower(strings.TrimSpace(req.Username))
	}
	if ident == "" || strings.TrimSpace(req.Password) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "identifier and password are required"})
		return
	}

	// Поиск по email ИЛИ username (case-insensitive — мы нормализовали в lower)
	var user models.User
	q := h.DB.Where("email = ? OR username = ?", ident, ident).First(&user)
	if q.Error != nil {
		if q.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query user"})
		return
	}

	// Проверка пароля
	if err := services.CheckPassword(user.Password, req.Password); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	// JWT
	token, err := services.GenerateJWT(user.ID, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":  token,
		"userID": user.ID,
		"role":   user.Role,
	})
}
