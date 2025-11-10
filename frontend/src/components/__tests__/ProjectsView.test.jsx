import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProjectsView from "../ProjectsView";
import { describe, it, expect, vi } from "vitest";

const sampleProjects = [
  {
    id: 1,
    title: "CRM",
    description: "CRM rollout",
    status: "active",
    priority: "medium",
    deadline: null,
    tasks_count: 2,
  },
];

describe("ProjectsView", () => {
  const makeProps = () => ({
    projects: sampleProjects,
    onRefresh: vi.fn(),
    onCreate: vi.fn().mockResolvedValue(undefined),
    onArchive: vi.fn(),
    onRestore: vi.fn(),
    onDelete: vi.fn(),
    onToggleCompleted: vi.fn(),
    onOpenProject: vi.fn(),
    onUpdate: vi.fn().mockResolvedValue(undefined),
  });

  it("calls onRefresh when refresh button clicked", () => {
    const props = makeProps();
    render(<ProjectsView {...props} />);
    fireEvent.click(screen.getByText(/обновить/i));
    expect(props.onRefresh).toHaveBeenCalledTimes(1);
  });

  it("submits creation form with normalized payload", async () => {
    const props = makeProps();
    render(<ProjectsView {...props} />);
    fireEvent.change(screen.getByPlaceholderText(/Название проекта/i), {
      target: { value: "  Roadmap  " },
    });
    fireEvent.click(screen.getByText(/Создать проект/i));

    await waitFor(() => {
      expect(props.onCreate).toHaveBeenCalledTimes(1);
    });
    expect(props.onCreate.mock.calls[0][0]).toMatchObject({
      title: "  Roadmap  ",
      priority: "medium",
      status: "active",
    });
  });
});
