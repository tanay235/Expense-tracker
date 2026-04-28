import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

import { config } from '../core/config';

type AccessTokenPayload = JwtPayload & {
  sub: string;
  email: string;
};

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.header('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();

  try {
    // Validation checks signature, algorithm and expiry before we trust claims from the token.
    const decoded = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],
    }) as AccessTokenPayload;

    if (!decoded.sub || !decoded.email) {
      res.status(401).json({ message: 'Invalid token payload' });
      return;
    }

    req.authUser = { userId: decoded.sub, email: decoded.email };
    next();
  } catch {
    // Invalid/expired tokens are rejected with 401 so protected routes never run with untrusted identity.
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}
