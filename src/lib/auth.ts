import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-change-it';
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function signToken(payload: any): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(SECRET_KEY);
}

export async function verifyToken(token: string): Promise<Record<string, unknown> | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}
