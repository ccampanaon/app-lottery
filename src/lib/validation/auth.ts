import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email('Enter a valid email address').trim().toLowerCase(),
  // No complexity rules on *login* — the password either matches the stored hash
  // or it does not, and telling an attacker their guess was malformed leaks shape.
  password: z.string().min(1, 'Required'),
});

export type LoginValues = z.infer<typeof loginSchema>;
