/**
 * File: server/src/routes/chat/chatRoutes.ts
 * 
 * Routes for chat functionality:
 * - Get user's chats
 * - Create chats
 * - Get chat messages
 * - Send messages
 * - Get users for chat creation
 * - Upload images for chat messages
 * - Edit messages
 * - Delete messages
 */
import { Router, Request, Response, NextFunction } from 'express';
import {
  getUserChats,
  createDirectChat,
  createGroupChat,
  createPublicGroup,
  getChatMessages,
  sendMessage,
  getUsersForChat,
  editMessage,
  deleteMessage,
  listPublicGroups,
  joinGroup,
  leaveGroup,
  listGroupMembers,
} from '../../controllers/chatController';
import { chatImageRouter } from './chatImageRoutes';
import { groupImageRouter } from './groupImageRoutes';

const chatRouter = Router();

// Utility wrapper for async route handlers
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
} 

// Get all chats for a user
chatRouter.get('/users/:userId/chats', asyncHandler(getUserChats));

// Create a direct chat between two users
chatRouter.post('/direct', asyncHandler(createDirectChat));

// Create a public group chat (anyone can join) - Must come before /group route
chatRouter.post('/group/public', asyncHandler(createPublicGroup));

// Create a private group chat (with selected participants)
chatRouter.post('/group', asyncHandler(createGroupChat));

// Get messages for a specific chat
chatRouter.get('/chats/:chatId/messages', asyncHandler(getChatMessages));

// Send a message to a chat
chatRouter.post('/messages', asyncHandler(sendMessage));

// Edit a message
chatRouter.put('/messages/:messageId', asyncHandler(editMessage));

// Delete a message
chatRouter.delete('/messages/:messageId', asyncHandler(deleteMessage));

// Get users for chat creation (search)
chatRouter.get('/users', asyncHandler(getUsersForChat));

// Public group discovery (for "Groups" tab)
chatRouter.get('/groups', asyncHandler(listPublicGroups));

// Join/leave group
chatRouter.post('/groups/:chatId/join', asyncHandler(joinGroup));
chatRouter.post('/groups/:chatId/leave', asyncHandler(leaveGroup));

// Group members
chatRouter.get('/groups/:chatId/members', asyncHandler(listGroupMembers));

// Mount the chat image router **AFTER** specific message routes
chatRouter.use('/images', chatImageRouter);

// Mount the group image router for group profile images
chatRouter.use('/group-images', groupImageRouter);

export { chatRouter }; 