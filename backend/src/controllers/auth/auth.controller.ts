import { Request, Response } from 'express';

import { loginSchema, registerSchema } from '../../schemas/auth/auth.schema';
import { loginUser, registerUser } from '../../services/auth/auth.service';

export async function registerController(req: Request, res: Response): Promise<void> {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid register payload', errors: parsed.error.flatten() });
    return;
  }

  try {
    const result = await registerUser(parsed.data);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'EMAIL_ALREADY_IN_USE') {
      res.status(409).json({ message: 'Email already in use' });
      return;
    }

    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function loginController(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid login payload', errors: parsed.error.flatten() });
    return;
  }

  try {
    const result = await loginUser(parsed.data);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_CREDENTIALS') {
      // Response intentionally avoids telling whether email or password was wrong.
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    res.status(500).json({ message: 'Internal server error' });
  }
}
