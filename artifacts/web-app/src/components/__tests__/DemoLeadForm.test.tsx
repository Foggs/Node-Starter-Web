import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the generated mutation BEFORE the component imports it.
const mutateSpy = vi.hoisted(() => vi.fn());
let nextSuccessHandler: (() => void) | undefined;
let nextErrorHandler: ((err: Error) => void) | undefined;
let isPendingValue = false;

vi.mock("@workspace/api-client-react", () => ({
  useCreateLead: (options: {
    mutation: { onSuccess: () => void; onError: (err: Error) => void };
  }) => {
    nextSuccessHandler = options.mutation.onSuccess;
    nextErrorHandler = options.mutation.onError;
    return {
      mutate: mutateSpy,
      isPending: isPendingValue,
    };
  },
}));

import { DemoLeadForm } from "../DemoLeadForm";

const renderForm = (onSuccess = vi.fn(), onSubmittingChange = vi.fn()) => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    onSuccess,
    onSubmittingChange,
    ...render(
      <QueryClientProvider client={qc}>
        <DemoLeadForm onSuccess={onSuccess} onSubmittingChange={onSubmittingChange} />
      </QueryClientProvider>,
    ),
  };
};

beforeEach(() => {
  mutateSpy.mockReset();
  nextSuccessHandler = undefined;
  nextErrorHandler = undefined;
  isPendingValue = false;
});

describe("DemoLeadForm", () => {
  it("renders the v4.0 headline, subtext, and consent notice", () => {
    renderForm();
    expect(
      screen.getByRole("heading", {
        name: /that conversation just got a lot harder to avoid/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/those improved lines play back in your own cloned voice/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/by continuing, you agree to our/i),
    ).toBeInTheDocument();
    const privacyLink = screen.getByRole("link", { name: /privacy policy/i });
    expect(privacyLink).toHaveAttribute("href", "/privacy");
  });

  it("disables submit until both fields are valid", () => {
    renderForm();
    const submit = screen.getByRole("button", { name: /start practicing/i });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/full name/i), {
      target: { value: "Alice" },
    });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: "not-an-email" },
    });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: "alice@example.com" },
    });
    expect(submit).not.toBeDisabled();
  });

  it("posts the trimmed/lowercased lead and calls onSuccess on resolve", async () => {
    const { onSuccess, onSubmittingChange } = renderForm();

    fireEvent.change(screen.getByPlaceholderText(/full name/i), {
      target: { value: "  Alice Doe  " },
    });
    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: "ALICE@example.COM" },
    });

    fireEvent.click(screen.getByRole("button", { name: /start practicing/i }));

    expect(mutateSpy).toHaveBeenCalledTimes(1);
    expect(mutateSpy).toHaveBeenCalledWith({
      data: { name: "Alice Doe", email: "alice@example.com" },
    });
    expect(onSubmittingChange).toHaveBeenLastCalledWith(true);

    // Simulate the mutation succeeding — wraps a 300ms minimum loader.
    await nextSuccessHandler?.();

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
    expect(onSubmittingChange).toHaveBeenLastCalledWith(false);
  });

  it("shows an inline error and preserves form values when the request fails", () => {
    const { onSuccess, onSubmittingChange } = renderForm();

    fireEvent.change(screen.getByPlaceholderText(/full name/i), {
      target: { value: "Alice" },
    });
    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: "alice@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /start practicing/i }));

    act(() => {
      nextErrorHandler?.(new Error("boom"));
    });

    expect(screen.getByTestId("demo-lead-error")).toHaveTextContent(
      /something went wrong/i,
    );
    expect(screen.getByPlaceholderText(/full name/i)).toHaveValue("Alice");
    expect(screen.getByPlaceholderText(/email/i)).toHaveValue("alice@example.com");
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onSubmittingChange).toHaveBeenLastCalledWith(false);
  });
});
