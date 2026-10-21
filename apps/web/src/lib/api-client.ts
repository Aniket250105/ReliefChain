import { AuthResponse, SafeUserDto, OrganizationDto } from '@reliefchain/shared-types';

const isClient = typeof window !== 'undefined';
const API_URL = isClient ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002');

// Since the token is in an HTTP-only cookie, the browser handles it automatically
// for same-origin requests (or with credentials enabled for cross-origin).
const fetchConfig = (init?: RequestInit): RequestInit => {
  return {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    }
  };
};

export const login = async (email: string, password: string): Promise<AuthResponse> => {
  const res = await fetch(`${API_URL}/api/auth/login`, fetchConfig({
    method: 'POST',
    body: JSON.stringify({ email, password })
  }));

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Login failed');
  }

  return res.json();
};
