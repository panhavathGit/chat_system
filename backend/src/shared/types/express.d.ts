declare global {
  namespace Express {
    // * Shape of req.user / socket.data.user, rebuilt from a verified chat session token
    interface User {
      id: string; // * ChatUser.id (ours), not the LOS id
      losUserId: number;
      type: 'customer' | 'staff';
      username: string;
    }

    interface Request {
      user?: User;
    }
  }
}

export {};
