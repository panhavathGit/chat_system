import { app } from './app.js';
import { prisma } from '@config/database.js';
import { env } from '@config/env.js';
import { logger } from '@config/logger.js';
import { io } from '@config/socket.js';
import { registerChatSocket } from '@modules/chat/index.js';

const server = app.listen(env.PORT, () => {
  logger.info(`Server listening on http://localhost:${env.PORT}`);
});

// * Socket.io shares the HTTP port; REST and real-time use the same tokens
io.attach(server);
registerChatSocket();

const shutdown = (signal: NodeJS.Signals) => {
  logger.info({ signal }, 'Shutting down');
  // * io.close() disconnects sockets and closes the HTTP server too
  void io.close(() => {
    prisma
      .$disconnect()
      .catch((err: unknown) => logger.error({ err }, 'Failed to disconnect Prisma'))
      .finally(() => process.exit(0));
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
