package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/spozitivom/taskmanager/internal/middleware"
	"github.com/spozitivom/taskmanager/internal/services"
)

type UserHandler struct {
	Service *services.UserService
}

func NewUserHandler(s *services.UserService) *UserHandler {
	return &UserHandler{Service: s}
}

func (h *UserHandler) RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api", middleware.Auth())
	{
		api.GET("/user/profile", h.GetProfile)
		api.PATCH("/user/profile", h.UpdateProfile)
		api.PATCH("/user/password", h.UpdatePassword)
		api.PATCH("/user/settings", h.UpdateSettings)
		api.DELETE("/user", h.DeleteAccount)
	}
}

func (h *UserHandler) GetProfile(c *gin.Context) {
	userID, ok := userIDFromContext(c)
	if !ok {
		return
	}
	user, err := h.Service.GetProfile(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, user)
}

func (h *UserHandler) UpdateProfile(c *gin.Context) {
	userID, ok := userIDFromContext(c)
	if !ok {
		return
	}
	var payload struct {
		FullName     *string `json:"full_name"`
		Avatar       *string `json:"avatar"`
		RemoveAvatar bool    `json:"remove_avatar"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	if payload.FullName == nil && payload.Avatar == nil && !payload.RemoveAvatar {
		c.JSON(http.StatusBadRequest, gin.H{"error": "nothing to update"})
		return
	}

	updated, err := h.Service.UpdateProfile(userID, payload.FullName, payload.Avatar, payload.RemoveAvatar)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, updated)
}

func (h *UserHandler) UpdatePassword(c *gin.Context) {
	userID, ok := userIDFromContext(c)
	if !ok {
		return
	}
	var payload struct {
		Current string `json:"current_password"`
		New     string `json:"new_password"`
		Confirm string `json:"confirm_password"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	if payload.New == "" || payload.Current == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "current and new password are required"})
		return
	}
	if len(payload.New) < 6 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "password must be at least 6 characters"})
		return
	}
	if payload.New != payload.Confirm {
		c.JSON(http.StatusBadRequest, gin.H{"error": "password confirmation does not match"})
		return
	}

	if err := h.Service.UpdatePassword(userID, payload.Current, payload.New); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *UserHandler) UpdateSettings(c *gin.Context) {
	userID, ok := userIDFromContext(c)
	if !ok {
		return
	}
	var payload struct {
		Language string `json:"language"`
		Theme    string `json:"theme"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	if payload.Language == "" && payload.Theme == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "nothing to update"})
		return
	}

	user, err := h.Service.UpdateSettings(userID, payload.Language, payload.Theme)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, user)
}

func (h *UserHandler) DeleteAccount(c *gin.Context) {
	userID, ok := userIDFromContext(c)
	if !ok {
		return
	}
	var payload struct {
		Confirm string `json:"confirm"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	if payload.Confirm == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "confirmation is required"})
		return
	}

	user, err := h.Service.GetProfile(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	if payload.Confirm != "DELETE" && payload.Confirm != user.Email {
		c.JSON(http.StatusBadRequest, gin.H{"error": "confirmation phrase is invalid"})
		return
	}

	if err := h.Service.DeleteAccount(userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}
