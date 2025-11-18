package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/spozitivom/taskmanager/internal/services"
	"github.com/stretchr/testify/require"
)

func TestAuthMiddlewareBlocksMissingToken(t *testing.T) {
	t.Setenv("JWT_SECRET", "testsecret")
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(Auth())
	router.GET("/protected", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthMiddlewarePassesValidToken(t *testing.T) {
	t.Setenv("JWT_SECRET", "testsecret")
	gin.SetMode(gin.TestMode)

	token, err := services.GenerateJWT(7, "user")
	require.NoError(t, err)
	require.NotEmpty(t, token)

	router := gin.New()
	router.Use(Auth())
	router.GET("/protected", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Equal(t, "ok", w.Body.String())
}
