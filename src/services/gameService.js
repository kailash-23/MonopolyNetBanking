const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";
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
  const response = await fetch(`${API_URL}/create`, {
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
  const response = await fetch(`${API_URL}/join`, {
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
  const response = await fetch(`${API_URL}/leave`, {
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
  const response = await fetch(`${API_URL}/${code}`, {
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
  const response = await fetch(`${API_URL}/my/active`, {
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
  const response = await fetch(`${API_URL}/ready`, {
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

// Start the game (host only)
export const startGame = async (gameId) => {
  const response = await fetch(`${API_URL}/start`, {
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
  const response = await fetch(`${API_URL}/transfer`, {
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
  const response = await fetch(`${API_URL}/end`, {
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

// Request GO salary (requires host approval)
export const requestGoSalary = async (gameId) => {
  const response = await fetch(`${API_URL}/request-go`, {
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

// Approve or deny GO salary request (host only)
export const approveGoSalary = async (gameId, requestId, approved) => {
  const response = await fetch(`${API_URL}/approve-go`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ gameId, requestId, approved }),
  });

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(data.message || "Failed to process GO request");
  }
  return data;
};
