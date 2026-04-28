import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { config } from '../../core/config';
import { UserModel } from '../../models/user/user.model';
import { LoginInput, RegisterInput } from '../../schemas/auth/auth.schema';

const PASSWORD_SALT_ROUNDS = 12;
const JWT_EXPIRY_SECONDS = 60 * 60;

export async function registerUser(input: RegisterInput): Promise<{ userId: string }> {
  const existingUser = await UserModel.findOne({ email: input.email }).lean();
  if (existingUser) {
    throw new Error('EMAIL_ALREADY_IN_USE');
  }

  // Hashing is intentionally one-way, which helps contain blast radius if database records are exposed.
  const passwordHash = await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS);

  const created = await UserModel.create({
    email: input.email,
    password_hash: passwordHash,
  });

  return { userId: created._id.toString() };
}

export async function loginUser(input: LoginInput): Promise<{ token: string }> {
  const user = await UserModel.findOne({ email: input.email });
  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const isPasswordMatch = await bcrypt.compare(input.password, user.password_hash);
  if (!isPasswordMatch) {
    throw new Error('INVALID_CREDENTIALS');
  }

  // Short-lived JWTs reduce risk if a token is leaked and force periodic re-authentication.
  // HS256 is explicitly pinned and the signing key is loaded from env to avoid hardcoded secrets in code.
  const token = jwt.sign(
    { sub: user._id.toString(), email: user.email },
    config.jwtSecret,
    {
      algorithm: 'HS256',
      expiresIn: JWT_EXPIRY_SECONDS,
    }
  );

  return { token };
}
