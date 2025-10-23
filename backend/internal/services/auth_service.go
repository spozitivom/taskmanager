package services

import (
	"os"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// Хешируем пароль (возвращаем как строку)
func HashPassword(password string) (string, error) {
	hashBytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(hashBytes), err
}

// Сравниваем пароль и хеш
func CheckPassword(hash, password string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}

// Генерируем JWT
func GenerateJWT(userID uint, role string) (string, error) {
	claims := jwt.MapClaims{
		"sub":  strconv.Itoa(int(userID)),
		"role": role,
		"exp":  time.Now().AddDate(1, 0, 0).Unix(), // токен живёт 1 год
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(os.Getenv("JWT_SECRET")))
}
