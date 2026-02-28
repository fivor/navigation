import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from '@/lib/auth';

describe('auth token', () => {
  it('signs and verifies JWT with expected payload', async () => {
    const payload = { id: 123, email: 'user@example.com', role: 'admin' };
    const token = await signToken(payload);
    expect(typeof token).toBe('string');
    const verified = await verifyToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe(payload.id);
    expect(verified?.email).toBe(payload.email);
    expect(verified?.role).toBe(payload.role);
  });
});
