/* RANEEV application bootstrap — credential cookies are the only session transport; no frontend JWT persistence is used. */
import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();
const redirectToCredentialLogin = (error: unknown) => { if (!(error instanceof TRPCClientError) || typeof window === "undefined" || error.message !== "Please login (10001)" || window.location.pathname === "/login") return; window.location.assign("/login"); };
queryClient.getQueryCache().subscribe(event => { if (event.type === "updated" && event.action.type === "error") redirectToCredentialLogin(event.query.state.error); });
queryClient.getMutationCache().subscribe(event => { if (event.type === "updated" && event.action.type === "error") redirectToCredentialLogin(event.mutation.state.error); });

const trpcClient = trpc.createClient({ links: [httpBatchLink({ url: "/api/trpc", transformer: superjson, fetch(input, init) { return globalThis.fetch(input, { ...(init ?? {}), credentials: "include" }); } })] });
createRoot(document.getElementById("root")!).render(<trpc.Provider client={trpcClient} queryClient={queryClient}><QueryClientProvider client={queryClient}><App /></QueryClientProvider></trpc.Provider>);
