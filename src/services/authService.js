/**
 * Authentication Service
 * 
 * Handles authentication operations with the backend API.
 */

// Use environment variable for API URL, fallback to localhost for development
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";
const API_URL = `${API_BASE}/api/auth`;

/**
 * Authentication service object
 * All methods are async to match real API behavior
 */
export const authService = {
  /**
   * Sign up a new user
   * @param {Object} credentials - User credentials
   * @param {string} credentials.username - Username
   * @param {string} credentials.password - Password
   * @returns {Promise<Object>} - User data on success
   * @throws {Error} - Error message on failure
   */
  async signUp({ username, password }) {
    const response = await fetch(`${API_URL}/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Something went wrong. Please try again.");
    }

    return data.user;
  },

  /**
   * Sign in an existing user
   * @param {Object} credentials - User credentials
   * @param {string} credentials.username - Username
   * @param {string} credentials.password - Password
   * @returns {Promise<Object>} - User data and token on success
   * @throws {Error} - Error message on failure
   */
  async signIn({ username, password }) {
    const response = await fetch(`${API_URL}/signin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Invalid username or password.");
    }

    // Store token and user in localStorage
    localStorage.setItem("authToken", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    return { user: data.user, token: data.token };
  },

  /**
   * Sign out the current user
   * @returns {Promise<void>}
   */
  async signOut() {
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
  },

  /**
   * Get the current authenticated user
   * @returns {Object|null} - User data or null if not authenticated
   */
  getCurrentUser() {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  },

  /**
   * Check if user is authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    return !!localStorage.getItem("authToken");
  },

  /**
   * Get the authentication token
   * @returns {string|null}
   */
  getToken() {
    return localStorage.getItem("authToken");
  },

  /**
   * Sign in with Google
   * @param {Object} userInfo - Google user info (googleId, email, name, picture)
   * @returns {Promise<Object>} - User data, token, and isNewUser flag on success
   */
  async signInWithGoogle(userInfo) {
    const response = await fetch(`${API_URL}/oauth/google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userInfo),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Google authentication failed.");
    }

    localStorage.setItem("authToken", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    return { user: data.user, token: data.token, isNewUser: data.isNewUser };
  },

  /**
   * Complete profile setup for new OAuth users
   * @param {Object} profileData - Profile data (username, displayName)
   * @returns {Promise<Object>} - Updated user data
   */
  async completeProfile({ username, displayName }) {
    const token = this.getToken();
    
    const response = await fetch(`${API_URL}/complete-profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ username, displayName }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to complete profile.");
    }

    // Update stored user data
    localStorage.setItem("user", JSON.stringify(data.user));

    return data.user;
  },

  /**
   * Check if username is available
   * @param {string} username - Username to check
   * @returns {Promise<Object>} - Availability status
   */
  async checkUsername(username) {
    const response = await fetch(`${API_URL}/check-username`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username }),
    });

    return response.json();
  },

  /**
   * Sign in with Apple
   * @param {Object} appleResponse - Apple auth response
   * @returns {Promise<Object>} - User data and token on success
   */
  async signInWithApple(identityToken, user) {
    const response = await fetch(`${API_URL}/oauth/apple`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ identityToken, user }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Apple authentication failed.");
    }

    localStorage.setItem("authToken", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    return { user: data.user, token: data.token };
  },

  /**
   * Update user profile
   * @param {Object} profileData - Profile data to update
   * @returns {Promise<Object>} - Updated user data
   */
  async updateProfile(profileData) {
    const token = this.getToken();
    
    const response = await fetch(`${API_URL}/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(profileData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to update profile.");
    }

    localStorage.setItem("user", JSON.stringify(data.user));
    return { success: true, user: data.user };
  },

  /**
   * Change password
   * @param {Object} passwordData - Current and new password
   * @returns {Promise<Object>} - Success message
   */
  async changePassword({ currentPassword, newPassword }) {
    const token = this.getToken();
    
    const response = await fetch(`${API_URL}/password`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to change password.");
    }

    return data;
  },

  /**
   * Update user settings
   * @param {Object} settings - Settings to update
   * @returns {Promise<Object>} - Updated user data
   */
  async updateSettings(settings) {
    const token = this.getToken();
    
    const response = await fetch(`${API_URL}/settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ settings }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to update settings.");
    }

    localStorage.setItem("user", JSON.stringify(data.user));
    return { success: true, user: data.user };
  },

  /**
   * Send password reset email
   * @param {string} email - User's email address
   * @returns {Promise<Object>} - Success message
   */
  async sendPasswordReset(email) {
    const response = await fetch(`${API_URL}/password-reset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to send reset email.");
    }

    return { success: true, message: data.message };
  },

  /**
   * Get user stats and game history
   * @returns {Promise<Object>} - Stats and game history
   */
  async getStats() {
    const token = this.getToken();
    
    const response = await fetch(`${API_URL}/stats`, {
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch stats.");
    }

    return data;
  },

  /**
   * Refresh user data from server
   * @returns {Promise<Object>} - Fresh user data
   */
  async refreshUser() {
    const token = this.getToken();
    
    const response = await fetch(`${API_URL}/me`, {
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch user.");
    }

    localStorage.setItem("user", JSON.stringify(data.user));
    return data.user;
  },

  // ==================== FRIENDS API ====================

  /**
   * Get friends list, pending requests
   * @returns {Promise<Object>} - Friends data
   */
  async getFriends() {
    const token = this.getToken();
    
    const response = await fetch(`${API_BASE}/api/friends/list`, {
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch friends.");
    }

    return data;
  },

  /**
   * Search for users by UID or username
   * @param {string} query - Search query
   * @returns {Promise<Object>} - Search results
   */
  async searchUsers(query) {
    const token = this.getToken();
    
    const response = await fetch(`${API_BASE}/api/friends/search?query=${encodeURIComponent(query)}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Search failed.");
    }

    return data;
  },

  /**
   * Send friend request
   * @param {string} targetUserId - Target user's ID
   * @returns {Promise<Object>} - Success message
   */
  async sendFriendRequest(targetUserId) {
    const token = this.getToken();
    
    const response = await fetch(`${API_BASE}/api/friends/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ targetUserId }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to send friend request.");
    }

    return data;
  },

  /**
   * Accept friend request
   * @param {string} requesterId - Requester's user ID
   * @returns {Promise<Object>} - Success message
   */
  async acceptFriendRequest(requesterId) {
    const token = this.getToken();
    
    const response = await fetch(`${API_BASE}/api/friends/accept`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ requesterId }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to accept friend request.");
    }

    return data;
  },

  /**
   * Reject friend request
   * @param {string} requesterId - Requester's user ID
   * @returns {Promise<Object>} - Success message
   */
  async rejectFriendRequest(requesterId) {
    const token = this.getToken();
    
    const response = await fetch(`${API_BASE}/api/friends/reject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ requesterId }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to reject friend request.");
    }

    return data;
  },

  /**
   * Cancel sent friend request
   * @param {string} targetUserId - Target user's ID
   * @returns {Promise<Object>} - Success message
   */
  async cancelFriendRequest(targetUserId) {
    const token = this.getToken();
    
    const response = await fetch(`${API_BASE}/api/friends/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ targetUserId }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to cancel friend request.");
    }

    return data;
  },

  /**
   * Remove friend
   * @param {string} friendId - Friend's user ID
   * @returns {Promise<Object>} - Success message
   */
  async removeFriend(friendId) {
    const token = this.getToken();
    
    const response = await fetch(`${API_BASE}/api/friends/remove`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ friendId }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to remove friend.");
    }

    return data;
  },
};

export default authService;
