import { signOut } from "firebase/auth";
import { auth } from "./firebaseService";
import { authFetch } from "../utils/apiClient";

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const AUTH_URL = `${API_BASE}/api/auth`;
const FRIENDS_URL = `${API_BASE}/api/friends`;

const parseResponse = async (response) => {
  const text = await response.text();
  if (!text) {
    return response.ok ? {} : { message: "Unexpected server response" };
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return response.ok ? {} : { message: text };
  }
};

const createAuthHeaders = (includeJson = true) => {
  const token = localStorage.getItem("authToken");
  const headers = includeJson ? { "Content-Type": "application/json" } : {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

export const authService = {
  getCurrentUser: () => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  },

  getToken: () => localStorage.getItem("authToken"),

  isAuthenticated: () => Boolean(localStorage.getItem("authToken") && localStorage.getItem("user")),

  logout: async () => {
    try {
      await signOut(auth);
    } catch (error) {
      // Ignore errors when auth instance is already signed out
    }
    localStorage.removeItem("user");
    localStorage.removeItem("authToken");
    localStorage.removeItem("authSource");
  },

  async completeProfile({ username, displayName }) {
    const response = await authFetch(`${AUTH_URL}/complete-profile`, {
      method: "POST",
      headers: createAuthHeaders(),
      body: JSON.stringify({ username, displayName }),
    });

    const data = await parseResponse(response);
    if (!response.ok) {
      throw new Error(data.message || "Failed to complete profile.");
    }

    if (data?.user) {
      localStorage.setItem("user", JSON.stringify(data.user));
    }

    return data.user;
  },

  async checkUsername(username) {
    const response = await authFetch(`${AUTH_URL}/check-username`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });

    return parseResponse(response);
  },

  async updateProfile(profileData) {
    const response = await authFetch(`${AUTH_URL}/profile`, {
      method: "PUT",
      headers: createAuthHeaders(),
      body: JSON.stringify(profileData),
    });

    const data = await parseResponse(response);
    if (!response.ok) {
      throw new Error(data.message || "Failed to update profile.");
    }

    if (data?.user) {
      localStorage.setItem("user", JSON.stringify(data.user));
    }

    return { success: true, user: data.user };
  },

  async updateSettings(settings) {
    const response = await authFetch(`${AUTH_URL}/settings`, {
      method: "PUT",
      headers: createAuthHeaders(),
      body: JSON.stringify({ settings }),
    });

    const data = await parseResponse(response);
    if (!response.ok) {
      throw new Error(data.message || "Failed to update settings.");
    }

    if (data?.user) {
      localStorage.setItem("user", JSON.stringify(data.user));
    }

    return { success: true, user: data.user };
  },

  async sendPasswordReset(email) {
    const response = await authFetch(`${AUTH_URL}/password-reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await parseResponse(response);
    if (!response.ok) {
      throw new Error(data.message || "Failed to send reset email.");
    }

    return { success: true, message: data.message };
  },

  async getStats() {
    const response = await authFetch(`${AUTH_URL}/stats`, {
      headers: createAuthHeaders(false),
    });

    const data = await parseResponse(response);
    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch stats.");
    }

    return data;
  },

  async refreshUser() {
    const response = await authFetch(`${AUTH_URL}/me`, {
      headers: createAuthHeaders(false),
    });

    const data = await parseResponse(response);
    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch user.");
    }

    if (data?.user) {
      localStorage.setItem("user", JSON.stringify(data.user));
    }

    return data.user;
  },

  async getFriends() {
    const response = await authFetch(`${FRIENDS_URL}/list`, {
      headers: createAuthHeaders(false),
    });

    const data = await parseResponse(response);
    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch friends.");
    }

    return data;
  },

  async searchUsers(query) {
    const response = await authFetch(`${FRIENDS_URL}/search?query=${encodeURIComponent(query)}`, {
      headers: createAuthHeaders(false),
    });

    const data = await parseResponse(response);
    if (!response.ok) {
      throw new Error(data.message || "Search failed.");
    }

    return data;
  },

  async sendFriendRequest(targetUserId) {
    const response = await authFetch(`${FRIENDS_URL}/request`, {
      method: "POST",
      headers: createAuthHeaders(),
      body: JSON.stringify({ targetUserId }),
    });

    const data = await parseResponse(response);
    if (!response.ok) {
      throw new Error(data.message || "Failed to send friend request.");
    }

    return data;
  },

  async acceptFriendRequest(requesterId) {
    const response = await authFetch(`${FRIENDS_URL}/accept`, {
      method: "POST",
      headers: createAuthHeaders(),
      body: JSON.stringify({ requesterId }),
    });

    const data = await parseResponse(response);
    if (!response.ok) {
      throw new Error(data.message || "Failed to accept friend request.");
    }

    return data;
  },

  async rejectFriendRequest(requesterId) {
    const response = await authFetch(`${FRIENDS_URL}/reject`, {
      method: "POST",
      headers: createAuthHeaders(),
      body: JSON.stringify({ requesterId }),
    });

    const data = await parseResponse(response);
    if (!response.ok) {
      throw new Error(data.message || "Failed to reject friend request.");
    }

    return data;
  },

  async cancelFriendRequest(targetUserId) {
    const response = await authFetch(`${FRIENDS_URL}/cancel`, {
      method: "POST",
      headers: createAuthHeaders(),
      body: JSON.stringify({ targetUserId }),
    });

    const data = await parseResponse(response);
    if (!response.ok) {
      throw new Error(data.message || "Failed to cancel friend request.");
    }

    return data;
  },

  async removeFriend(friendId) {
    const response = await authFetch(`${FRIENDS_URL}/remove`, {
      method: "POST",
      headers: createAuthHeaders(),
      body: JSON.stringify({ friendId }),
    });

    const data = await parseResponse(response);
    if (!response.ok) {
      throw new Error(data.message || "Failed to remove friend.");
    }

    return data;
  },

  async sendGameInvite(targetUserId, gameId, gameCode, gameName) {
    const response = await authFetch(`${FRIENDS_URL}/invite-to-game`, {
      method: "POST",
      headers: createAuthHeaders(),
      body: JSON.stringify({ targetUserId, gameId, gameCode, gameName }),
    });

    const data = await parseResponse(response);
    if (!response.ok) {
      throw new Error(data.message || "Failed to send game invite.");
    }

    return data;
  },

  async getGameInvites() {
    const response = await authFetch(`${FRIENDS_URL}/game-invites`, {
      headers: createAuthHeaders(false),
    });

    const data = await parseResponse(response);
    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch game invites.");
    }

    return data;
  },

  async dismissGameInvite(inviteId) {
    const response = await authFetch(`${FRIENDS_URL}/dismiss-invite`, {
      method: "POST",
      headers: createAuthHeaders(),
      body: JSON.stringify({ inviteId }),
    });

    const data = await parseResponse(response);
    if (!response.ok) {
      throw new Error(data.message || "Failed to dismiss invite.");
    }

    return data;
  },
};

export default authService;
