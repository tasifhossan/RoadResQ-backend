import app from './app.js';
import { env } from './config/env.js';

function startServer() {
  try {
    const server = app.listen(env.port, () => {
      console.log(`[RoadResQ] Server running on port ${env.port} in ${env.nodeEnv} mode`);
    });

    const exitHandler = () => {
      if (server) {
        server.close(() => {
          console.log('[RoadResQ] Server closed gracefully');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    };

    const unexpectedErrorHandler = (error: unknown) => {
      console.error('[RoadResQ] Unexpected error:', error);
      exitHandler();
    };

    process.on('uncaughtException', unexpectedErrorHandler);
    process.on('unhandledRejection', unexpectedErrorHandler);
    process.on('SIGTERM', exitHandler);
    process.on('SIGINT', exitHandler);
  } catch (error) {
    console.error('[RoadResQ] Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
