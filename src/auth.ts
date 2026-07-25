// Auth server functions — RPC-safe wrappers for client code.
// All server-only imports are dynamic inside the .handler() closures.
import { createServerFn } from "@tanstack/react-start";

export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("./auth.server");
  return getSessionUser();
});

export const login = createServerFn({ method: "POST" })
  .validator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    const { loginImpl } = await import("./auth.server");
    return loginImpl(data);
  });

export const signup = createServerFn({ method: "POST" })
  .validator(
    (data: { email: string; password: string; name: string; role: "shipper" | "carrier"; company_name: string }) => data,
  )
  .handler(async ({ data }) => {
    const { signupImpl } = await import("./auth.server");
    return signupImpl(data);
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { logoutImpl } = await import("./auth.server");
  return logoutImpl();
});
