import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import KanbanBoard from "../KanbanBoard";

vi.mock("../../api", () => ({
  __esModule: true,
  updateTask: vi.fn().mockResolvedValue({}),
}));

const tasks = [
  { id: 1, title: "Backlog", status: "todo", stage: "todo", priority: "medium" },
  { id: 2, title: "In work", status: "in_progress", stage: "in_progress", priority: "medium" },
  { id: 3, title: "Done", status: "completed", stage: "completed", priority: "medium" },
];

describe("KanbanBoard", () => {
  it("renders columns with correct counts", () => {
    render(<KanbanBoard tasks={tasks} setTasks={() => {}} onEditTask={() => {}} />);

    expect(screen.getByText("В планах")).toBeInTheDocument();
    expect(screen.getByText("В работе")).toBeInTheDocument();
    expect(screen.getByText("Готово")).toBeInTheDocument();

    expect(screen.getAllByText("1")).toHaveLength(3); // each column badge shows 1 task
    expect(screen.getByText("Backlog")).toBeInTheDocument();
    expect(screen.getByText("In work")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });
});
