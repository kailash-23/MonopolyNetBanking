import { authFetch } from "../utils/apiClient";

const API_BASE = import.meta.env.VITE_API_URL || "";
const API_URL = `${API_BASE}/api/games`;

// Helper to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem("authToken");
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
};

// Helper to safely parse JSON response
const parseResponse = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    // If response is not JSON, throw a helpful error
    throw new Error(
      response.ok
        ? "Invalid response from server"
        : `Server error (${response.status}): Unable to connect`
    );
  }
};

// Create a new game
export const createGame = async (gameData) => {
  const response = await authFetch(`${API_URL}/create`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(gameData),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to create game");
  }
  return data;
};

// Join a game by code
export const joinGame = async (code) => {
  const response = await authFetch(`${API_URL}/join`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ code }),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to join game");
  }
  return data;
};

// Leave a game
export const leaveGame = async (gameId) => {
  const response = await authFetch(`${API_URL}/leave`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ gameId }),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to leave game");
  }
  return data;
};

// Get game by code
export const getGame = async (code) => {
  const response = await authFetch(`${API_URL}/${code}`, {
    headers: getAuthHeaders(),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to get game");
  }
  return data;
};

// Get user's active game
export const getActiveGame = async () => {
  const response = await authFetch(`${API_URL}/my/active`, {
    headers: getAuthHeaders(),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to get active game");
  }
  return data;
};

// Toggle ready status
export const toggleReady = async (gameId) => {
  const response = await authFetch(`${API_URL}/ready`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ gameId }),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to toggle ready status");
  }
  return data;
};

// Select a Monopoly token
export const selectToken = async (gameId, token) => {
  const response = await authFetch(`${API_URL}/select-token`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ gameId, token }),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to select token");
  }
  return data;
};

// Update game settings (host only)
export const updateGameSettings = async (gameId, settings) => {
  const response = await authFetch(`${API_URL}/settings`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify({ gameId, ...settings }),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to update game settings");
  }
  return data;
};

// Start the game (host only)
export const startGame = async (gameId) => {
  const response = await authFetch(`${API_URL}/start`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ gameId }),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to start game");
  }
  return data;
};

// Transfer money
export const transferMoney = async (gameId, toPlayerId, amount, type, description) => {
  const response = await authFetch(`${API_URL}/transfer`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ gameId, toPlayerId, amount, type, description }),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to transfer money");
  }
  return data;
};

// End the game (host only)
export const endGame = async (gameId) => {
  const response = await authFetch(`${API_URL}/end`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ gameId }),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to end game");
  }
  return data;
};

// Request GO salary (requires approval)
export const requestGoSalary = async (gameId) => {
  const response = await authFetch(`${API_URL}/request-go`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ gameId }),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to request GO salary");
  }
  return data;
};

// Request bank receive (requires approval)
export const requestBankReceive = async (gameId, amount, description) => {
  const response = await authFetch(`${API_URL}/request-bank-receive`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ gameId, amount, description }),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to request bank receive");
  }
  return data;
};

// Approve or deny a pending request
export const approveRequest = async (gameId, requestId, approved) => {
  const response = await authFetch(`${API_URL}/approve-request`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ gameId, requestId, approved }),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to process request");
  }
  return data;
};

// Update game activity timestamp
export const updateActivity = async (gameId) => {
  const response = await authFetch(`${API_URL}/activity`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ gameId }),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to update activity");
  }
  return data;
};

// Check if game is idle
export const checkIdleStatus = async (gameId) => {
  const response = await authFetch(`${API_URL}/check-idle/${gameId}`, {
    headers: getAuthHeaders(),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to check idle status");
  }
  return data;
};

// Get saved games (idle-timed-out games)
export const getSavedGames = async () => {
  const response = await authFetch(`${API_URL}/saved`, {
    headers: getAuthHeaders(),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to get saved games");
  }
  return data;
};

// Resume a saved game
export const resumeGame = async (gameId) => {
  const response = await authFetch(`${API_URL}/resume`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ gameId }),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to resume game");
  }
  return data;
};

// Delete a saved game
export const deleteSavedGame = async (gameId) => {
  const response = await authFetch(`${API_URL}/saved/${gameId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to delete saved game");
  }
  return data;
};

// Save game for later (host only)
export const saveGame = async (gameId) => {
  const response = await authFetch(`${API_URL}/save`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ gameId }),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to save game");
  }
  return data;
};

export const buyProperty = async (gameId, propertyName, colorGroup, price) => {
  const response = await authFetch(`${API_URL}/property/buy`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ gameId, propertyName, colorGroup, price }),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to buy property");
  }
  return data;
};

export const sellProperty = async (gameId, propertyName, price) => {
  const response = await authFetch(`${API_URL}/property/sell`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ gameId, propertyName, price }),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to sell property");
  }
  return data;
};

export const requestPropertyTrade = async (gameId, propertyName, targetPlayerId, amount) => {
  const response = await authFetch(`${API_URL}/request-property-trade`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ gameId, propertyName, targetPlayerId, amount }),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to request property trade");
  }
  return data;
};

export const manageHouse = async (gameId, propertyName, action, cost) => {
  const response = await authFetch(`${API_URL}/property/house`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ gameId, propertyName, action, cost }),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to manage house");
  }
  return data;
};

export const mortgageProperty = async (gameId, propertyName, action, value) => {
  const response = await authFetch(`${API_URL}/property/mortgage`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ gameId, propertyName, action, value }),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to mortgage property");
  }
  return data;
};
