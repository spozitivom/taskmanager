import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import App from "./App";
import * as api from "./api";

vi.mock("./api", () => ({
  __esModule: true,
  getProfile: vi.fn().mockRejectedValue(new Error("unauth")),
  login: vi.fn().mockResolvedValue({ token: "jwt", userID: 1, role: "user" }),
  register: vi.fn().mockResolvedValue({ message: "ok" }),
  getTasks: vi.fn().mockResolvedValue([]),
  getProjects: vi.fn().mockResolvedValue([]),
  logout: vi.fn(),
}));

describe("Auth forms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders login fields with placeholders", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Task Manager")).toBeInTheDocument());
    expect(screen.getByPlaceholderText("Email или имя пользователя")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Пароль")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Войти" })).toBeDisabled();
  });

  it("switches to register form and shows fields", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Task Manager")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Регистрация" }));
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Имя пользователя")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Пароль")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Подтверждение пароля")).toBeInTheDocument();
  });

  it("calls api.login with credentials on submit", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Task Manager")).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText("Email или имя пользователя"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("Пароль"), { target: { value: "secret" } });
    const btn = screen.getByRole("button", { name: "Войти" });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    await waitFor(() => expect(api.login).toHaveBeenCalledWith("user@example.com", "secret"));
  });

  it("shows alert when register passwords mismatch", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    render(<App />);
    await waitFor(() => expect(screen.getByText("Task Manager")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Регистрация" }));
    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("Имя пользователя"), { target: { value: "new" } });
    fireEvent.change(screen.getByPlaceholderText("Пароль"), { target: { value: "pass1" } });
    fireEvent.change(screen.getByPlaceholderText("Подтверждение пароля"), { target: { value: "pass2" } });
    const btn = screen.getByRole("button", { name: "Зарегистрироваться" });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(alertSpy).not.toHaveBeenCalled(); // disabled prevents submission
    alertSpy.mockRestore();
  });

  it("registers and auto-logins on success", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Task Manager")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Регистрация" }));
    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("Имя пользователя"), { target: { value: "new" } });
    fireEvent.change(screen.getByPlaceholderText("Пароль"), { target: { value: "pass123" } });
    fireEvent.change(screen.getByPlaceholderText("Подтверждение пароля"), { target: { value: "pass123" } });
    const btn = screen.getByRole("button", { name: "Зарегистрироваться" });
    fireEvent.click(btn);
    await waitFor(() => expect(api.register).toHaveBeenCalled());
    await waitFor(() => expect(api.login).toHaveBeenCalledWith("new@example.com", "pass123"));
  });
});
