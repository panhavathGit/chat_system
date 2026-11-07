import { Server } from 'socket.io';
import { env } from './env.js';

// * Created unattached so composition roots can inject it before the HTTP server exists; index.ts attaches it
export const io = new Server({
  cors: {
    // * Same rule as the REST CORS in app.ts
    origin: env.CORS_ORIGIN.length > 0 ? env.CORS_ORIGIN : env.NODE_ENV !== 'production',
  },
});
