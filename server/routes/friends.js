import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

// Middleware to verify token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired. Please sign in again.' });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Helper: Return populated friends data for a user (reused across routes)
const getPopulatedFriendsData = async (userId) => {
  const user = await User.findById(userId)
    .populate('friends', 'uid username displayName avatar stats.gamesPlayed stats.gamesWon')
    .populate('friendRequests.received.from', 'uid username displayName avatar')
    .populate('friendRequests.sent.to', 'uid username displayName avatar')
    .lean();

  if (!user) return null;

  return {
    friends: user.friends || [],
    pendingReceived: user.friendRequests?.received || [],
    pendingSent: user.friendRequests?.sent || [],
  };
};

// Get friends list
router.get('/list', verifyToken, async (req, res) => {
  try {
    const data = await getPopulatedFriendsData(req.userId);

    if (!data) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ success: true, ...data });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search users by UID or username — parallel queries with Set-based lookups
router.get('/search', verifyToken, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ message: 'Search query too short' });
    }

    // Escape regex special characters to prevent ReDoS
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Fetch current user (lean, minimal fields) and search results in parallel
    const [currentUser, users] = await Promise.all([
      User.findById(req.userId)
        .select('friends friendRequests')
        .lean(),
      User.find({
        _id: { $ne: req.userId },
        $or: [
          { uid: { $regex: escapedQuery, $options: 'i' } },
          { username: { $regex: escapedQuery, $options: 'i' } },
          { displayName: { $regex: escapedQuery, $options: 'i' } },
        ],
      })
        .select('uid username displayName avatar')
        .limit(15)
        .lean(),
    ]);

    // Build fast O(1) lookup sets instead of O(n) .some() per user
    const friendSet = new Set(currentUser.friends?.map(id => id.toString()) || []);
    const sentSet = new Set(
      currentUser.friendRequests?.sent?.map(r => r.to.toString()) || []
    );
    const receivedSet = new Set(
      currentUser.friendRequests?.received?.map(r => r.from.toString()) || []
    );

    const usersWithStatus = users.map(user => {
      const id = user._id.toString();
      let status = 'none';
      if (friendSet.has(id)) status = 'friend';
      else if (sentSet.has(id)) status = 'pending_sent';
      else if (receivedSet.has(id)) status = 'pending_received';

      return { ...user, status };
    });

    res.json({ success: true, users: usersWithStatus });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send friend request — returns updated sent list so client skips refetch
