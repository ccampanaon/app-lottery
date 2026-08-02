import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    // Never returned by default — callers that need it (only the credentials
    // provider) must opt in with .select('+passwordHash').
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ['admin', 'viewer'], default: 'viewer', required: true },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });

export type UserDocument = InferSchemaType<typeof userSchema>;

// `models.User ||` guards against Fast Refresh re-registering the model, which
// Mongoose treats as a fatal OverwriteModelError.
export const User: Model<UserDocument> =
  (models.User as Model<UserDocument>) || model<UserDocument>('User', userSchema);
