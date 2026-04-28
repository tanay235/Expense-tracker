import { InferSchemaType, Schema, model } from 'mongoose';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    // Passwords must be stored as hashes so a DB leak does not expose user credentials in plaintext.
    password_hash: { type: String, required: true },
  },
  {
    collection: 'users',
    timestamps: { createdAt: 'created_at', updatedAt: false },
    versionKey: false,
  }
);

export type UserDocument = InferSchemaType<typeof userSchema>;

export const UserModel = model<UserDocument>('User', userSchema);