router.post('/request', verifyToken, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const userId = req.userId;

    if (userId === targetUserId) {
      return res.status(400).json({ message: 'Cannot send friend request to yourself' });
    }

    const [currentUser, targetUser] = await Promise.all([
      User.findById(userId),
      User.findById(targetUserId),
    ]);

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (currentUser.friends.includes(targetUserId)) {
      return res.status(400).json({ message: 'Already friends with this user' });
    }

    const alreadySent = currentUser.friendRequests.sent.some(
      r => r.to.toString() === targetUserId
    );
    if (alreadySent) {
      return res.status(400).json({ message: 'Friend request already sent' });
    }

    const hasReceivedRequest = currentUser.friendRequests.received.some(
      r => r.from.toString() === targetUserId
    );
    if (hasReceivedRequest) {
      return res.status(400).json({ message: 'This user has already sent you a friend request. Accept it instead!' });
    }

    currentUser.friendRequests.sent.push({ to: targetUserId });
    targetUser.friendRequests.received.push({ from: userId });

    await Promise.all([currentUser.save(), targetUser.save()]);

    // Return updated sent requests so client can update locally
    await currentUser.populate('friendRequests.sent.to', 'uid username displayName avatar');

    res.json({
      success: true,
      message: 'Friend request sent!',
      pendingSent: currentUser.friendRequests.sent,
    });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Accept friend request — returns full updated data
router.post('/accept', verifyToken, async (req, res) => {
  try {
    const { requesterId } = req.body;
    const userId = req.userId;

    const [currentUser, requester] = await Promise.all([
      User.findById(userId),
      User.findById(requesterId),
    ]);

    if (!requester) {
      return res.status(404).json({ message: 'User not found' });
    }

    const requestIndex = currentUser.friendRequests.received.findIndex(
      r => r.from.toString() === requesterId
    );
    if (requestIndex === -1) {
      return res.status(400).json({ message: 'No friend request from this user' });
    }

    // Remove from pending requests (FIXED: no longer shadows `req`)
    currentUser.friendRequests.received.splice(requestIndex, 1);
    
    const sentIndex = requester.friendRequests.sent.findIndex(
      r => r.to.toString() === userId
    );
    if (sentIndex !== -1) {
      requester.friendRequests.sent.splice(sentIndex, 1);
    }

    // Add to friends list (avoid duplicates)
    if (!currentUser.friends.includes(requesterId)) {
      currentUser.friends.push(requesterId);
    }
    if (!requester.friends.includes(userId)) {
      requester.friends.push(userId);
    }

    await Promise.all([currentUser.save(), requester.save()]);

    // Return full updated data so client doesn't need to refetch
    const data = await getPopulatedFriendsData(userId);

    res.json({ success: true, message: 'Friend request accepted!', ...data });
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject friend request — returns updated received list
router.post('/reject', verifyToken, async (req, res) => {
  try {
    const { requesterId } = req.body;
    const userId = req.userId;

    const [currentUser, requester] = await Promise.all([
      User.findById(userId),
      User.findById(requesterId),
    ]);

    if (!requester) {
      return res.status(404).json({ message: 'User not found' });
    }

    const requestIndex = currentUser.friendRequests.received.findIndex(
      r => r.from.toString() === requesterId
    );
    if (requestIndex !== -1) {
      currentUser.friendRequests.received.splice(requestIndex, 1);
    }

    // FIXED: no longer shadows `req`
    const sentIndex = requester.friendRequests.sent.findIndex(
      r => r.to.toString() === userId
    );
    if (sentIndex !== -1) {
      requester.friendRequests.sent.splice(sentIndex, 1);
    }

    await Promise.all([currentUser.save(), requester.save()]);

    // Return updated received requests
    await currentUser.populate('friendRequests.received.from', 'uid username displayName avatar');

    res.json({
      success: true,
      message: 'Friend request rejected',
      pendingReceived: currentUser.friendRequests.received,
    });
  } catch (error) {
    console.error('Reject friend request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Cancel sent friend request — returns updated sent list
router.post('/cancel', verifyToken, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const userId = req.userId;

    const [currentUser, targetUser] = await Promise.all([
      User.findById(userId),
      User.findById(targetUserId),
    ]);

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const sentIndex = currentUser.friendRequests.sent.findIndex(
      r => r.to.toString() === targetUserId
    );
    if (sentIndex !== -1) {
      currentUser.friendRequests.sent.splice(sentIndex, 1);
    }

    // FIXED: no longer shadows `req`
    const receivedIndex = targetUser.friendRequests.received.findIndex(
      r => r.from.toString() === userId
    );
    if (receivedIndex !== -1) {
      targetUser.friendRequests.received.splice(receivedIndex, 1);
    }

    await Promise.all([currentUser.save(), targetUser.save()]);

    // Return updated sent requests
    await currentUser.populate('friendRequests.sent.to', 'uid username displayName avatar');

    res.json({
      success: true,
      message: 'Friend request cancelled',
      pendingSent: currentUser.friendRequests.sent,
    });
  } catch (error) {
    console.error('Cancel friend request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove friend — returns updated friends list
router.post('/remove', verifyToken, async (req, res) => {
  try {
    const { friendId } = req.body;
    const userId = req.userId;

    const [currentUser, friend] = await Promise.all([
      User.findById(userId),
      User.findById(friendId),
    ]);

    if (!friend) {
      return res.status(404).json({ message: 'User not found' });
    }

    currentUser.friends = currentUser.friends.filter(
      id => id.toString() !== friendId
    );
    friend.friends = friend.friends.filter(
      id => id.toString() !== userId
    );

    await Promise.all([currentUser.save(), friend.save()]);

    // Return updated friends list
    await currentUser.populate('friends', 'uid username displayName avatar stats.gamesPlayed stats.gamesWon');

    res.json({
      success: true,
      message: 'Friend removed',
      friends: currentUser.friends,
    });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send game invite to a friend
router.post('/invite-to-game', verifyToken, async (req, res) => {
  try {
    const { targetUserId, gameId, gameCode, gameName } = req.body;

    const [currentUser, targetUser] = await Promise.all([
      User.findById(req.userId).select('friends').lean(),
      User.findById(targetUserId),
    ]);

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const areFriends = currentUser.friends.some(
      friendId => friendId.toString() === targetUserId
    );

    if (!areFriends) {
      return res.status(400).json({ message: 'You can only invite friends to games' });
    }

    const existingInvite = targetUser.gameInvites.find(
      invite => invite.gameCode === gameCode && invite.from.toString() === req.userId
    );

    if (existingInvite) {
      return res.json({ success: true, message: 'Invite already sent' });
    }

    targetUser.gameInvites.push({
      from: req.userId,
      gameId,
      gameCode,
      gameName: gameName || 'Monopoly Game',
    });

    await targetUser.save();

    res.json({ success: true, message: 'Game invite sent' });
  } catch (error) {
    console.error('Send game invite error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get game invites
router.get('/game-invites', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('gameInvites')
      .populate('gameInvites.from', 'username displayName avatar uid')
      .lean();

    res.json({ 
      success: true, 
      invites: user?.gameInvites || [],
    });
  } catch (error) {
    console.error('Get game invites error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Dismiss game invite — atomic pull, no full doc load
router.post('/dismiss-invite', verifyToken, async (req, res) => {
  try {
    const { inviteId } = req.body;

    await User.findByIdAndUpdate(req.userId, {
      $pull: { gameInvites: { _id: inviteId } },
    });

    res.json({ success: true, message: 'Invite dismissed' });
  } catch (error) {
    console.error('Dismiss invite error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
