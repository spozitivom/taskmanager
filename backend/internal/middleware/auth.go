package middleware

import (
	"errors"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// Auth — middleware для проверки JWT токена в заголовке Authorization.
// Требуется заголовок: Authorization: Bearer <token>
func Auth() gin.HandlerFunc {
	secret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if secret == "" {
		// Фатальная ошибка конфигурации. Лучше завершить запуск приложения,
		// чем пропускать всех пользователей без защиты.
		panic("❌ JWT_SECRET is not set — authentication middleware cannot start")
	}

	return func(c *gin.Context) {
		// --- 1️⃣ Извлекаем токен ---
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing or invalid Authorization header"})
			return
		}
		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

		// --- 2️⃣ Парсим токен ---
		claims := jwt.MapClaims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
			// Проверяем алгоритм подписи, чтобы не приняли поддельный токен
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("unexpected signing method")
			}
			return []byte(secret), nil
		})

		// --- 3️⃣ Обрабатываем ошибки JWT ---
		if err != nil || !token.Valid {
			var msg string
			if errors.Is(err, jwt.ErrTokenExpired) {
				msg = "token expired"
			} else {
				msg = "invalid token"
			}
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": msg})
			return
		}

		// --- 4️⃣ Извлекаем полезные данные ---
		if sub, ok := claims["sub"].(float64); ok {
			c.Set("userID", uint(sub))
		}
		if role, ok := claims["role"].(string); ok {
			c.Set("role", role)
		}

		// --- 5️⃣ Продолжаем выполнение ---
		c.Next()
	}
}
