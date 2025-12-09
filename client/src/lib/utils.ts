import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { logApiError } from "./error-logger";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function apiRequest(
  method: string,
  endpoint: string,
  data?: any
): Promise<any> {
  const url = endpoint;

  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  };

  if (data && method !== "GET") {
    options.body = JSON.stringify(data);
  }

  console.log(`[apiRequest] Making ${method} request to ${url}`);
  if (data) {
    console.log(`[apiRequest] Request data:`, data);
  }

  try {
    const response = await fetch(url, options);

    console.log(`[apiRequest] Response status: ${response.status}`);
    console.log(`[apiRequest] Response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[apiRequest] Error response:`, errorText);
      console.error(`[apiRequest] Response status: ${response.status}`);
      console.error(`[apiRequest] Response URL: ${response.url}`);

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        // If it's HTML (likely an error page), extract useful info
        if (errorText.startsWith('<!DOCTYPE html>')) {
          console.error(`[apiRequest] Server returned HTML instead of JSON - this indicates a server-side routing or error issue`);
          errorData = { message: `Server error: received HTML response instead of JSON (${response.status})` };
        } else {
          errorData = { message: errorText || `HTTP ${response.status}` };
        }
      }

      const error = new Error(errorData.message || `HTTP ${response.status}`);

      // Log API errors
      logApiError(error, `API Request: ${method} ${endpoint}`);

      throw error;
    }

    const contentType = response.headers.get("content-type");
    console.log(`[apiRequest] Info: Success response for ${method} ${endpoint}. Status: ${response.status}, Content-Type: ${contentType}`);

    if (contentType && contentType.includes("application/json")) {
      const responseData = await response.json();
      console.log(`[apiRequest] Info: Response object:`, responseData);
      return responseData;
    } else {
      const responseText = await response.text();
      console.log(`[apiRequest] Info: Response text:`, responseText);
      return responseText;
    }
  } catch (error) {
    console.error(`[apiRequest] Request failed:`, error);

    // Log the error if it's not already logged
    if (error instanceof Error && !error.message.includes('HTTP')) {
      logApiError(error, `API Request: ${method} ${endpoint}`);
    }

    throw error;
  }
}