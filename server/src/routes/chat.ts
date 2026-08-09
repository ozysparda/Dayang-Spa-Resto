import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { chatConversations, chatParticipants, chatMessages, users, staffProfiles, outlets } from '../db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/chat/conversations - Get user's conversations
router.get('/conversations', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const userOutletId = req.user.outletId;

    // Get conversations where user is a participant
    const userConversations = await db.select({
      id: chatConversations.id,
      name: chatConversations.name,
      isGroup: chatConversations.isGroup,
      outletId: chatConversations.outletId,
      createdBy: chatConversations.createdBy,
      createdAt: chatConversations.createdAt,
    })
      .from(chatConversations)
      .innerJoin(chatParticipants, eq(chatConversations.id, chatParticipants.conversationId))
      .where(eq(chatParticipants.userId, userId))
      .orderBy(desc(chatConversations.createdAt));

    // Get last message and unread count for each conversation
    const conversationsWithDetails = await Promise.all(
      userConversations.map(async (conversation) => {
        // Get last message
        const lastMessage = await db.select({
          content: chatMessages.content,
          senderName: users.username,
          createdAt: chatMessages.createdAt,
        })
          .from(chatMessages)
          .leftJoin(users, eq(chatMessages.senderId, users.id))
          .where(eq(chatMessages.conversationId, conversation.id))
          .orderBy(desc(chatMessages.createdAt))
          .limit(1);

        // Get unread count
        const unreadCount = await db.select({ count: sql<number>`count(*)` })
          .from(chatMessages)
          .where(and(
            eq(chatMessages.conversationId, conversation.id),
            eq(chatMessages.isRead, false),
            sql`${chatMessages.senderId} != ${userId}`
          ));

        // Get participants
        const participants = await db.select({
          userId: users.id,
          username: users.username,
          name: staffProfiles.name,
        })
          .from(chatParticipants)
          .leftJoin(users, eq(chatParticipants.userId, users.id))
          .leftJoin(staffProfiles, eq(users.id, staffProfiles.userId))
          .where(eq(chatParticipants.conversationId, conversation.id));

        return {
          ...conversation,
          lastMessage: lastMessage[0] || null,
          unreadCount: Number(unreadCount[0]?.count || 0),
          participants,
        };
      })
    );

    res.json(conversationsWithDetails);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Failed to fetch conversations' });
  }
});

// GET /api/chat/conversations/:id/messages - Get messages in a conversation
router.get('/conversations/:id/messages', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    // Check if user is a participant
    const participant = await db.select()
      .from(chatParticipants)
      .where(and(
        eq(chatParticipants.conversationId, id),
        eq(chatParticipants.userId, userId)
      ))
      .limit(1);

    if (!participant.length) {
      return res.status(403).json({ message: 'Not a participant of this conversation' });
    }

    // Get messages
    const messages = await db.select({
      id: chatMessages.id,
      conversationId: chatMessages.conversationId,
      senderId: chatMessages.senderId,
      senderName: users.username,
      content: chatMessages.content,
      isRead: chatMessages.isRead,
      createdAt: chatMessages.createdAt,
    })
      .from(chatMessages)
      .leftJoin(users, eq(chatMessages.senderId, users.id))
      .where(eq(chatMessages.conversationId, id))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    // Mark messages as read
    await db.update(chatMessages)
      .set({ isRead: true })
      .where(and(
        eq(chatMessages.conversationId, id),
        sql`${chatMessages.senderId} != ${userId}`
      ));

    res.json(messages.reverse());
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

// POST /api/chat/conversations/:id/messages - Send message
router.post('/conversations/:id/messages', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    // Check if user is a participant
    const participant = await db.select()
      .from(chatParticipants)
      .where(and(
        eq(chatParticipants.conversationId, id),
        eq(chatParticipants.userId, userId)
      ))
      .limit(1);

    if (!participant.length) {
      return res.status(403).json({ message: 'Not a participant of this conversation' });
    }

    // Create message
    const newMessage = await db.insert(chatMessages).values({
      id: uuidv4(),
      conversationId: id,
      senderId: userId,
      content,
      isRead: false,
    }).returning();

    res.status(201).json(newMessage[0]);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Failed to send message' });
  }
});

// POST /api/chat/conversations - Create new conversation
router.post('/conversations', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { name, isGroup, participantIds } = req.body;

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length < 1) {
      return res.status(400).json({ message: 'At least one participant is required' });
    }

    // Create conversation
    const newConversation = await db.insert(chatConversations).values({
      id: uuidv4(),
      name,
      isGroup: isGroup || false,
      outletId: userOutletId,
      createdBy: req.user.id,
    }).returning();

    // Add participants (including the creator)
    const allParticipants = [req.user.id, ...participantIds];
    const uniqueParticipants = [...new Set(allParticipants)];

    await db.insert(chatParticipants).values(
      uniqueParticipants.map(participantId => ({
        id: uuidv4(),
        conversationId: newConversation[0].id,
        userId: participantId,
      }))
    );

    res.status(201).json(newConversation[0]);
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ message: 'Failed to create conversation' });
  }
});

export default router;