package middleware

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Recover перехватывает панику, логирует её и возвращает 500 вместо падения сервера.
func Recover() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("🔥 panic recovered: %v", r)
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"error": "internal server error",
				})
			}
		}()
		c.Next()
	}
}
