declare namespace Express {
  interface Request {
    authUser?: {
      userId: string;
      email: string;
    };
  }
}
