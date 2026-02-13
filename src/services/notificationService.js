/**
 * Notification Service
 * Handles web push notifications for game invites and other alerts
 */

class NotificationService {
  constructor() {
    this.permission = 'default';
    this.supported = 'Notification' in window;
  }

  /**
   * Check if notifications are supported
   */
  isSupported() {
    return this.supported;
  }

  /**
   * Request notification permission
   * @returns {Promise<string>} - 'granted', 'denied', or 'default'
   */
  async requestPermission() {
    if (!this.supported) {
      console.warn('Notifications not supported');
      return 'denied';
    }

    try {
      this.permission = await Notification.requestPermission();
      return this.permission;
    } catch (err) {
      console.error('Failed to request notification permission:', err);
      return 'denied';
    }
  }

  /**
   * Check current permission status
   */
  getPermission() {
    if (!this.supported) return 'denied';
    return Notification.permission;
  }

  /**
   * Show a notification
   * @param {string} title - Notification title
   * @param {Object} options - Notification options
   * @returns {Notification|null}
   */
  show(title, options = {}) {
    if (!this.supported) return null;
    if (Notification.permission !== 'granted') return null;

    const defaultOptions = {
      icon: '/images/mr-monopoly-icon.png',
      badge: '/images/mr-monopoly-icon.png',
      vibrate: [200, 100, 200],
      requireInteraction: false,
      silent: false,
      ...options,
    };

    try {
      const notification = new Notification(title, defaultOptions);
      
      // Auto-close after 5 seconds if not requireInteraction
      if (!options.requireInteraction) {
        setTimeout(() => notification.close(), 5000);
      }

      return notification;
    } catch (err) {
      console.error('Failed to show notification:', err);
      return null;
    }
  }

  /**
   * Send a game invite notification
   * @param {string} fromUser - Name of the user sending the invite
   * @param {string} gameCode - The game code to join
   * @param {string} gameName - The name of the game
   */
  sendGameInvite(fromUser, gameCode, gameName = 'Monopoly Game') {
    return this.show(`${fromUser} invited you to play!`, {
      body: `Join "${gameName}" with code: ${gameCode}`,
      tag: `game-invite-${gameCode}`,
      requireInteraction: true,
      data: { gameCode, type: 'game-invite' },
      actions: [
        { action: 'join', title: 'Join Game' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    });
  }

  /**
   * Send a friend request notification
   * @param {string} fromUser - Name of the user sending the request
   */
  sendFriendRequest(fromUser) {
    return this.show('New Friend Request', {
      body: `${fromUser} wants to be your friend!`,
      tag: `friend-request-${fromUser}`,
    });
  }

  /**
   * Send a game start notification
   * @param {string} gameName - The name of the game
   */
  sendGameStarted(gameName) {
    return this.show('Game Starting!', {
      body: `${gameName} is about to begin!`,
      tag: 'game-start',
    });
  }

  /**
   * Send a player joined notification
   * @param {string} playerName - Name of the player who joined
   * @param {string} gameName - The name of the game
   */
  sendPlayerJoined(playerName, gameName) {
    return this.show('Player Joined', {
      body: `${playerName} joined ${gameName}`,
      tag: `player-joined-${playerName}`,
    });
  }
}

export const notificationService = new NotificationService();
export default notificationService;
