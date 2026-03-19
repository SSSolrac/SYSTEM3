import { redirect } from "react-router-dom";
import { getRoleFromSession, getSession, Role } from "./auth";

// Blocks anyone not logged in
export async function requireAuth() {
  const session = await getSession();
  if (!session) throw redirect("/login");
  return null;
}

// Blocks logged-in users who donâ€™t match the allowed role(s)
export function requireRole(allowed: Role[]) {
  return async () => {
    const session = await getSession();
    if (!session) throw redirect("/login");

    const role = await getRoleFromSession();
    if (!role) throw redirect("/login");

    if (!allowed.includes(role)) {
      // send them to the correct area
      throw redirect(role === "admin" ? "/admin" : "/customer");
    }
    return null;
  };
}

// Smart landing route: "/" goes to the correct dashboard
export async function roleRedirect() {
  const session = await getSession();
  if (!session) throw redirect("/login");

  const role = await getRoleFromSession();
  throw redirect(role === "admin" ? "/admin" : "/customer");
}

