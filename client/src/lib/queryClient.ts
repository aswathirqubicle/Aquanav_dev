import { MutationCache, QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  url: string,
  options: {
    method?: string;
    body?: any;
  } = {}
): Promise<Response> {
  const { method = "GET", body: requestBody } = options;
  const headers: HeadersInit = {};
  let processedBody = requestBody;

  if (requestBody && !(requestBody instanceof FormData))  {
    headers["Content-Type"] = "application/json";
    // Only stringify if it's an object and not FormData (FormData is used for file uploads and should not be stringified)
    if (typeof requestBody === 'object' && requestBody !== null && !(requestBody instanceof FormData)) {
       processedBody = JSON.stringify(requestBody);
    }
  }

  const res = await fetch(url, {
    method,
    headers,
    body: processedBody,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/** Side menu approval badges; see server/routes/approvals.routes.ts. */
export const PENDING_APPROVALS_KEY = ["/api/approvals/pending-counts"];

export const queryClient: QueryClient = new QueryClient({
  // Submitting, approving or rejecting anything can change what's waiting, and
  // those mutations live on a dozen pages. Refreshing the badge counts after
  // every successful mutation keeps them right without wiring each one; it is
  // one small request.
  mutationCache: new MutationCache({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PENDING_APPROVALS_KEY });
    },
  }),
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});