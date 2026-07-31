import { prisma } from '@/lib/db';

/**
 * Create a new chat session for a user.
 */
export async function createSession(userId: string, title?: string) {
  return prisma.chatSession.create({
    data: { userId, title },
  });
}

/**
 * Get a single chat session with its messages, ordered by creation time.
 */
export async function getSession(sessionId: string) {
  return prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

/**
 * List all chat sessions for a user, most recently updated first.
 */
export async function listSessions(userId: string) {
  return prisma.chatSession.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * Get all messages for a session, ordered by creation time.
 */
export async function getMessages(sessionId: string) {
  return prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Save a message to a chat session.
 */
export async function saveMessage(
  sessionId: string,
  role: string,
  content: string,
  toolCalls?: string
) {
  return prisma.chatMessage.create({
    data: {
      sessionId,
      role,
      content,
      toolCalls: toolCalls ?? null,
    },
  });
}

/**
 * Delete a chat session and all its messages (cascaded).
 */
export async function deleteSession(sessionId: string) {
  await prisma.chatSession.delete({
    where: { id: sessionId },
  });
}
