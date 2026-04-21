import { ApiError } from "@workspace/api-client-react";

export interface ApiErrorInfo {
  title: string;
  body: string;
}

/**
 * Categorises errors thrown by API client mutations/queries into a short
 * title + actionable body. Recognises ApiError (HTTP status), AbortError
 * (timeout), and TypeError (offline / network).
 */
export function categorizeApiError(
  err: unknown,
  context: string,
): ApiErrorInfo {
  if (err instanceof ApiError) {
    if (err.status === 0) {
      return {
        title: "You appear to be offline",
        body: "Check your internet connection and try again.",
      };
    }
    if (err.status === 401 || err.status === 403) {
      return {
        title: "Your session has expired",
        body: "Reload the page to start a new session.",
      };
    }
    if (err.status === 408 || err.status === 504) {
      return {
        title: "The request timed out",
        body: "The server is busy. Wait a moment and try again.",
      };
    }
    if (err.status === 429) {
      return {
        title: "Too many attempts",
        body: "Please wait a few seconds before trying again.",
      };
    }
    if (err.status >= 500) {
      return {
        title: `${context} failed on our side`,
        body: "Something went wrong on our servers. Please try again in a moment.",
      };
    }
    return {
      title: `${context} couldn't be completed`,
      body: "Please check your input and try again.",
    };
  }
  if (
    (typeof DOMException !== "undefined" &&
      err instanceof DOMException &&
      err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  ) {
    return {
      title: "The request timed out",
      body: "The server is busy. Wait a moment and try again.",
    };
  }
  if (err instanceof TypeError) {
    return {
      title: "You appear to be offline",
      body: "Check your internet connection and try again.",
    };
  }
  return {
    title: `${context} couldn't be completed`,
    body: "Please try again in a moment.",
  };
}
