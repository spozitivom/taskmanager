package middleware

import "github.com/gin-gonic/gin"

func ForceUTF8() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Установим заголовок ДО обработки запроса
		c.Writer.Header().Set("Content-Type", "application/json; charset=utf-8")
		c.Next()
	}
}
