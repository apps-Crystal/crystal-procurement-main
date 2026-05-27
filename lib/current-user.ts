/**
 * Server-side helper for reading the signed-in user out of the
 * crystal_user cookie set by middleware.ts.
 */

import { cookies } from "next/headers";

export interface CurrentUser {
  email: string;
  name: string;
  role: string;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const raw = store.get("crystal_user")?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CurrentUser>;
    if (!parsed.email) return null;
    return {
      email: parsed.email,
      name: parsed.name ?? "",
      role: parsed.role ?? "",
    };
  } catch {
    return null;
  }
}
