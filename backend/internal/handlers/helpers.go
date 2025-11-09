package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func userIDFromContext(c *gin.Context) (uint, bool) {
	val, ok := c.Get("userID")
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return 0, false
	}
	id, ok := val.(uint)
	if !ok || id == 0 {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid user"})
		return 0, false
	}
	return id, true
}
