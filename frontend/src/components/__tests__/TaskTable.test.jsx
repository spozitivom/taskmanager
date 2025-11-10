import { render, screen, fireEvent } from "@testing-library/react";
import { TaskTable } from "../TaskDashboard";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@hello-pangea/dnd", () => {
  const MockContext = ({ children }) => <>{children}</>;
  return {
    DragDropContext: MockContext,
    Droppable: ({ children }) =>
      typeof children === "function"
        ? children({ droppableProps: {}, innerRef: () => {}, placeholder: null }, { isDraggingOver: false })
        : children,
    Draggable: ({ children }) =>
      typeof children === "function"
        ? children({ draggableProps: {}, dragHandleProps: {}, innerRef: () => {} }, { isDragging: false })
        : children,
  };
});

const baseTasks = [
  {
    id: 1,
    title: "API",
    status: "todo",
    priority: "high",
    stage: "todo",
    project: { title: "Platform", status: "active" },
    created_at: new Date().toISOString(),
  },
];

const defaultVisibleColumns = {
  title: true,
  status: true,
  priority: true,
  stage: true,
  project: true,
  created_at: true,
  deadline: false,
};

describe("TaskTable", () => {
  let props;

  beforeEach(() => {
    props = {
      tasks: baseTasks,
      visibleColumns: { ...defaultVisibleColumns },
      onDeleteTask: vi.fn(),
      onEditTask: vi.fn(),
      sortKey: null,
      sortDir: null,
      onCycleSort: vi.fn(),
      onDragEnd: vi.fn(),
      selectedIds: [],
      onToggleSelect: vi.fn(),
      onToggleAll: vi.fn(),
      bulkMenuOpen: false,
      setBulkMenuOpen: vi.fn(),
      hasSelection: false,
      onBulkAction: vi.fn(),
    };
  });

  it("renders project column when enabled", () => {
    render(<TaskTable {...props} />);
    expect(screen.getByText(/Проект/)).toBeInTheDocument();
  });

  it("hides project column when disabled", () => {
    props.visibleColumns.project = false;
    render(<TaskTable {...props} />);
    expect(screen.queryByText(/Проект/)).not.toBeInTheDocument();
  });

  it("toggles all checkbox", () => {
    render(<TaskTable {...props} tasks={[...baseTasks, { ...baseTasks[0], id: 2, title: "UI" }]} />);
    const masterCheckbox = screen.getAllByRole("checkbox")[0];
    fireEvent.click(masterCheckbox);
    expect(props.onToggleAll).toHaveBeenCalledTimes(1);
  });
});
