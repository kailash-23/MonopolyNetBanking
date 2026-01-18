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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.userId = decoded.id; // Fixed: was decoded.userId, should be decoded.id
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Get friends list
router.get('/list', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate('friends', 'uid username displayName avatar stats.gamesPlayed stats.gamesWon')
      .populate('friendRequests.received.from', 'uid username displayName avatar')
      .populate('friendRequests.sent.to', 'uid username displayName avatar');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      success: true,
      friends: user.friends,
      pendingReceived: user.friendRequests.received,
      pendingSent: user.friendRequests.sent
    });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search users by UID or username
router.get('/search', verifyToken, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ message: 'Search query too short' });
    }

    const users = await User.find({
      $and: [
        { _id: { $ne: req.userId } },
        {
          $or: [
            { uid: { $regex: query, $options: 'i' } },
            { username: { $regex: query, $options: 'i' } },
            { displayName: { $regex: query, $options: 'i' } }
          ]
        }
      ]
    })
    .select('uid username displayName avatar')
    .limit(10);

    // Get current user to check friend status
    const currentUser = await User.findById(req.userId);
    
    const usersWithStatus = users.map(user => {
      const isFriend = currentUser.friends.includes(user._id);
      const hasSentRequest = currentUser.friendRequests.sent.some(
        req => req.to.toString() === user._id.toString()
      );
      const hasReceivedRequest = currentUser.friendRequests.received.some(
        req => req.from.toString() === user._id.toString()
      );

      return {
        ...user.toJSON(),
        status: isFriend ? 'friend' : hasSentRequest ? 'pending_sent' : hasReceivedRequest ? 'pending_received' : 'none'
      };
    });

    res.json({ success: true, users: usersWithStatus });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send friend request
router.post('/request', verifyToken, async (req, res) => {
  try {
    const { targetUserId } = req.body;

    if (req.userId === targetUserId) {
      return res.status(400).json({ message: 'Cannot send friend request to yourself' });
    }

    const [currentUser, targetUser] = await Promise.all([
      User.findById(req.userId),
      User.findById(targetUserId)
    ]);

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already friends
    if (currentUser.friends.includes(targetUserId)) {
      return res.status(400).json({ message: 'Already friends with this user' });
    }

    // Check if request already sent
    const alreadySent = currentUser.friendRequests.sent.some(
      req => req.to.toString() === targetUserId
    );
    if (alreadySent) {
      return res.status(400).json({ message: 'Friend request already sent' });
    }

    // Check if target has already sent us a request
    const hasReceivedRequest = currentUser.friendRequests.received.some(
      req => req.from.toString() === targetUserId
    );
    if (hasReceivedRequest) {
      return res.status(400).json({ message: 'This user has already sent you a friend request. Accept it instead!' });
    }

    // Add to sent requests
    currentUser.friendRequests.sent.push({ to: targetUserId });
    targetUser.friendRequests.received.push({ from: req.userId });

    await Promise.all([currentUser.save(), targetUser.save()]);

    res.json({ success: true, message: 'Friend request sent!' });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Accept friend request
router.post('/accept', verifyToken, async (req, res) => {
  try {
    const { requesterId } = req.body;

    const [currentUser, requester] = await Promise.all([
      User.findById(req.userId),
      User.findById(requesterId)
    ]);

    if (!requester) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if request exists
    const requestIndex = currentUser.friendRequests.received.findIndex(
      req => req.from.toString() === requesterId
    );
    if (requestIndex === -1) {
      return res.status(400).json({ message: 'No friend request from this user' });
    }

    // Remove from pending requests
    currentUser.friendRequests.received.splice(requestIndex, 1);
    
    const sentIndex = requester.friendRequests.sent.findIndex(
      req => req.to.toString() === req.userId
    );
    if (sentIndex !== -1) {
      requester.friendRequests.sent.splice(sentIndex, 1);
    }

    // Add to friends list
    currentUser.friends.push(requesterId);
    requester.friends.push(req.userId);

    await Promise.all([currentUser.save(), requester.save()]);

    // Get updated friend data
    const newFriend = await User.findById(requesterId)
      .select('uid username displayName avatar stats.gamesPlayed stats.gamesWon');

    res.json({ success: true, message: 'Friend request accepted!', friend: newFriend });
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject friend request
router.post('/reject', verifyToken, async (req, res) => {
  try {
    const { requesterId } = req.body;

    const [currentUser, requester] = await Promise.all([
      User.findById(req.userId),
      User.findById(requesterId)
    ]);

    if (!requester) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove from received requests
    const requestIndex = currentUser.friendRequests.received.findIndex(
      req => req.from.toString() === requesterId
    );
    if (requestIndex !== -1) {
      currentUser.friendRequests.received.splice(requestIndex, 1);
    }

    // Remove from sent requests
    const sentIndex = requester.friendRequests.sent.findIndex(
      req => req.to.toString() === req.userId
    );
    if (sentIndex !== -1) {
      requester.friendRequests.sent.splice(sentIndex, 1);
    }

    await Promise.all([currentUser.save(), requester.save()]);

    res.json({ success: true, message: 'Friend request rejected' });
  } catch (error) {
    console.error('Reject friend request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Cancel sent friend request
router.post('/cancel', verifyToken, async (req, res) => {
  try {
    const { targetUserId } = req.body;

    const [currentUser, targetUser] = await Promise.all([
      User.findById(req.userId),
      User.findById(targetUserId)
    ]);

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove from sent requests
    const sentIndex = currentUser.friendRequests.sent.findIndex(
      req => req.to.toString() === targetUserId
    );
    if (sentIndex !== -1) {
      currentUser.friendRequests.sent.splice(sentIndex, 1);
    }

    // Remove from received requests
    const receivedIndex = targetUser.friendRequests.received.findIndex(
      req => req.from.toString() === req.userId
    );
    if (receivedIndex !== -1) {
      targetUser.friendRequests.received.splice(receivedIndex, 1);
    }

    await Promise.all([currentUser.save(), targetUser.save()]);

    res.json({ success: true, message: 'Friend request cancelled' });
  } catch (error) {
    console.error('Cancel friend request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove friend
router.post('/remove', verifyToken, async (req, res) => {
  try {
    const { friendId } = req.body;

    const [currentUser, friend] = await Promise.all([
      User.findById(req.userId),
      User.findById(friendId)
    ]);

    if (!friend) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove from both friend lists
    currentUser.friends = currentUser.friends.filter(
      id => id.toString() !== friendId
    );
    friend.friends = friend.friends.filter(
      id => id.toString() !== req.userId
    );

    await Promise.all([currentUser.save(), friend.save()]);

    res.json({ success: true, message: 'Friend removed' });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
