import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;

// The credentials provider talks to Mongoose, which needs the Node runtime.
export const runtime = 'nodejs';
