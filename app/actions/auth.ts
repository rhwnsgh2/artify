"use server";

import { cookies } from "next/headers";

const PASSWORD = process.env.APP_PASSWORD || "nanobanana2024";

export async function verifyPassword(password: string) {
  if (password === PASSWORD) {
    // Set auth cookie
    const cookieStore = await cookies();
    cookieStore.set("auth", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    return { success: true };
  }
  return { success: false, error: "비밀번호가 올바르지 않습니다" };
}

export async function checkAuth() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("auth");
  return authCookie?.value === "authenticated";
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("auth");
  return { success: true };
}