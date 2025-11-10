import { render, screen, fireEvent } from "@testing-library/react";
import { ColumnsDropdown } from "../TaskDashboard";
import { describe, it, expect, vi } from "vitest";

const visibleColumns = {
  title: true,
  status: true,
  priority: true,
  stage: true,
  project: true,
  created_at: true,
  deadline: false,
};

describe("ColumnsDropdown", () => {
  it("invokes onToggle when checkbox clicked", () => {
    const onToggle = vi.fn();
    render(<ColumnsDropdown visibleColumns={visibleColumns} onToggle={onToggle} onReset={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Колонки/i }));
    fireEvent.click(screen.getByLabelText(/Проект/i));
    expect(onToggle).toHaveBeenCalledWith("project");
  });

  it("resets settings", () => {
    const onReset = vi.fn();
    render(<ColumnsDropdown visibleColumns={visibleColumns} onToggle={vi.fn()} onReset={onReset} />);
    fireEvent.click(screen.getByRole("button", { name: /Колонки/i }));
    fireEvent.click(screen.getByText(/Сбросить/i));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
