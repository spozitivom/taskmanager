import { render, screen } from "@testing-library/react";
import TaskCalendar from "../calendar/TaskCalendar";
import { vi } from "vitest";

const now = new Date();
const iso = now.toISOString();

const baseProps = {
  tasks: [
    { id: 1, title: "Planned", status: "todo", start_at: iso, end_at: iso, stage: "todo", priority: "medium" },
    { id: 2, title: "Done", status: "completed", stage: "todo", priority: "low" },
  ],
  projects: [],
  onTaskUpdate: vi.fn(),
  onCreateTask: vi.fn(),
  onOpenTaskEditor: vi.fn(),
  onOpenProject: vi.fn(),
  onProjectUpdate: vi.fn(),
  onProjectArchive: vi.fn(),
  onProjectRestore: vi.fn(),
  onProjectDelete: vi.fn(),
};

describe("TaskCalendar", () => {
  it("renders week/month toggles", () => {
    render(<TaskCalendar {...baseProps} />);

    expect(screen.getByText("Неделя")).toBeInTheDocument();
    expect(screen.getByText("Месяц")).toBeInTheDocument();
  });
});
