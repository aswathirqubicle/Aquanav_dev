import { QueryClient, QueryFunction } from "@tanstack/react-query";

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

export const queryClient = new QueryClient({
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