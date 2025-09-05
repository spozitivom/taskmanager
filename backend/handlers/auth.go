package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/spozitivom/taskmanager/models"
	"github.com/spozitivom/taskmanager/services"
	"gorm.io/gorm"
)

// AuthHandler — обёртка над GORM, чтобы хендлеры имели доступ к БД
type AuthHandler struct {
	DB *gorm.DB
}

// Register — регистрация нового пользователя
func (h *AuthHandler) Register(c *gin.Context) {
	var user models.User

	if err := c.ShouldBindJSON(&user); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	fmt.Println("📥 Пароль до хеша:", user.Password)
	hash, err := services.HashPassword(user.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}
	fmt.Println("🔐 Хеш пароля:", hash)
	user.Password = hash

	if err := h.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "user registered"})
}

// Login — вход по email + password
func (h *AuthHandler) Login(c *gin.Context) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		fmt.Println("❌ Пользователь не найден:", req.Email)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	fmt.Println("🔐 Пароль из запроса:", req.Password)
	fmt.Println("🔐 Хеш из базы:", user.Password)

	if err := services.CheckPassword(user.Password, req.Password); err != nil {
		fmt.Println("❌ Ошибка сравнения паролей:", err.Error())
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

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
