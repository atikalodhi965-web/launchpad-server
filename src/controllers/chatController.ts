/**
 * File: server/src/controllers/chatController.ts
 * 
 * Controller for chat-related operations:
 * - Get user's chat rooms
 * - Create chat rooms
 * - Get messages for a chat room
 * - Send messages
 * - Edit messages
 * - Delete messages
 */
import { Request, Response } from 'express';
import knex from '../db/knex';

function parseLimitOffset(req: Request) {
  const limitRaw = (req.query.limit as string | undefined) ?? '20';
  const offsetRaw = (req.query.offset as string | undefined) ?? '0';
  const limit = Math.min(100, Math.max(1, Number(limitRaw) || 20));
  const offset = Math.max(0, Number(offsetRaw) || 0);
  return { limit, offset };
}

/**
 * Get all chat rooms for a user
 */
export async function getUserChats(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId' });
    }

    // Get all chat rooms where the user is a participant
    const chats = await knex('chat_rooms')
      .join('chat_participants', 'chat_rooms.id', 'chat_participants.chat_room_id')
      .where('chat_participants.user_id', userId)
      .where('chat_rooms.is_active', true)
      .select('chat_rooms.*');

    // For each chat, get the participants
    const chatsWithParticipants = await Promise.all(
      chats.map(async (chat) => {
        // Get participants for this chat
        const participants = await knex('chat_participants')
          .join('users', 'chat_participants.user_id', 'users.privy_id')
          .where('chat_participants.chat_room_id', chat.id)
          .select(
            'users.privy_id as id',
            'users.username',
            'users.profile_image_url as profile_picture_url',
            'chat_participants.is_admin'
          );

        // Get the last message for the chat
        const lastMessage = await knex('chat_messages')
          .where('chat_room_id', chat.id)
          .where('is_deleted', false)
          .orderBy('created_at', 'desc')
          .first();

        return {
          ...chat,
          participants,
          lastMessage: lastMessage || null,
          unreadCount: 0, // For future implementation
        };
      })
    );

    return res.json({ success: true, chats: chatsWithParticipants });
  } catch (error: any) {
    console.error('[Get User Chats Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Create a new direct chat between two users
 */
export async function createDirectChat(req: Request, res: Response) {
  try {
    const { userId, otherUserId } = req.body;
    
    if (!userId || !otherUserId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing userId or otherUserId' 
      });
    }

    if (userId === otherUserId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot create chat with yourself' 
      });
    }

    // Check if users exist
    const users = await knex('users')
      .whereIn('privy_id', [userId, otherUserId])
      .select('privy_id', 'username');

    if (users.length !== 2) {
      return res.status(404).json({ 
        success: false, 
        error: 'One or both users not found' 
      });
    }

    // Check if a direct chat between these users already exists
    const existingChat = await knex('chat_rooms')
      .join('chat_participants as p1', 'chat_rooms.id', 'p1.chat_room_id')
      .join('chat_participants as p2', 'chat_rooms.id', 'p2.chat_room_id')
      .where('chat_rooms.type', 'direct')
      .where('p1.user_id', userId)
      .where('p2.user_id', otherUserId)
      .first('chat_rooms.id');

    if (existingChat) {
      return res.json({ 
        success: true, 
        chatId: existingChat.id,
        message: 'Chat already exists' 
      });
    }

    // Create a new chat room
    const [chatRoom] = await knex('chat_rooms')
      .insert({
        type: 'direct',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    // Add both users as participants
    await knex('chat_participants').insert([
      {
        chat_room_id: chatRoom.id,
        user_id: userId,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        chat_room_id: chatRoom.id,
        user_id: otherUserId,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    return res.json({ 
      success: true, 
      chatId: chatRoom.id,
      message: 'Chat created successfully' 
    });
  } catch (error: any) {
    console.error('[Create Direct Chat Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  } 
}

/**
 * Create a new group chat
 */
export async function createGroupChat(req: Request, res: Response) {
  try {
    const { name, userId, participantIds } = req.body;
    
    if (!name || !userId || !participantIds || !participantIds.length) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    // Ensure all participants (including the creator) exist
    const allParticipantIds = [...new Set([userId, ...participantIds])];
    const users = await knex('users')
      .whereIn('privy_id', allParticipantIds)
      .select('privy_id');

    if (users.length !== allParticipantIds.length) {
      return res.status(404).json({ 
        success: false, 
        error: 'One or more users not found' 
      });
    }

    // Create a new chat room
    const [chatRoom] = await knex('chat_rooms')
      .insert({
        type: 'group',
        name,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    // Add all participants, with the creator as admin
    const participantsToInsert = allParticipantIds.map(id => ({
      chat_room_id: chatRoom.id,
      user_id: id,
      is_admin: id === userId, // Creator is admin
      created_at: new Date(),
      updated_at: new Date(),
    }));

    await knex('chat_participants').insert(participantsToInsert);

    return res.json({ 
      success: true, 
      chatId: chatRoom.id,
      message: 'Group chat created successfully' 
    });
  } catch (error: any) {
    console.error('[Create Group Chat Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Create a public group chat
 * Body: { name, userId, description? }
 * Public groups can be joined by anyone without invitation
 */
export async function createPublicGroup(req: Request, res: Response) {
  try {
    const { name, userId, description, imageUrl } = req.body;
    
    if (!name || !userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: name, userId' 
      });
    }

    // Ensure creator exists
    const creator = await knex('users')
      .where('privy_id', userId)
      .first('privy_id', 'username');

    if (!creator) {
      return res.status(404).json({ 
        success: false, 
        error: 'Creator user not found' 
      });
    }

    // Create a new public chat room
    const [chatRoom] = await knex('chat_rooms')
      .insert({
        type: 'group',
        name: name.trim(),
        meta_data: {
          isPublic: true,
          createdBy: userId,
          description: description?.trim() || null,
          imageUrl: imageUrl || null,
        },
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    // Add creator as admin participant
    await knex('chat_participants').insert({
      chat_room_id: chatRoom.id,
      user_id: userId,
      is_admin: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return res.json({ 
      success: true, 
      chatId: chatRoom.id,
      chat: {
        id: chatRoom.id,
        type: chatRoom.type,
        name: chatRoom.name,
        isPublic: true,
        createdBy: userId,
        description: description?.trim() || null,
        memberCount: 1,
        createdAt: chatRoom.created_at,
      },
      message: 'Public group created successfully' 
    });
  } catch (error: any) {
    console.error('[Create Public Group Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get chat messages for a specific chat room
 */
export async function getChatMessages(req: Request, res: Response) {
  try {
    const { chatId } = req.params;
    const { limit = 50, before } = req.query;
    
    if (!chatId) {
      return res.status(400).json({ success: false, error: 'Missing chatId' });
    }

    // Build query to get messages
    let query = knex('chat_messages')
      .where('chat_room_id', chatId)
      .where('is_deleted', false)
      .orderBy('created_at', 'desc')
      .limit(Number(limit));

    // If 'before' timestamp is provided, get messages before that time
    if (before) {
      query = query.where('created_at', '<', before as any);
    }

    const messages = await query;

    // Get sender information for each message
    const messagesWithSenders = await Promise.all(
      messages.map(async (message) => {
        const sender = await knex('users')
          .where('privy_id', message.sender_id)
          .first(
            'privy_id as id',
            'username',
            'profile_image_url as profile_picture_url'
          );

        return {
          ...message,
          sender,
        };
      })
    );

    return res.json({ 
      success: true, 
      messages: messagesWithSenders.reverse() // Reverse to get chronological order
    });
  } catch (error: any) {
    console.error('[Get Chat Messages Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Send a message to a chat room
 */
export async function sendMessage(req: Request, res: Response) {
  try {
    const { chatId, userId, content, imageUrl, additionalData } = req.body;
    
    // Updated Validation:
    // Check for essential IDs first
    if (!chatId || !userId) {
       return res.status(400).json({ 
        success: false, 
        error: 'Missing required chatId or userId.' 
      });
    }
    
    // Now check if *any* content type is present
    const hasText = content && content.trim() !== '';
    const hasImage = !!imageUrl;
    const hasTradeData = additionalData && !!additionalData.tradeData;
    const hasNftData = additionalData && !!additionalData.nftData;

    if (!hasText && !hasImage && !hasTradeData && !hasNftData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Message must contain text, an image, trade data, or NFT data.' 
      });
    }

    // Check if chat exists
    const chat = await knex('chat_rooms')
      .where('id', chatId)
      .first();

    if (!chat) {
      return res.status(404).json({ 
        success: false, 
        error: 'Chat not found' 
      });
    }

    // For global chats, skip participant check
    if (chat.type === 'global') {
      // Allow sending to global chat without being a participant
    } else {
      // Check if user is a participant
      const participant = await knex('chat_participants')
        .where('chat_room_id', chatId)
        .where('user_id', userId)
        .first();

      if (!participant) {
        // For public groups, auto-add the participant
        if (chat.type === 'group' && String(chat.meta_data?.isPublic ?? 'false') === 'true') {
          // Check if user exists
          const userExists = await knex('users').where('privy_id', userId).first();
          if (!userExists) {
            return res.status(404).json({ 
              success: false, 
              error: 'User not found' 
            });
          }
          await knex('chat_participants')
            .insert({
              chat_room_id: chatId,  
              user_id: userId,
              is_admin: false,
              created_at: new Date(),
              updated_at: new Date(),
            })
            .onConflict(['chat_room_id', 'user_id'])
            .ignore();
        } else {
          return res.status(403).json({ 
            success: false, 
            error: 'User is not a participant in this chat' 
          });
        }
      }
    }

    // Create the message with image URL if provided
    const messageData = {
      chat_room_id: chatId,
      sender_id: userId,
      content: content || '',
      image_url: imageUrl || null,
      additional_data: additionalData || null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const [message] = await knex('chat_messages')
      .insert(messageData)
      .returning('*');

    // Get sender information
    const sender = await knex('users')
      .where('privy_id', userId)
      .first('privy_id as id', 'username', 'profile_image_url as profile_picture_url');

    const messageWithSender = {
      ...message,
      sender,
    };

    return res.json({ 
      success: true, 
      message: messageWithSender
    });
  } catch (error: any) {
    console.error('[Send Message Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Setup global chat room - to be called during app initialization
 */
export async function setupGlobalChat() {
  try {
    // Check if global chat already exists
    const globalChat = await knex('chat_rooms')
      .where('type', 'global')
      .first();

    if (globalChat) {
      console.log('Global chat already exists:', globalChat.id);
      return globalChat.id;
    }

    // Create global chat
    const [chatRoom] = await knex('chat_rooms')
      .insert({
        type: 'global',
        name: 'Global Community',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    console.log('Global chat created:', chatRoom.id);
    return chatRoom.id;
  } catch (error) {
    console.error('Error setting up global chat:', error);
    throw error;
  }
}

/**
 * Get list of users for starting a new chat
 */
export async function getUsersForChat(req: Request, res: Response) {
  try {
    const { query, userId } = req.query;
    
    let usersQuery = knex('users')
      .select(
        'privy_id as id',
        'username',
        'profile_image_url as profile_picture_url'
      )
      .orderBy('username', 'asc')
      .limit(20);
    
    // Don't include the current user
    if (userId) {
      usersQuery = usersQuery.whereNot('privy_id', userId as string);
    }
    
    // Filter by query if provided
    if (query) {
      usersQuery = usersQuery.where('username', 'ilike', `%${query}%`);
    }
    
    const users = await usersQuery;
    
    return res.json({ 
      success: true, 
      users 
    });
  } catch (error: any) {
    console.error('[Get Users For Chat Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Edit an existing message
 */
export async function editMessage(req: Request, res: Response) {
  console.log(`[Edit Message] Request received for messageId: ${req.params.messageId}`);
  console.log(`[Edit Message] Request body:`, req.body);

  try {
    const { messageId } = req.params;
    const { userId, content } = req.body;
    
    if (!messageId || !userId || !content) {
      console.error('[Edit Message] Missing required fields');
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    // Check if message exists and belongs to the user
    const message = await knex('chat_messages')
      .where('id', messageId)
      // Ensure sender_id is compared correctly
      .whereRaw('LOWER(sender_id) = LOWER(?)', [userId]) 
      .first();

    console.log(`[Edit Message] Found message:`, message);

    if (!message) {
      console.error(`[Edit Message] Message not found or user ${userId} not authorized`);
      return res.status(404).json({ 
        success: false, 
        error: 'Message not found or you are not authorized to edit it' 
      });
    }

    // Update the message
    const [updatedMessage] = await knex('chat_messages')
      .where('id', messageId)
      .update({
        content,
        updated_at: new Date()
      })
      .returning('*');

    console.log(`[Edit Message] Message updated successfully:`, updatedMessage);

    // Get sender information
    const sender = await knex('users')
      .where('privy_id', updatedMessage.sender_id)
      .first('privy_id as id', 'username', 'profile_image_url as profile_picture_url');

    // Return the updated message with sender info
    return res.json({ 
      success: true, 
      message: {
        ...updatedMessage,
        sender
      }
    });
  } catch (error: any) {
    console.error('[Edit Message Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Delete a message
 */
export async function deleteMessage(req: Request, res: Response) {
  console.log(`[Delete Message] Request received for messageId: ${req.params.messageId}`);
  console.log(`[Delete Message] Request body:`, req.body);
  
  try {
    const { messageId } = req.params;
    const { userId } = req.body;
    
    if (!messageId || !userId) {
      console.error('[Delete Message] Missing required fields');
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    // Check if message exists and belongs to the user
    const message = await knex('chat_messages')
      .where('id', messageId)
      // Ensure sender_id is compared correctly (case-insensitive)
      .whereRaw('LOWER(sender_id) = LOWER(?)', [userId]) 
      .first();

    console.log(`[Delete Message] Found message:`, message);

    if (!message) {
      console.error(`[Delete Message] Message not found or user ${userId} not authorized`);
      return res.status(404).json({ 
        success: false, 
        error: 'Message not found or you are not authorized to delete it' 
      });
    }

    // Soft delete the message
    await knex('chat_messages')
      .where('id', messageId)
      .update({
        is_deleted: true,
        // Keep original content? No, update to deleted state.
        content: '[This message has been deleted]',
        updated_at: new Date()
      });

    console.log(`[Delete Message] Message ${messageId} marked as deleted`);

    // Return the chatId along with the messageId for client-side updates
    return res.json({ 
      success: true, 
      messageId,
      chatId: message.chat_room_id, // Add chatId to the response
      message: 'Message deleted successfully' 
    });
  } catch (error: any) {
    console.error('[Delete Message Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
} 

/**
 * List/search public group chats (for "Groups" tab)
 * Query params:
 * - query: string (optional) - search by group name
 * - limit: number (default 20, max 100)
 * - offset: number (default 0)
 */
export async function listPublicGroups(req: Request, res: Response) {
  try {
    const q = ((req.query.query as string | undefined) ?? '').trim();
    const { limit, offset } = parseLimitOffset(req);

    const base = knex('chat_rooms as cr')
      .where('cr.type', 'group')
      .where('cr.is_active', true)
      .whereRaw(`COALESCE(cr.meta_data->>'isPublic','false') = 'true'`);

    if (q) {
      base.andWhere('cr.name', 'ilike', `%${q}%`);
    }

    const rows = await base
      .select([
        'cr.id',
        'cr.type',
        'cr.name',
        'cr.meta_data',
        'cr.is_active',
        'cr.created_at',
        'cr.updated_at',
        knex.raw(
          `(SELECT COUNT(*)::int FROM chat_participants cp WHERE cp.chat_room_id = cr.id) as member_count`
        ),
      ])
      .orderBy('cr.updated_at', 'desc')
      .limit(limit)
      .offset(offset);

    const groups = rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      isActive: r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      memberCount: r.member_count ?? 0,
      // optional fields for UI (stored inside meta_data)
      imageUrl: r.meta_data?.imageUrl ?? null,
      slug: r.meta_data?.slug ?? null,
      link: r.meta_data?.link ?? null,
      volumeUsd: r.meta_data?.volumeUsd ?? null,
    }));

    return res.json({ success: true, count: groups.length, groups });
  } catch (error: any) {
    console.error('[List Public Groups Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Join a public group chat
 * Body: { userId }
 */
export async function joinGroup(req: Request, res: Response) {
  try {
    const { chatId } = req.params;
    const { userId } = req.body;

    if (!chatId || !userId) {
      return res.status(400).json({ success: false, error: 'Missing chatId or userId' });
    }

    const room = await knex('chat_rooms')
      .where({ id: chatId, is_active: true })
      .first(['id', 'type', 'meta_data']);

    if (!room) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }
    if (room.type !== 'group') {
      return res.status(400).json({ success: false, error: 'Chat is not a group' });
    }
    const isPublic = String(room.meta_data?.isPublic ?? 'false') === 'true';
    if (!isPublic) {
      return res.status(403).json({ success: false, error: 'Group is not public' });
    }

    await knex('chat_participants')
      .insert({
        chat_room_id: chatId,
        user_id: userId,
        is_admin: false,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflict(['chat_room_id', 'user_id'])
      .ignore();

    const memberCountRow = await knex('chat_participants')
      .where({ chat_room_id: chatId })
      .count<{ count: string }[]>('* as count');
    const memberCount = Number((memberCountRow as any)?.[0]?.count ?? 0);

    return res.json({ success: true, chatId, memberCount });
  } catch (error: any) {
    console.error('[Join Group Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Leave a group chat
 * Body: { userId }
 */
export async function leaveGroup(req: Request, res: Response) {
  try {
    const { chatId } = req.params;
    const { userId } = req.body;

    if (!chatId || !userId) {
      return res.status(400).json({ success: false, error: 'Missing chatId or userId' });
    }

    const room = await knex('chat_rooms')
      .where({ id: chatId, is_active: true })
      .first(['id', 'type']);

    if (!room) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }
    if (room.type !== 'group') {
      return res.status(400).json({ success: false, error: 'Chat is not a group' });
    }

    await knex('chat_participants')
      .where({ chat_room_id: chatId, user_id: userId })
      .del();

    const memberCountRow = await knex('chat_participants')
      .where({ chat_room_id: chatId })
      .count<{ count: string }[]>('* as count');
    const memberCount = Number((memberCountRow as any)?.[0]?.count ?? 0);

    return res.json({ success: true, chatId, memberCount });
  } catch (error: any) {
    console.error('[Leave Group Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * List members of a group chat (for group header / members count)
 */
export async function listGroupMembers(req: Request, res: Response) {
  try {
    const { chatId } = req.params;
    if (!chatId) {
      return res.status(400).json({ success: false, error: 'Missing chatId' });
    }

    const room = await knex('chat_rooms')
      .where({ id: chatId, is_active: true })
      .first(['id', 'type']);

    if (!room) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }
    if (room.type !== 'group') {
      return res.status(400).json({ success: false, error: 'Chat is not a group' });
    }

    const members = await knex('chat_participants as cp')
      .join('users as u', 'cp.user_id', 'u.privy_id')
      .where('cp.chat_room_id', chatId)
      .select([
        'u.privy_id as id',
        'u.username',
        'u.profile_image_url as profile_image_url',
        'cp.is_admin',
        'cp.created_at as joined_at',
      ])
      .orderBy('cp.created_at', 'asc');

    return res.json({ success: true, count: members.length, members });
  } catch (error: any) {
    console.error('[List Group Members Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}