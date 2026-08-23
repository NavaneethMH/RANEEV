/* RANEEV client session hook — reads the server-validated credential session and never stores a password or JWT in browser storage. */
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = { redirectOnUnauthenticated?: boolean; redirectPath?: string };

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = "/login" } = options ?? {};
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const logoutMutation = trpc.auth.logout.useMutation({ onSuccess: () => utils.auth.me.setData(undefined, null) });
  const logout = useCallback(async () => {
    try { await logoutMutation.mutateAsync(); }
    catch (error: unknown) { if (!(error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED")) throw error; }
    finally { utils.auth.me.setData(undefined, null); await utils.auth.me.invalidate(); }
  }, [logoutMutation, utils]);
  const state = useMemo(() => ({ user: meQuery.data ?? null, loading: meQuery.isLoading || logoutMutation.isPending, error: meQuery.error ?? logoutMutation.error ?? null, isAuthenticated: Boolean(meQuery.data) }), [meQuery.data, meQuery.error, meQuery.isLoading, logoutMutation.error, logoutMutation.isPending]);
  useEffect(() => { if (!redirectOnUnauthenticated || meQuery.isLoading || logoutMutation.isPending || state.user || typeof window === "undefined" || window.location.pathname === redirectPath) return; window.location.assign(redirectPath); }, [redirectOnUnauthenticated, redirectPath, meQuery.isLoading, logoutMutation.isPending, state.user]);
  return { ...state, refresh: () => meQuery.refetch(), logout };
}
