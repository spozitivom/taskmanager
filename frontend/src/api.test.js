import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as api from "./api";

const mockFetch = vi.fn();

function setupFetch(response, ok = true, status = 200) {
  mockFetch.mockResolvedValue({
    ok,
    status,
    text: vi.fn().mockResolvedValue(typeof response === "string" ? response : JSON.stringify(response)),
  });
  vi.stubGlobal("fetch", mockFetch);
}

beforeEach(() => {
  mockFetch.mockReset();
  vi.unstubAllGlobals();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("login stores token and returns payload", async () => {
    const payload = { token: "jwt-token", userID: 1, role: "user" };
    setupFetch(payload);

    const res = await api.login("user@example.com", "secret");

    expect(res.token).toBe(payload.token);
    expect(localStorage.getItem("token")).toBe(payload.token);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("register sends payload to /auth/register", async () => {
    setupFetch({ message: "ok" });

    await api.register({ email: "new@example.com", username: "new", password: "secret" });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/auth/register",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("getTasks returns array of tasks", async () => {
    const tasks = [{ id: 1, title: "Task" }];
    setupFetch(tasks);
    const res = await api.getTasks();
    expect(res).toEqual(tasks);
    expect(mockFetch).toHaveBeenCalledWith("/api/tasks", expect.any(Object));
  });

  it("updateTask sends PATCH with data", async () => {
    const updated = { id: 3, title: "Updated" };
    setupFetch(updated);
    const res = await api.updateTask(3, { title: "Updated" });
    expect(res).toEqual(updated);
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe("PATCH");
    expect(options.body).toContain("Updated");
  });

  it("deleteTask issues DELETE", async () => {
    setupFetch(null, true, 204);
    await api.deleteTask(9);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/tasks/9");
    expect(options.method).toBe("DELETE");
  });
});
