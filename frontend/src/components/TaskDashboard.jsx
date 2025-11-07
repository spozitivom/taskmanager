import { useEffect, useMemo, useRef, useState } from "react";
import {
  Filter,
  Download,
  Upload,
  Search,
  ListChecks,
  LayoutGrid,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown as CDown,
  Pencil,
  Trash2,
} from "lucide-react";
import TaskImport from "./TaskImport";
import KanbanBoard from "./KanbanBoard";
import TaskEditorModal from "./TaskEditorModal";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

const STATUS_META = {
  todo: { label: "To Do", tone: "slate" },
  in_progress: { label: "In Progress", tone: "blue" },
  in_review: { label: "In Review", tone: "amber" },
  done: { label: "Completed", tone: "green" },
  completed: { label: "Completed", tone: "green" },
};

const PRIORITY_META = {
  low: { label: "Low", tone: "slate" },
  medium: { label: "Medium", tone: "amber" },
  high: { label: "High", tone: "rose" },
};

const STATUS_WEIGHT = { todo: 0, in_progress: 1, in_review: 2, done: 3 };
const PRIORITY_WEIGHT = { low: 0, medium: 1, high: 2 };

export default function TaskDashboard({
  tasks,
  setTasks,
  title,
  setTitle,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onUpdateTask,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  stageFilter,
  setStageFilter,
  sortOrder,
  setSortOrder,
  identifier,
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState(null);
  const [viewMode, setViewMode] = useState("table");
  const taskImportRef = useRef(null);
  const [editingTask, setEditingTask] = useState(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const stageOptions = useMemo(() => {
    return Array.from(
      new Set(tasks.map((t) => (t.stage || "").trim()).filter(Boolean))
    );
  }, [tasks]);

  const statusOptions = [
    { label: "Все статусы", value: "" },
    { label: "To Do", value: "todo" },
    { label: "In Progress", value: "in_progress" },
    { label: "In Review", value: "in_review" },
    { label: "Completed", value: "done" },
  ];

  const priorityOptions = [
    { label: "Любой приоритет", value: "" },
    { label: "High", value: "high" },
    { label: "Medium", value: "medium" },
    { label: "Low", value: "low" },
  ];

  const sortOptions = [
    { label: "Новые → старые", value: "desc" },
    { label: "Старые → новые", value: "asc" },
  ];

  const filteredTasks = useMemo(() => {
    const normalizedStage = stageFilter?.toLowerCase() || "";
    const term = search.trim().toLowerCase();

    let list = [...tasks];

    if (statusFilter) {
      list = list.filter((t) => (t.status || "") === statusFilter);
    }

    if (priorityFilter) {
      list = list.filter((t) => (t.priority || "") === priorityFilter);
    }

    if (normalizedStage) {
      list = list.filter(
        (t) => (t.stage || "").toLowerCase() === normalizedStage
      );
    }

    if (term) {
      list = list.filter((t) => {
        const titleText = (t.title || "").toLowerCase();
        const descriptionText = (t.description || "").toLowerCase();
        return titleText.includes(term) || descriptionText.includes(term);
      });
    }

    if (sortKey && sortDir) {
      const dirFactor = sortDir === "desc" ? -1 : 1;
      list.sort((a, b) => {
        const av = getSortValue(a, sortKey);
        const bv = getSortValue(b, sortKey);
        if (av < bv) return -1 * dirFactor;
        if (av > bv) return 1 * dirFactor;
        return 0;
      });
    }

    return list;
  }, [tasks, search, statusFilter, priorityFilter, stageFilter, sortKey, sortDir]);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("");
    setPriorityFilter("");
    setStageFilter("");
    setSortOrder("desc");
    setSortKey(null);
    setSortDir(null);
  };

  const handleExportJson = () => {
    const payload = JSON.stringify(filteredTasks, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tasks.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCycleSort = (key) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("desc");
      return;
    }
    if (sortDir === "desc") {
      setSortDir("asc");
      return;
    }
    if (sortDir === "asc") {
      setSortKey(null);
      setSortDir(null);
    }
  };

  const handleEditRequest = (task) => {
    setEditingTask(task);
  };

  const handleCloseModal = () => {
    if (modalSubmitting) return;
    setEditingTask(null);
  };

  const handleModalSubmit = async (fields) => {
    if (!editingTask) return;
    setModalSubmitting(true);
    try {
      await onUpdateTask(editingTask.id, fields);
      setEditingTask(null);
    } catch (error) {
      console.error("Ошибка сохранения задачи:", error);
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleTableDragEnd = (result) => {
    if (!result.destination) return;
    const sourceTask = filteredTasks[result.source.index];
    if (!sourceTask) return;

    const destinationTask = filteredTasks[result.destination.index];

    setTasks((prev) => {
      const updated = [...prev];
      const fromIndex = updated.findIndex((t) => t.id === sourceTask.id);
      if (fromIndex === -1) return prev;

      let insertIndex;
      if (destinationTask) {
        insertIndex = updated.findIndex((t) => t.id === destinationTask.id);
      } else {
        const lastVisibleId = filteredTasks[filteredTasks.length - 1]?.id;
        if (lastVisibleId) {
          insertIndex = updated.findIndex((t) => t.id === lastVisibleId) + 1;
        } else {
          insertIndex = updated.length;
        }
      }

      if (insertIndex === -1) {
        insertIndex = updated.length;
      }

      const [moved] = updated.splice(fromIndex, 1);
      if (fromIndex < insertIndex) {
        insertIndex -= 1;
      }
      updated.splice(insertIndex, 0, moved);
      return updated;
    });
  };

  const userInitial = (identifier || "User").slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-800">
      <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white/80 border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3 justify-between">
          <div className="flex items-center">
            <LogoIcon className="h-[3.15rem] w-[3.15rem]" />
            <span className="font-semibold tracking-tight text-lg ml-[5px] leading-none">
              Taskman
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по задачам"
                className="pl-10 pr-3 py-2 w-72 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-inner"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>
            <UserMenu name={identifier} initial={userInitial} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-12 gap-6">
        <aside className="col-span-12 md:col-span-3 lg:col-span-2">
          <nav className="p-3 rounded-2xl bg-white/90 border border-slate-200 shadow-lg shadow-slate-100">
            <ul className="space-y-1">
              {[
                { label: "Задачи", active: viewMode === "table" },
                { label: "Доска", active: viewMode === "kanban" },
                { label: "Календарь", disabled: true },
              ].map((item, i) => (
                <li key={item.label}>
                  <button
                    onClick={() =>
                      item.disabled ? null : setViewMode(item.label === "Задачи" ? "table" : "kanban")
                    }
                    className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:bg-slate-50 ${
                      item.active ? "bg-slate-50 border border-slate-200" : ""
                    } ${item.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <span className="h-2 w-2 rounded-full bg-indigo-400/60" />
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="col-span-12 md:col-span-9 lg:col-span-10 space-y-4">
          <section className="rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-100 p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <ViewDropdown viewMode={viewMode} onChange={setViewMode} />
              <DataDropdown
                onImport={() => taskImportRef.current?.open()}
                onExport={handleExportJson}
              />
              <div className="ml-auto">
                <FiltersDropdown
                  statusOptions={statusOptions}
                  priorityOptions={priorityOptions}
                  stageOptions={stageOptions}
                  sortOptions={sortOptions}
                  statusValue={statusFilter}
                  onStatusChange={setStatusFilter}
                  priorityValue={priorityFilter}
                  onPriorityChange={setPriorityFilter}
                  stageValue={stageFilter}
                  onStageChange={setStageFilter}
                  sortValue={sortOrder}
                  onSortChange={setSortOrder}
                  onReset={resetFilters}
                />
              </div>
            </div>

            <div className="md:hidden">
              <div className="relative">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск по задачам"
                  className="pl-10 pr-3 py-2 w-full rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-inner"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <input
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 shadow-inner shadow-slate-50"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Новая задача"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onAddTask();
                  }
                }}
              />
              <button
                onClick={onAddTask}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white shadow-md hover:bg-indigo-500"
              >
                Добавить
              </button>
            </div>

            <TaskImport
              ref={taskImportRef}
              setTasks={setTasks}
              className="hidden"
              showDefaultTrigger={false}
            />
          </section>

          {viewMode === "table" ? (
            <TaskTable
              tasks={filteredTasks}
              onToggleTask={onToggleTask}
              onDeleteTask={onDeleteTask}
              onEditTask={handleEditRequest}
              sortKey={sortKey}
              sortDir={sortDir}
              onCycleSort={handleCycleSort}
              onDragEnd={handleTableDragEnd}
            />
          ) : (
            <section className="rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-100 p-4">
              <KanbanBoard tasks={tasks} setTasks={setTasks} onEditTask={handleEditRequest} />
            </section>
          )}
        </main>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 h-40 bg-gradient-to-t from-indigo-50 to-transparent" />
      {editingTask && (
        <TaskEditorModal
          task={editingTask}
          onClose={handleCloseModal}
          onSubmit={handleModalSubmit}
          submitting={modalSubmitting}
        />
      )}
    </div>
  );
}

function TaskTable({
  tasks,
  onToggleTask,
  onDeleteTask,
  onEditTask,
  sortKey,
  sortDir,
  onCycleSort,
  onDragEnd,
}) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <section className="rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <Droppable droppableId="task-table">
            {(dropProvided) => (
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80">
                  <tr className="text-left">
                    <th className="px-4 py-3 w-12">Done</th>
                    <Th
                      label="Задача"
                      active={sortKey === "title"}
                      dir={sortDir}
                      onClick={() => onCycleSort("title")}
                    />
                    <Th
                      label="Статус"
                      active={sortKey === "status"}
                      dir={sortDir}
                      onClick={() => onCycleSort("status")}
                    />
                    <Th
                      label="Приоритет"
                      active={sortKey === "priority"}
                      dir={sortDir}
                      onClick={() => onCycleSort("priority")}
                    />
                    <Th
                      label="Этап"
                      active={sortKey === "stage"}
                      dir={sortDir}
                      onClick={() => onCycleSort("stage")}
                    />
                    <Th
                      label="Создана"
                      active={sortKey === "created_at"}
                      dir={sortDir}
                      onClick={() => onCycleSort("created_at")}
                    />
                    <th className="px-4 py-3 w-32 text-center">Действия</th>
                  </tr>
                </thead>
                <tbody
                  ref={dropProvided.innerRef}
                  {...dropProvided.droppableProps}
                >
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                        Нет задач, удовлетворяющих фильтрам
                      </td>
                    </tr>
                  ) : (
                    tasks.map((task, index) => (
                      <Draggable
                        key={task.id}
                        draggableId={task.id.toString()}
                        index={index}
                      >
                        {(dragProvided, snapshot) => (
                          <tr
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            className={`border-t border-slate-100 hover:bg-slate-50/50 transition-colors ${
                              snapshot.isDragging ? "bg-indigo-50" : ""
                            }`}
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={task.checked}
                                onChange={() => onToggleTask(task)}
                              />
                            </td>
                            <td className={`px-4 py-3 ${task.checked ? "line-through text-slate-400" : ""}`}>
                              <div className="font-medium">{task.title}</div>
                              {task.description && (
                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                                  {task.description}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Pill tone={STATUS_META[task.status]?.tone || "slate"}>
                                {STATUS_META[task.status]?.label || task.status || "—"}
                              </Pill>
                            </td>
                            <td className="px-4 py-3">
                              <Pill tone={PRIORITY_META[task.priority]?.tone || "slate"}>
                                {PRIORITY_META[task.priority]?.label || task.priority || "—"}
                              </Pill>
                            </td>
                            <td className="px-4 py-3">
                              <Pill tone="slate">{task.stage || "—"}</Pill>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {task.created_at
                                ? new Date(task.created_at).toLocaleDateString()
                                : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-3">
                                <button
                                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                                  onClick={() => onEditTask(task)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  className="p-2 rounded-lg hover:bg-rose-50 text-rose-500"
                                  onClick={() => onDeleteTask(task.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Draggable>
                    ))
                  )}
                  {dropProvided.placeholder && tasks.length > 0 && (
                    <tr>
                      <td colSpan={7}>{dropProvided.placeholder}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </Droppable>
        </div>
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Показано {tasks.length}</span>
        </div>
      </section>
    </DragDropContext>
  );
}

function ViewDropdown({ viewMode, onChange }) {
  const [open, setOpen] = useState(false);
  const options = [
    { value: "table", label: "Список", icon: ListChecks },
    { value: "kanban", label: "Kanban", icon: LayoutGrid },
  ];
  const containerRef = useRef(null);
  useOutsideClose(containerRef, () => setOpen(false), open);
  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 shadow-sm inline-flex items-center gap-2 text-sm"
      >
        Вид
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-2 w-48 rounded-xl bg-white border border-slate-200 shadow-xl shadow-slate-100 p-1">
          {options.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => {
                onChange(value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-sm flex items-center gap-2 ${
                viewMode === value ? "bg-slate-50 text-indigo-600" : ""
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DataDropdown({ onImport, onExport }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  useOutsideClose(containerRef, () => setOpen(false), open);
  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 shadow-sm inline-flex items-center gap-2 text-sm"
      >
        Данные
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-2 w-56 rounded-xl bg-white border border-slate-200 shadow-xl shadow-slate-100 p-1">
          <button
            onClick={() => {
              onImport?.();
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-sm inline-flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Импорт CSV
          </button>
          <button
            onClick={() => {
              onExport?.();
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-sm inline-flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Экспорт JSON
          </button>
        </div>
      )}
    </div>
  );
}

function FiltersDropdown({
  statusOptions,
  priorityOptions,
  stageOptions,
  sortOptions,
  statusValue,
  onStatusChange,
  priorityValue,
  onPriorityChange,
  stageValue,
  onStageChange,
  sortValue,
  onSortChange,
  onReset,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  useOutsideClose(containerRef, () => setOpen(false), open);

  const handleReset = () => {
    onReset();
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 shadow-sm inline-flex items-center gap-2 text-sm"
      >
        <Filter className="h-4 w-4" />
        Фильтры
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl bg-white border border-slate-200 shadow-xl shadow-slate-100 p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Статус</label>
            <select
              value={statusValue}
              onChange={(e) => onStatusChange(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Приоритет</label>
            <select
              value={priorityValue}
              onChange={(e) => onPriorityChange(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              {priorityOptions.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Этап</label>
            <input
              value={stageValue}
              onChange={(e) => onStageChange(e.target.value)}
              list="filter-stage-options"
              placeholder="Например: Backend"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            {stageOptions.length > 0 && (
              <datalist id="filter-stage-options">
                {stageOptions.map((opt) => (
                  <option key={opt} value={opt} />
                ))}
              </datalist>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Сортировка</label>
            <select
              value={sortValue}
              onChange={(e) => onSortChange(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleReset}
              className="text-sm text-slate-500 hover:text-rose-600"
            >
              Сбросить
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm"
            >
              Готово
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ label, active, dir, onClick }) {
  return (
    <th className="px-4 py-3 select-none">
      <button onClick={onClick} className="inline-flex items-center gap-1 hover:underline">
        <span>{label}</span>
        <SortIcon active={active} dir={dir} />
      </button>
    </th>
  );
}

function SortIcon({ active, dir }) {
  if (!active || dir === null) {
    return <ChevronsUpDown className="h-4 w-4 text-slate-400" />;
  }
  return dir === "desc" ? (
    <CDown className="h-4 w-4 text-slate-600" />
  ) : (
    <ChevronUp className="h-4 w-4 text-slate-600" />
  );
}

function Pill({ children, tone }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    green: "bg-green-50 text-green-700 ring-1 ring-green-200",
    amber: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
    rose: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    slate: "bg-slate-50 text-slate-700 ring-1 ring-slate-200",
  };
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
        tones[tone] || tones.slate
      } shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]`}
    >
      {children}
    </span>
  );
}

function UserMenu({ name, initial }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  useOutsideClose(containerRef, () => setOpen(false), open);
  return (
    <div className="relative" ref={containerRef}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-400 to-blue-400 flex items-center justify-center text-white font-medium shadow-md">
          {initial}
        </div>
        <span className="font-medium text-slate-700">{name || "Гость"}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-slate-200 shadow-xl shadow-slate-100 p-1">
          <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50">
            Профиль
          </button>
          <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50">
            Настройки
          </button>
          <div className="my-1 h-px bg-slate-100" />
          <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-rose-50 text-rose-600">
            Выйти
          </button>
        </div>
      )}
    </div>
  );
}

function getSortValue(task, key) {
  switch (key) {
    case "status":
      return STATUS_WEIGHT[task.status] ?? 99;
    case "priority":
      return PRIORITY_WEIGHT[task.priority] ?? 99;
    case "stage":
      return (task.stage || "").toLowerCase();
    case "created_at":
      return task.created_at ? new Date(task.created_at).getTime() : 0;
    case "title":
    default:
      return (task.title || "").toLowerCase();
  }
}

function useOutsideClose(ref, handler, active) {
  useEffect(() => {
    if (!active) return;
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }
      handler(event);
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler, active]);
}

function LogoIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="200 120 650 800"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="#131817"
        d="M376.336 158.781C376.196 155.636 372.359 114.662 388.051 128.354C391.131 131.041 392.882 160.515 393.117 167.362C403.924 178.333 403.794 193.547 395.384 205.899C393.935 208.027 392.449 210.08 391.089 212.27C391.532 215.704 392.217 219.361 392.898 222.75C401.329 264.685 411.358 306.611 429.737 345.467C439.431 365.959 449.365 381.001 468.406 393.838C470.171 388.404 471.397 384.842 473.657 379.605C463.084 374.359 451.17 361.948 448.958 350.215C444.098 324.424 456.264 290.487 469.591 268.322C464.082 258.828 460.156 251.645 465.53 240.842L471.328 245.092C473.701 230.042 473.123 217.677 487.159 207.944C490.326 212.699 493.889 217.746 498.55 221.187C507.519 227.896 519.162 228.008 529.642 230.619C559.178 237.979 576.983 251.633 583.247 281.581C604.597 302.755 603.942 331.101 583.185 352.456C589.442 365.158 579.839 375.442 569.247 381.758C561.224 386.543 554.813 384.36 546.661 381.744C540.514 385.302 532.32 388.912 525.388 390.481C523.945 394.915 522.298 399.374 521.428 403.976C520.534 408.702 524.97 409.059 528.182 409.873C532.757 411.033 536.874 410.909 541.492 411.321C578.511 418.876 610.025 456.352 629.68 486.855C665.935 543.119 686.116 610.017 744.25 649.697C756.597 658.124 772.057 665.262 786.802 668.222C796.832 670.216 807.126 670.509 817.253 669.088C805.494 693.846 784.05 711.674 758.357 720.923C750.629 723.705 732.645 727.565 724.622 726.793C722.177 726.206 712.911 725.55 709.534 725.068C705.433 724.482 697.398 722.651 693.949 722.454C680.278 716.961 668.328 715.056 654.097 720.074C645.618 721.945 640.756 725.587 633.817 730.512C611.99 746.002 582.912 731.4 563.851 718.412C556.93 713.697 550.996 708.714 544.399 704.691L543.816 704.338C549.9 725.566 555.352 746.971 560.164 768.523C563.364 782.54 565.369 797.566 570.061 811.31C573.83 822.347 612.623 852.342 592.515 864.108C572.735 875.681 545.941 867.453 533.609 847.886C532.932 837.057 535.321 826.198 534.351 817.168C533.633 810.477 526.132 793.516 523.118 786.482C512.385 761.44 501.308 735.86 488.194 711.988L479.805 714.475C475.163 706.304 470.56 698.82 466.161 690.428C461.192 680.948 456.339 670.283 450.6 661.378C447.922 678.674 446.098 693.561 443.899 710.86C441.322 711.36 438.448 711.734 435.825 712.133C432.964 742.711 432.802 775.409 433.083 806.081C433.189 817.636 453.063 850.106 430.577 853.32C414.725 855.585 397.574 859.723 381.801 860.763C375.192 861.246 368.552 861.096 361.972 860.312C352.365 859.096 341.176 856.148 344.133 844C346.51 834.236 364.28 829.44 372.026 824.244C380.456 818.588 387.424 812.144 395.626 806.638C394.821 794.592 392.506 779.37 390.979 767.167L383.408 705.479C380.422 704.043 376.275 702.326 373.992 700.1C372.477 696.164 372.769 684.543 372.753 679.62C372.474 650.218 373.928 620.825 377.108 591.594L372.944 587.767C372.838 569.772 376.857 536.287 379.711 518.11C382.03 503.312 384.726 488.576 387.794 473.915C391.028 458.151 397.123 439.733 390.352 424.394C382.992 407.719 374.913 391.185 367.684 374.465C370.876 371.925 374.841 369.335 378.241 366.996C365.807 329.909 358.021 302.611 354.913 263.203C354.272 254.795 353.966 246.365 353.996 237.933C353.984 233.52 354.199 222.177 353.424 218.5C351.044 207.212 342.684 202.576 342.149 189.271C341.847 181.808 344.565 174.538 349.689 169.103C357.31 160.977 365.782 159.159 376.336 158.781Z"
      />
      <path
        fill="#DC2F2C"
        d="M541.492 411.321C578.511 418.876 610.025 456.352 629.68 486.855C665.935 543.119 686.116 610.017 744.25 649.697C756.597 658.124 772.057 665.262 786.802 668.222C796.832 670.216 807.126 670.509 817.253 669.088C805.494 693.846 784.05 711.674 758.357 720.923C750.629 723.705 732.645 727.565 724.622 726.793C722.177 726.206 712.911 725.55 709.534 725.068C705.433 724.482 697.398 722.651 693.949 722.454C680.278 716.961 668.328 715.056 654.097 720.074C645.618 721.945 640.756 725.587 633.817 730.512C611.99 746.002 582.912 731.4 563.851 718.412C556.93 713.697 550.996 708.714 544.399 704.691L543.816 704.338L542.181 699.571L547.659 696.046C542.65 672.376 538.69 648.294 534.744 624.406C534.458 622.675 534.019 621.225 534.874 620.112L537.971 619.93C538.244 619.757 538.517 619.584 538.79 619.412C539.016 616.874 538.736 609.849 538.678 607.62C538.221 583.75 539.226 559.874 541.687 536.126C542.459 529.046 543.552 518.774 545.327 511.989C551.686 517.53 559.788 528.951 564.896 535.873L573.424 531.554C585.147 550.226 593.84 566.038 601.002 587.061C603.334 593.905 604.62 601.01 606.918 607.998C600.122 616.148 589.708 629.865 592.978 641.815C594.192 646.256 599.193 645.001 600.584 646.612C603.226 649.671 604.735 654.568 609.385 656.009C620.567 660.487 637.402 650.716 640.842 639.615C644.357 627.048 639.069 614.733 636.477 602.606C635.425 597.686 635.082 592.273 634.265 587.292C633.357 581.747 632.641 576.188 631.679 570.653C627.976 550.306 621.39 530.592 612.121 512.104L617.536 506.931C604.122 485.878 584.566 446.311 565.041 432.856C547.158 420.533 531.702 428.318 512.372 431.767C520.232 425.716 534.634 417.345 541.492 411.321Z"
      />
      <path
        fill="#FCFBF9"
        d="M509.236 456.027C518.392 455.48 526.552 467.863 519.736 474.638C499.104 495.14 475.822 512.904 454.869 533.139C450.933 536.454 447.549 537.292 444.157 532.668C438.954 525.578 434.473 517.455 429.972 509.883C426.342 503.907 415.721 487.545 418.087 483.259C427.473 466.259 439.215 472.097 446.01 486.633C447.761 490.379 452.675 497.711 454.178 500.122C466.737 488.767 480.174 478.043 493.29 467.336C498.053 463.448 503.751 458.695 509.236 456.027Z"
      />
      <path
        fill="#131817"
        d="M340.42 278.51C341.111 279.588 344.503 304.688 345.093 308.192C310.697 331.607 282.317 362.814 262.262 399.271C228.837 460.332 220.876 532.122 240.112 599.023C261.425 672.962 309.134 728.295 375.877 765.214C376.722 775.642 378.036 786.732 379.157 797.168C373.669 794.807 368.958 792.397 363.644 789.678C313.037 763.263 271.024 722.948 242.545 673.473C203.663 605.631 193.119 525.188 213.202 449.618C226.834 398.595 254.492 352.664 292.369 316.089C306.375 302.565 323.574 288.243 340.42 278.51Z"
      />
      <path
        fill="#131817"
        d="M582.212 243.811C592.465 245.556 614.928 254.139 624.459 258.292C695.905 290.27 751.969 348.982 780.62 421.826C809.642 495.834 805.785 575.343 774.132 647.711C773.631 648.891 773.738 648.988 772.67 649.62C766.093 646.612 755.921 640.617 749.577 636.748C751.399 632.574 753.147 628.367 754.819 624.131C780.663 558.365 779.139 484.996 750.588 420.359C720.229 351.695 664.477 302.591 595.034 275.633C595.219 264.238 588.102 253.562 582.212 243.811Z"
      />
      <path
        fill="#131817"
        d="M693.949 722.454C697.398 722.651 705.433 724.482 709.534 725.068C712.911 725.55 722.177 726.206 724.622 726.793C698.51 767.594 633.69 800.582 588.509 814.418C580.977 803.577 581.801 802.121 579.223 789.284C587.595 785.974 596.238 783.363 604.926 779.774C639.314 765.573 667.505 748.607 693.949 722.454Z"
      />
      <path
        fill="#131817"
        d="M447.026 791.486C470.393 796.394 488.993 798.136 512.833 797.922C515.055 805.648 518.587 816.983 520.077 824.825C496.659 825.759 474.418 825.057 451.361 820.436C446.841 807.878 446.82 804.326 447.026 791.486Z"
      />
      <path
        fill="#131817"
        d="M450.261 237.658C450.996 237.486 450.549 237.517 451.597 237.812C451.663 240.505 450.524 243.444 449.98 246.193C448.662 252.86 449.597 258.816 450.895 265.357C445.539 266.622 423.952 273.436 420.603 273.355C418.658 264.34 416.848 255.297 415.175 246.228C426.683 242.653 438.401 239.791 450.261 237.658Z"
      />
    </svg>
  );
}
