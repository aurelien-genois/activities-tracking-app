import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { login } = vi.hoisted(() => ({ login: vi.fn() }));

vi.mock("../actions", () => ({ login }));

import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  beforeEach(() => {
    login.mockReset();
  });

  it("renders labelled fields and a submit button", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("submits the credentials and displays the returned error", async () => {
    login.mockResolvedValue({ ok: false, error: "Invalid email or password" });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "admin@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    const formData = login.mock.calls[0]![1] as FormData;
    expect(formData.get("email")).toBe("admin@example.com");
    expect(formData.get("password")).toBe("wrong");
  });

  it("disables the button while pending", async () => {
    let resolve: (value: null) => void = () => {};
    login.mockReturnValue(new Promise((r) => (resolve = r)));
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("button", { name: "Signing in…" })).toBeDisabled();
    resolve(null);
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled());
  });
});
