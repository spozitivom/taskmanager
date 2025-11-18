import { render } from "@testing-library/react";
import ProjectsView from "../ProjectsView";

const projects = [
  { id: 1, title: "CRM", description: "Desc", status: "active", priority: "medium", tasks_count: 2 },
  { id: 2, title: "Site", description: "", status: "planned", priority: "low", tasks_count: 0 },
];

describe("ProjectsView snapshot", () => {
  it("matches snapshot", () => {
    const { asFragment } = render(
      <ProjectsView
        projects={projects}
        tasks={[]}
        onRefresh={() => {}}
        onCreate={async () => {}}
        onArchive={() => {}}
        onRestore={() => {}}
        onDelete={() => {}}
        onToggleCompleted={() => {}}
        onOpenProject={() => {}}
        onUpdate={async () => {}}
        onAssignTasks={async () => {}}
      />
    );
    expect(asFragment()).toMatchSnapshot();
  });
});
