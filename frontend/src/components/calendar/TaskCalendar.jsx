import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { describeProject, formatDeadline } from "../../utils/formatters";

const STATUS_OPTIONS = [
  { label: "To Do", value: "todo" },
  { label: "In Progress", value: "in_progress" },
  { label: "In Review", value: "in_review" },
  { label: "Completed", value: "completed" },
];

const WEEKDAY_LABEL = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });
const DAY_LABEL = new Intl.DateTimeFormat("ru-RU", { day: "numeric" });
const RANGE_LABEL = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
const MONTH_LABEL = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });
const DAY_FULL_LABEL = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const TIMELINE_STEP_MINUTES = 30;
const MIN_DURATION_MS = 30 * 60 * 1000;
const TASK_GRADIENTS = [
  ["#a5b4fc", "#818cf8"],
  ["#93c5fd", "#60a5fa"],
  ["#6ee7b7", "#34d399"],
  ["#fdba74", "#fb923c"],
  ["#fcd34d", "#fbbf24"],
  ["#f472b6", "#ec4899"],
];

const ENTRY_TYPES = {
  TASK: "task",
  PROJECT: "project",
};

export default function TaskCalendar({
  tasks = [],
  projects = [],
  onTaskUpdate,
  onCreateTask,
  onOpenTaskEditor,
  onOpenProject,
  onProjectUpdate,
  onProjectArchive,
  onProjectRestore,
  onProjectDelete,
  statusOptions = STATUS_OPTIONS,
}) {
  const [mode, setMode] = useState("week");
  const [referenceDate, setReferenceDate] = useState(() => startOfDay(new Date()));
  const [saving, setSaving] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [toast, setToast] = useState(null);
  const [draggingBarId, setDraggingBarId] = useState(null);
  const [colorMode, setColorMode] = useState("tasks");
  const [drawerTaskId, setDrawerTaskId] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [isCardDragging, setIsCardDragging] = useState(false);
  const [taskOverviewOpen, setTaskOverviewOpen] = useState(false);
  const [projectOverviewOpen, setProjectOverviewOpen] = useState(false);
  const [creationModalOpen, setCreationModalOpen] = useState(false);
  const [creationModalDate, setCreationModalDate] = useState(null);
  const [creationModalTitle, setCreationModalTitle] = useState("");
  const [creationModalProject, setCreationModalProject] = useState("");
  const userTimezoneRef = useRef(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const userTimezone = userTimezoneRef.current;
  const drawerCloseTimer = useRef(null);

  useEffect(() => {
    setOverrides((prev) => {
      if (!Object.keys(prev).length) {
        return prev;
      }
      let mutated = false;
      const next = { ...prev };
      Object.entries(prev).forEach(([id, value]) => {
        const numId = Number(id);
        const task = tasks.find((t) => t.id === numId);
        const schedule = snapshotSchedule(task);
        if (!task || schedulesEqual(value, schedule)) {
          delete next[id];
          mutated = true;
        }
      });
      return mutated ? next : prev;
    });
  }, [tasks]);

  const effectiveTasks = useMemo(() => {
    if (!Object.keys(overrides).length) {
      return tasks;
    }
    return tasks.map((task) => {
      if (Object.prototype.hasOwnProperty.call(overrides, task.id)) {
        return { ...task, ...overrides[task.id] };
      }
      return task;
    });
  }, [tasks, overrides]);

  const taskEntries = useMemo(
    () =>
      effectiveTasks.map((task) => ({
        ...task,
        __entryType: ENTRY_TYPES.TASK,
      })),
    [effectiveTasks]
  );

  const projectEntries = useMemo(() => buildProjectEntries(projects, userTimezone), [projects, userTimezone]);

  const calendarEntries = colorMode === "projects" ? projectEntries : taskEntries;

  const taskStats = useMemo(() => {
    const now = new Date();
    let planned = 0;
    let unscheduled = 0;
    let overdue = 0;
    let completed = 0;
    effectiveTasks.forEach((task) => {
      const hasSchedule = Boolean(task.start_at || task.end_at);
      if (hasSchedule) {
        planned += 1;
        if (task.end_at) {
          const end = new Date(task.end_at);
          if (end < now && task.status !== "completed") {
            overdue += 1;
          }
        }
      } else {
        unscheduled += 1;
      }
      if (task.status === "completed") {
        completed += 1;
      }
    });
    return {
      total: effectiveTasks.length,
      planned,
      unscheduled,
      overdue,
      completed,
    };
  }, [effectiveTasks]);

  const projectStats = useMemo(() => {
    let archived = 0;
    projects.forEach((project) => {
      if (project.archived_at) {
        archived += 1;
      }
    });
    return {
      total: projects.length,
      active: projects.length - archived,
      archived,
    };
  }, [projects]);

  const handleOpenCreateModal = useCallback((day) => {
    if (!day) return;
    setCreationModalOpen(true);
    setCreationModalDate(toDateKey(day));
    setCreationModalTitle("");
    setCreationModalProject("");
  }, []);

  const handleCloseCreateModal = useCallback(() => {
    setCreationModalOpen(false);
    setCreationModalTitle("");
    setCreationModalProject("");
  }, []);

  const handleSubmitCreateTask = useCallback(async () => {
    if (!creationModalTitle?.trim() || !onCreateTask) {
      return;
    }
    try {
      setSaving(true);
      await onCreateTask({
        title: creationModalTitle.trim(),
        date: creationModalDate,
        projectId: creationModalProject ? Number(creationModalProject) : undefined,
      });
      handleCloseCreateModal();
    } finally {
      setSaving(false);
    }
  }, [creationModalTitle, creationModalDate, creationModalProject, onCreateTask, handleCloseCreateModal]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(referenceDate);
    return Array.from({ length: 7 }, (_, idx) => addDays(start, idx));
  }, [referenceDate]);

  const monthDays = useMemo(() => buildMonthMatrix(referenceDate), [referenceDate]);
  const currentWeekStart = useMemo(() => startOfWeek(new Date()), []);
  const showTodayButton = useMemo(() => {
    if (mode === "week") {
      return startOfWeek(referenceDate).getTime() !== currentWeekStart.getTime();
    }
    if (mode === "month") {
      const today = new Date();
      return referenceDate.getFullYear() !== today.getFullYear() || referenceDate.getMonth() !== today.getMonth();
    }
    return false;
  }, [mode, referenceDate, currentWeekStart]);

  const calendarDays = useMemo(() => {
    if (mode === "week") return weekDays;
    if (mode === "month") return monthDays;
    return [referenceDate];
  }, [mode, weekDays, monthDays, referenceDate]);

  const activeLabel = useMemo(() => {
    if (mode === "week") {
      const start = startOfWeek(referenceDate);
      return `${RANGE_LABEL.format(start)} — ${RANGE_LABEL.format(addDays(start, 6))}`;
    }
    if (mode === "day") {
      return DAY_FULL_LABEL.format(referenceDate);
    }
    return MONTH_LABEL.format(referenceDate);
  }, [mode, referenceDate]);

  const handleNavigate = useCallback(
    (direction) => {
      setReferenceDate((prev) => {
        if (mode === "week") {
          return addDays(prev, direction * 7);
        }
        if (mode === "day") {
          return addDays(prev, direction);
        }
        const next = new Date(prev);
        next.setMonth(next.getMonth() + direction);
        return startOfDay(next);
      });
    },
    [mode]
  );

  const handleToday = useCallback(() => setReferenceDate(startOfDay(new Date())), []);
  const handleModeChange = useCallback((nextMode) => setMode(nextMode), []);

  const handleOpenDrawer = useCallback((taskId) => {
    if (drawerCloseTimer.current) {
      clearTimeout(drawerCloseTimer.current);
      drawerCloseTimer.current = null;
    }
    setSelectedTaskId(taskId);
    setDrawerTaskId(taskId);
    requestAnimationFrame(() => setDrawerVisible(true));
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setDrawerVisible(false);
    if (drawerCloseTimer.current) {
      clearTimeout(drawerCloseTimer.current);
    }
    drawerCloseTimer.current = setTimeout(() => {
      setDrawerTaskId(null);
      drawerCloseTimer.current = null;
    }, 250);
  }, []);

  useEffect(
    () => () => {
      if (drawerCloseTimer.current) {
        clearTimeout(drawerCloseTimer.current);
      }
    },
    []
  );

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === "Escape") {
        handleCloseDrawer();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [handleCloseDrawer]);

  useEffect(() => {
    if (drawerTaskId && !effectiveTasks.find((task) => task.id === drawerTaskId)) {
      setDrawerTaskId(null);
    }
  }, [drawerTaskId, effectiveTasks]);

  const weekRangeStart = useMemo(() => startOfWeek(referenceDate), [referenceDate]);
  const weekRangeEnd = useMemo(() => endOfDay(addDays(weekRangeStart, 6)), [weekRangeStart]);
  const monthRangeStart = useMemo(() => (monthDays.length ? startOfDay(monthDays[0]) : weekRangeStart), [monthDays, weekRangeStart]);
  const monthRangeEnd = useMemo(
    () => (monthDays.length ? endOfDay(monthDays[monthDays.length - 1]) : weekRangeEnd),
    [monthDays, weekRangeEnd]
  );

  const weekEntries = useMemo(
    () => selectTasksInRange(calendarEntries, weekRangeStart, weekRangeEnd, userTimezone),
    [calendarEntries, weekRangeStart, weekRangeEnd, userTimezone]
  );
  const monthEntries = useMemo(
    () => selectTasksInRange(calendarEntries, monthRangeStart, monthRangeEnd, userTimezone),
    [calendarEntries, monthRangeStart, monthRangeEnd, userTimezone]
  );

  const allDayBars = useMemo(() => {
    if (mode !== "week") return [];
    return computeAllDayBars(weekEntries, weekRangeStart, weekRangeEnd, colorMode);
  }, [weekEntries, weekRangeStart, weekRangeEnd, mode, colorMode]);

  const monthBars = useMemo(() => {
    if (mode !== "month") return [];
    return computeMonthBars(monthEntries, monthDays, colorMode);
  }, [monthEntries, monthDays, mode, colorMode]);

  const previewScheduleChange = useCallback(
    (taskId, nextSchedule) => {
      if (!nextSchedule) {
        setOverrides((prev) => {
          if (!Object.prototype.hasOwnProperty.call(prev, taskId)) {
            return prev;
          }
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
        return;
      }
      const normalized = normalizeScheduleInput(nextSchedule, userTimezone);
      setOverrides((prev) => ({ ...prev, [taskId]: normalized }));
    },
    [userTimezone]
  );

  const persistScheduleChange = useCallback(
    (taskId, nextSchedule, previousSchedule, message, options = {}) => {
      const normalizedNext = normalizeScheduleInput(nextSchedule, userTimezone);
      const normalizedPrev = previousSchedule ? normalizeScheduleInput(previousSchedule, userTimezone) : null;
      setOverrides((prev) => ({ ...prev, [taskId]: normalizedNext }));
      if (onTaskUpdate) {
        const maybePromise = onTaskUpdate(taskId, normalizedNext);
        if (maybePromise && typeof maybePromise.catch === "function") {
          maybePromise.catch((err) => {
            console.error("Не удалось обновить задачу:", err?.message || err);
            setOverrides((prev) => {
              const next = { ...prev };
              if (normalizedPrev) {
                next[taskId] = normalizedPrev;
              } else {
                delete next[taskId];
              }
              return next;
            });
          });
        }
      }
      if (!options.skipToast && message) {
        setToast({
          message,
          undo: normalizedPrev
            ? () => {
                persistScheduleChange(taskId, normalizedPrev, normalizedNext, null, { skipToast: true });
                setToast(null);
              }
            : null,
        });
      }
    },
    [onTaskUpdate, userTimezone]
  );

  const handleAssignDateBulk = useCallback(
    async (taskIds, dateString) => {
      if (!dateString) {
        return;
      }
      const iso = toISODate(dateString);
      await Promise.all(
        taskIds.map(async (taskId) => {
          const task = effectiveTasks.find((t) => t.id === taskId);
          if (!task) return;
          const nextSchedule = buildAllDaySchedule(iso, userTimezone);
          const prevSchedule = snapshotSchedule(task);
          const message = describeDateRange(task.title || "Задача", nextSchedule);
          await persistScheduleChange(taskId, nextSchedule, prevSchedule, message);
        })
      );
    },
    [effectiveTasks, persistScheduleChange, userTimezone]
  );

  const handleClearDateBulk = useCallback(
    async (taskIds) => {
      if (!taskIds?.length) {
        return;
      }
      await Promise.all(
        taskIds.map(async (taskId) => {
          const task = effectiveTasks.find((t) => t.id === taskId);
          if (!task) return;
          const prevSchedule = snapshotSchedule(task);
          const nextSchedule = { start_at: null, end_at: null, all_day: false };
          const message = `${task.title || "Задача"} перенесена в «Без даты»`;
          await persistScheduleChange(taskId, nextSchedule, prevSchedule, message);
        })
      );
    },
    [effectiveTasks, persistScheduleChange]
  );

  const handleMoveTasksToProject = useCallback(
    async (taskIds, projectId) => {
      if (!onTaskUpdate) {
        return;
      }
      await Promise.all(taskIds.map((taskId) => onTaskUpdate(taskId, { project_id: projectId || null })));
    },
    [onTaskUpdate]
  );


  const handleDragEnd = useCallback(
    (result) => {
      const { source, destination, draggableId } = result;
      if (!destination || destination.droppableId === source.droppableId) {
        return;
      }
      const taskId = Number(draggableId.replace("task-", ""));
      if (Number.isNaN(taskId)) return;
      const task = effectiveTasks.find((t) => t.id === taskId);
      const previousSchedule = snapshotSchedule(task);
      const taskTitle = task?.title || "Задача";

      if (destination.droppableId === "unscheduled") {
        const message = `${taskTitle} перенесена в «Без даты»`;
        persistScheduleChange(taskId, { start_at: null, end_at: null, all_day: false }, previousSchedule, message);
        return;
      }
      if (destination.droppableId.startsWith("day-")) {
        const dateKey = destination.droppableId.replace("day-", "");
        const nextSchedule = buildAllDaySchedule(toISODate(dateKey), userTimezone);
        const label = `${taskTitle} перенесена на ${formatDateLabel(nextSchedule.start_at)}`;
        persistScheduleChange(taskId, nextSchedule, previousSchedule, label);
      }
    },
    [effectiveTasks, persistScheduleChange, userTimezone]
  );

  const weekView = (
    <WeekView
      weekDays={weekDays}
      allDayBars={allDayBars}
      onSelectTask={handleOpenDrawer}
      selectedTaskId={selectedTaskId}
      onPreviewSchedule={previewScheduleChange}
      onCommitSchedule={persistScheduleChange}
      draggingBarId={draggingBarId}
      setDraggingBarId={setDraggingBarId}
      isCardDragging={isCardDragging}
    />
  );

  const monthView = (
    <MonthView
      days={monthDays}
      monthBars={monthBars}
      onSelectTask={handleOpenDrawer}
      selectedTaskId={selectedTaskId}
      onStartCreate={handleOpenCreateModal}
      onPreviewSchedule={previewScheduleChange}
      onCommitSchedule={persistScheduleChange}
      draggingBarId={draggingBarId}
      setDraggingBarId={setDraggingBarId}
    />
  );

  const drawerTask = drawerTaskId ? effectiveTasks.find((task) => task.id === drawerTaskId) : null;

  return (
    <DragDropContext
      onDragStart={() => setIsCardDragging(true)}
      onDragEnd={(result) => {
        setIsCardDragging(false);
        handleDragEnd(result);
      }}
    >
      <section className="space-y-5">
        <CalendarHeader
      mode={mode}
      activeLabel={activeLabel}
      onNavigate={handleNavigate}
      onToday={handleToday}
      onModeChange={handleModeChange}
      colorMode={colorMode}
      setColorMode={setColorMode}
      showTodayButton={showTodayButton}
      onOpenTaskOverview={() => setTaskOverviewOpen(true)}
      onOpenProjectOverview={() => setProjectOverviewOpen(true)}
    />
        {mode === "week" && weekView}
        {mode === "month" && monthView}
      </section>
      <TaskDrawer
        task={drawerTask}
        visible={drawerVisible}
        onClose={handleCloseDrawer}
        onEdit={() => drawerTask && onOpenTaskEditor?.(drawerTask)}
        onStatusChange={(status) => drawerTask && onTaskUpdate?.(drawerTask.id, { status })}
        statusOptions={statusOptions}
      />
      {taskOverviewOpen && (
        <TaskOverviewModal
          visible={taskOverviewOpen}
          onClose={() => setTaskOverviewOpen(false)}
          stats={taskStats}
          tasks={effectiveTasks}
          projects={projects}
          onAssignDate={handleAssignDateBulk}
          onClearDate={handleClearDateBulk}
          onMoveToProject={handleMoveTasksToProject}
        />
      )}
      {projectOverviewOpen && (
        <ProjectOverviewModal
          visible={projectOverviewOpen}
          onClose={() => setProjectOverviewOpen(false)}
          stats={projectStats}
          projects={projects}
          tasks={effectiveTasks}
          onOpenProject={onOpenProject}
          onRename={onProjectUpdate}
          onArchive={onProjectArchive}
          onRestore={onProjectRestore}
          onDelete={onProjectDelete}
        />
      )}
      {creationModalOpen && (
        <CreateTaskModal
          visible={creationModalOpen}
          onClose={handleCloseCreateModal}
          onSubmit={handleSubmitCreateTask}
          title={creationModalTitle}
          setTitle={setCreationModalTitle}
          date={creationModalDate}
          setDate={setCreationModalDate}
          projectId={creationModalProject}
          setProjectId={setCreationModalProject}
          projects={projects}
          saving={saving}
        />
      )}
      {toast && <Toast message={toast.message} onUndo={toast.undo} onClose={() => setToast(null)} />}
      <HiddenUnscheduledDropZone />
    </DragDropContext>
  );
}

function CalendarHeader({
  mode,
  activeLabel,
  onNavigate,
  onToday,
  onModeChange,
  colorMode,
  setColorMode,
  showTodayButton,
  onOpenTaskOverview,
  onOpenProjectOverview,
}) {
  return (
    <header className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-xl shadow-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-1 flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate(-1)}
              className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
              aria-label="Назад"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-base font-semibold text-slate-900">{activeLabel}</div>
            <button
              onClick={() => onNavigate(1)}
              className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
              aria-label="Вперёд"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {showTodayButton && (
              <button
                onClick={onToday}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Сегодня
              </button>
            )}
          </div>
          <div className="inline-flex overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
            {[
              { key: "week", label: "Неделя" },
              { key: "month", label: "Месяц" },
            ].map((option) => {
              const active = mode === option.key;
              return (
                <button
                  key={option.key}
                  onClick={() => onModeChange(option.key)}
                  className={`px-3 py-1 text-sm transition-all duration-200 ${
                    active ? "bg-indigo-600 text-white shadow" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
            {[
              { key: "tasks", label: "Задачи" },
              { key: "projects", label: "Проекты" },
            ].map((option) => {
              const active = colorMode === option.key;
              return (
                <button
                  key={option.key}
                  onClick={() => setColorMode(option.key)}
                  className={`px-3 py-1 text-sm transition-all duration-200 ${
                    active ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {colorMode === "tasks" && (
            <button
              onClick={onOpenTaskOverview}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Обзор задач
            </button>
          )}
          {colorMode === "projects" && (
            <button
              onClick={onOpenProjectOverview}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Обзор проектов
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function WeekView({
  weekDays,
  allDayBars,
  onSelectTask,
  selectedTaskId,
  onPreviewSchedule,
  onCommitSchedule,
  draggingBarId,
  setDraggingBarId,
  isCardDragging,
}) {
  const columnWidthPercent = 100 / weekDays.length;
  const maxRow = allDayBars.reduce((acc, bar) => Math.max(acc, bar.row), -1);
  const laneHeight = Math.max(128, (maxRow + 1) * 48 + 48);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-100">
      <WeekColumnHeader weekDays={weekDays} />

      <div className="border-b border-slate-100 px-6 py-6">
        <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white">
          <GridColumnsOverlay weekDays={weekDays} />
          <AllDayLane
            bars={allDayBars}
            columnWidthPercent={columnWidthPercent}
            laneHeight={laneHeight}
            onSelectTask={onSelectTask}
            selectedTaskId={selectedTaskId}
            onPreviewSchedule={onPreviewSchedule}
            onCommitSchedule={onCommitSchedule}
            draggingTaskId={draggingBarId}
            setDraggingTaskId={setDraggingBarId}
            isCardDragging={isCardDragging}
          />
          {weekDays.map((day, index) => (
            <DayDropZone
              key={`all-day-${day.toISOString()}`}
              droppableId={`day-${toDateKey(day)}`}
              columnWidthPercent={columnWidthPercent}
              index={index}
              height={laneHeight}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function WeekColumnHeader({ weekDays }) {
  const todayKey = toDateKey(new Date());
  return (
    <div className="grid grid-cols-7 gap-0 border-b border-slate-100 px-6">
      {weekDays.map((day) => {
        const isToday = toDateKey(day) === todayKey;
        return (
          <div
            key={day.toISOString()}
            className={`flex flex-col gap-1 border-r border-slate-100 py-4 text-sm last:border-r-0 ${
              isToday ? "bg-indigo-50/80 rounded-t-2xl" : ""
            }`}
          >
            <span className={`text-xs uppercase tracking-[0.2em] ${isToday ? "text-indigo-600" : "text-slate-400"}`}>{WEEKDAY_LABEL.format(day)}</span>
            <span className={`text-lg font-semibold ${isToday ? "text-indigo-600" : "text-slate-800"}`}>{DAY_LABEL.format(day)}</span>
          </div>
        );
      })}
    </div>
  );
}

function GridColumnsOverlay({ weekDays }) {
  const todayKey = toDateKey(new Date());
  return (
    <div className="pointer-events-none absolute inset-0 z-0 grid grid-cols-7 gap-0">
      {weekDays.map((day, idx) => (
        <div
          key={day.toISOString()}
          className="border-r border-slate-100 last:border-r-0"
          style={{ background: toDateKey(day) === todayKey ? "rgba(99,102,241,0.1)" : "transparent" }}
        />
      ))}
    </div>
  );
}

function AllDayLane({
  bars,
  columnWidthPercent,
  laneHeight,
  onSelectTask,
  selectedTaskId,
  onPreviewSchedule,
  onCommitSchedule,
  draggingTaskId,
  setDraggingTaskId,
  isCardDragging,
}) {
  const laneRef = useRef(null);
  const createGesture = useBarGestures({
    onPreviewSchedule,
    onCommitSchedule,
    setDraggingTaskId,
  });

  const buildAllDayGesture = useCallback(
    (bar, mode) =>
      createGesture({
        task: bar.task,
        getMeta: () => {
          const rect = laneRef.current?.getBoundingClientRect();
          return {
            pointerStartX: null,
            initialStart: new Date(bar.startDate),
            initialEnd: new Date(bar.endDate),
            laneWidth: rect?.width ?? 0,
            mode,
          };
        },
        computeSchedule: (moveEvent, meta) => {
          if (!meta.laneWidth) {
            return null;
          }
          const dayWidthPx = meta.laneWidth / 7;
          if (!dayWidthPx) {
            return null;
          }
          const deltaDays = Math.round((moveEvent.clientX - meta.pointerStartX) / dayWidthPx);
          if (deltaDays === meta.lastDelta) {
            return meta.cachedSchedule || null;
          }
          meta.lastDelta = deltaDays;
          let nextStart = new Date(meta.initialStart);
          let nextEnd = new Date(meta.initialEnd);
          if (meta.mode === "move") {
            nextStart = shiftDateByDays(meta.initialStart, deltaDays);
            nextEnd = shiftDateByDays(meta.initialEnd, deltaDays);
          } else if (meta.mode === "resize-start") {
            nextStart = shiftDateByDays(meta.initialStart, deltaDays);
            if (nextStart >= nextEnd) {
              nextStart = shiftDateByDays(nextEnd, -1);
            }
          } else if (meta.mode === "resize-end") {
            nextEnd = shiftDateByDays(meta.initialEnd, deltaDays);
            if (nextEnd <= nextStart) {
              nextEnd = shiftDateByDays(nextStart, 1);
            }
          }
          const { start, end } = clampAllDayBounds(nextStart, nextEnd);
          const schedule = {
            start_at: start.toISOString(),
            end_at: end.toISOString(),
            all_day: true,
          };
          meta.cachedSchedule = schedule;
          return schedule;
        },
      }),
    [createGesture]
  );

  return (
    <div
      ref={laneRef}
      className="relative flex flex-col justify-center overflow-visible bg-slate-50/80 px-2 py-4 shadow-inner"
      style={{ zIndex: 10, minHeight: laneHeight }}
    >
      {isCardDragging && (
        <div className="pointer-events-none absolute inset-1 rounded-2xl border-2 border-dashed border-indigo-300/70 bg-indigo-50/40 text-center text-xs font-semibold text-indigo-600">
          Бросьте сюда, чтобы сделать задачей «весь день»
        </div>
      )}
      {bars.length === 0 && !isCardDragging && <p className="text-xs text-slate-400">Нет задач</p>}
      {bars.map((bar) => (
        <button
          key={`${bar.task.id}-${bar.row}`}
          type="button"
          onClick={() => bar.task.__entryType !== ENTRY_TYPES.PROJECT && onSelectTask?.(bar.task.id)}
          onPointerDown={bar.task.__entryType !== ENTRY_TYPES.PROJECT ? buildAllDayGesture(bar, "move") : undefined}
          className={`group absolute pointer-events-auto rounded-xl border border-transparent px-3 py-1 text-left text-xs font-semibold shadow-lg shadow-slate-900/10 transition ${
            selectedTaskId === bar.task.id ? "ring-2 ring-offset-1 ring-white/40" : ""
          } ${draggingTaskId === bar.task.id ? "ring-2 ring-indigo-200 shadow-lg dragging" : "hover:ring-2 hover:ring-offset-2 hover:ring-indigo-200/50"}`}
          style={{
            left: `${bar.left}%`,
            width: `${Math.max(bar.width, columnWidthPercent)}%`,
            top: `${bar.row * 48}px`,
            backgroundImage: bar.tint?.gradient,
            color: "#fff",
            zIndex: draggingTaskId === bar.task.id ? 30 : 20,
          }}
        >
          <p className="truncate text-xs text-white">{bar.task.title}</p>
          <p className="text-[10px] text-white/80">{bar.task.project?.title || "Без проекта"}</p>
          {bar.task.__entryType !== ENTRY_TYPES.PROJECT && (
            <>
              <ResizeHandle side="start" onPointerDown={buildAllDayGesture(bar, "resize-start")} />
              <ResizeHandle side="end" onPointerDown={buildAllDayGesture(bar, "resize-end")} />
            </>
          )}
        </button>
      ))}
    </div>
  );
}

function DayDropZone({ droppableId, columnWidthPercent, index, height }) {
  return (
    <Droppable droppableId={droppableId}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`absolute rounded-lg transition ${
            snapshot.isDraggingOver ? "bg-indigo-50/60" : index === (new Date().getDay() + 6) % 7 ? "bg-indigo-50/20" : "bg-transparent"
          }`}
          style={{
            left: `${index * columnWidthPercent}%`,
            width: `${columnWidthPercent}%`,
            top: 0,
            height,
          }}
        >
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
}

function HourLines() {
  return (
    <div className="pointer-events-none absolute inset-4">
      {Array.from({ length: 24 }).map((_, hour) => (
        <div
          key={hour}
          className={`absolute inset-x-0 border-t border-dashed ${hour % 2 === 0 ? "border-slate-200 text-[12px] font-semibold text-slate-400" : "border-slate-100 text-[10px] text-slate-300"}`}
          style={{ top: `${(hour / 24) * 100}%` }}
        >
          {hour % 2 === 0 ? `${hour}:00` : ""}
        </div>
      ))}
    </div>
  );
}

function CurrentTimeIndicator({ day }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  if (!isSameDay(now, day)) {
    return null;
  }
  const top = (minutesSinceMidnight(now) / (24 * 60)) * 100;

  return (
    <div className="pointer-events-none absolute inset-x-8" style={{ top: `${top}%` }}>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-rose-500 shadow shadow-rose-200" />
        <span className="h-px flex-1 bg-rose-400/70" />
      </div>
    </div>
  );
}

function ResizeHandle({ side, onPointerDown, orientation = "horizontal" }) {
  const isHorizontal = orientation === "horizontal";
  const cursor = isHorizontal ? (side === "start" ? "cursor-w-resize" : "cursor-e-resize") : side === "start" ? "cursor-n-resize" : "cursor-s-resize";
  const sidePosition = isHorizontal ? (side === "start" ? "left-1" : "right-1") : side === "start" ? "top-1" : "bottom-1";
  const axisPosition = isHorizontal ? "top-1/2" : "left-1/2";
  const translate = isHorizontal ? "-translate-y-1/2" : "-translate-x-1/2";
  const sizeClass = isHorizontal ? "h-4 w-1" : "h-1 w-8";
  return (
    <span
      onPointerDown={(event) => {
        event.stopPropagation();
        onPointerDown?.(event);
      }}
      className={`absolute ${sidePosition} ${axisPosition} ${sizeClass} ${translate} rounded-full bg-white/80 opacity-0 transition group-hover:opacity-100 ${cursor}`}
    />
  );
}

function DayView({
  day,
  tasks,
  onSelectTask,
  selectedTaskId,
  onPreviewSchedule,
  onCommitSchedule,
  draggingBarId,
  setDraggingBarId,
}) {
  const timelineTasks = tasks.filter((task) => isSameDay(new Date(task.start_at ?? task.end_at ?? day), day) && isTimedTask(task));
  const items = useMemo(() => buildDayTimeline(timelineTasks), [timelineTasks]);
  const containerRef = useRef(null);
  const createGesture = useBarGestures({
    onPreviewSchedule,
    onCommitSchedule,
    setDraggingTaskId: setDraggingBarId,
  });
  const makeDayGesture = useCallback(
    (item, mode) =>
      createGesture({
        task: item.task,
        getMeta: () => {
          const rect = containerRef.current?.getBoundingClientRect();
          const height = rect?.height ?? 0;
          return {
            pointerStartY: null,
            containerHeight: height,
            minutesPerPixel: height ? (24 * 60) / height : 0,
            initialStart: item.start,
            initialEnd: item.end,
            mode,
            dayStart: startOfDay(item.start),
            dayEnd: endOfDay(item.start),
          };
        },
        computeSchedule: (moveEvent, meta) => {
          if (!meta.minutesPerPixel) {
            return null;
          }
          const rawMinutes = (moveEvent.clientY - meta.pointerStartY) * meta.minutesPerPixel;
          const deltaMinutes = Math.round(rawMinutes / TIMELINE_STEP_MINUTES) * TIMELINE_STEP_MINUTES;
          let nextStart = new Date(meta.initialStart);
          let nextEnd = new Date(meta.initialEnd);
          if (meta.mode === "move") {
            nextStart = addMinutes(meta.initialStart, deltaMinutes);
            nextEnd = addMinutes(meta.initialEnd, deltaMinutes);
          } else if (meta.mode === "resize-start") {
            nextStart = addMinutes(meta.initialStart, deltaMinutes);
            if (nextStart >= nextEnd) {
              nextStart = new Date(nextEnd.getTime() - MIN_DURATION_MS);
            }
          } else if (meta.mode === "resize-end") {
            nextEnd = addMinutes(meta.initialEnd, deltaMinutes);
            if (nextEnd <= nextStart) {
              nextEnd = new Date(nextStart.getTime() + MIN_DURATION_MS);
            }
          }
          if (nextStart < meta.dayStart) {
            const diff = meta.dayStart.getTime() - nextStart.getTime();
            nextStart = meta.dayStart;
            if (meta.mode === "move") {
              nextEnd = new Date(nextEnd.getTime() + diff);
            }
          }
          if (nextEnd > meta.dayEnd) {
            const diff = nextEnd.getTime() - meta.dayEnd.getTime();
            nextEnd = meta.dayEnd;
            if (meta.mode === "move") {
              nextStart = new Date(nextStart.getTime() - diff);
            }
          }
          return {
            start_at: nextStart.toISOString(),
            end_at: nextEnd.toISOString(),
            all_day: false,
          };
        },
      }),
    [createGesture]
  );
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-100">
      <div className="border-b border-slate-100 px-6 py-4">
        <h3 className="text-sm font-semibold text-slate-600">День: {DAY_FULL_LABEL.format(day)}</h3>
      </div>
      <div ref={containerRef} className="relative h-[720px] px-6 py-4">
        <HourLines />
        <CurrentTimeIndicator day={day} />
        {items.map((item) => (
          <button
            key={item.task.id}
            onClick={() => onSelectTask?.(item.task.id)}
            onPointerDown={makeDayGesture(item, "move")}
            className={`group absolute cursor-grab rounded-2xl border px-4 py-2 text-left text-xs font-semibold shadow-lg shadow-slate-900/10 transition active:cursor-grabbing ${
              selectedTaskId === item.task.id ? "ring-2 ring-offset-1 ring-white/70" : ""
            } ${draggingBarId === item.task.id ? "ring-2 ring-indigo-200" : "hover:ring-2 hover:ring-offset-2 hover:ring-indigo-200/60"}`}
            style={{
              top: `${item.top}%`,
              height: `${item.height}%`,
              left: `${item.left}%`,
              width: `${item.width}%`,
            }}
          >
            <p className="truncate text-slate-800">{item.task.title}</p>
            <p className="text-[10px] text-slate-500">{item.timeLabel}</p>
            <ResizeHandle orientation="vertical" side="start" onPointerDown={makeDayGesture(item, "resize-start")} />
            <ResizeHandle orientation="vertical" side="end" onPointerDown={makeDayGesture(item, "resize-end")} />
          </button>
        ))}
      </div>
    </section>
  );
}

function MonthView({
  days,
  monthBars,
  onSelectTask,
  selectedTaskId,
  onStartCreate,
  onPreviewSchedule,
  onCommitSchedule,
  draggingBarId,
  setDraggingBarId,
}) {
  const weeks = useMemo(() => chunk(days, 7), [days]);
  const weekRefs = useRef([]);
  const setWeekRef = useCallback((node, index) => {
    weekRefs.current[index] = node;
  }, []);

  const createGesture = useBarGestures({
    onPreviewSchedule,
    onCommitSchedule,
    setDraggingTaskId: setDraggingBarId,
  });

  const makeMonthGesture = useCallback(
    (bar, mode) =>
      createGesture({
        task: bar.task,
        getMeta: (event) => {
          const rowNode = weekRefs.current[bar.week] || event.currentTarget?.closest("[data-month-week]");
          const rect = rowNode?.getBoundingClientRect();
          const width = rect?.width ?? 0;
          return {
            pointerStartX: null,
            dayWidth: width ? width / 7 : 0,
            initialStart: new Date(bar.task.start_at || bar.startDate),
            initialEnd: new Date(bar.task.end_at || bar.endDate),
            mode,
          };
        },
        computeSchedule: (moveEvent, meta) => {
          if (!meta.dayWidth) {
            return null;
          }
          const deltaDays = Math.round((moveEvent.clientX - meta.pointerStartX) / meta.dayWidth);
          let nextStart = new Date(meta.initialStart);
          let nextEnd = new Date(meta.initialEnd);
          if (meta.mode === "move") {
            nextStart = shiftDateByDays(meta.initialStart, deltaDays);
            nextEnd = shiftDateByDays(meta.initialEnd, deltaDays);
          } else if (meta.mode === "resize-start") {
            nextStart = shiftDateByDays(meta.initialStart, deltaDays);
            if (nextStart >= nextEnd) {
              nextStart = shiftDateByDays(nextEnd, -1);
            }
          } else if (meta.mode === "resize-end") {
            nextEnd = shiftDateByDays(meta.initialEnd, deltaDays);
            if (nextEnd <= nextStart) {
              nextEnd = shiftDateByDays(nextStart, 1);
            }
          }
          const { start, end } = clampAllDayBounds(nextStart, nextEnd);
          return {
            start_at: start.toISOString(),
            end_at: end.toISOString(),
            all_day: true,
          };
        },
      }),
    [createGesture]
  );

  const todayKey = toDateKey(new Date());

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-100 transition-all duration-300">
      <div className="grid grid-cols-7 gap-px border-b border-slate-100 bg-slate-100 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((label) => (
          <div key={label} className="bg-white px-3 py-2">
            {label}
          </div>
        ))}
      </div>
      <div className="space-y-px bg-slate-100">
        {weeks.map((weekDays, weekIndex) => {
          const weekBars = monthBars.filter((bar) => bar.week === weekIndex);
          return (
            <div
              key={weekIndex}
              data-month-week
              ref={(node) => setWeekRef(node, weekIndex)}
              className="relative min-h-[148px] border-b border-white/50 bg-white px-3 py-4 last:border-b-0"
            >
              <div className="grid grid-cols-7 gap-3">
                {weekDays.map((day) => {
                  const key = toDateKey(day);
                  const isToday = key === todayKey;
                  return (
                    <div
                      key={key}
                      onClick={() => onStartCreate(day)}
                      className={`relative cursor-pointer rounded-2xl border px-3 pb-14 pt-3 transition hover:border-indigo-200 hover:shadow ${
                        isToday ? "border-indigo-200 bg-indigo-50/70 shadow-inner shadow-indigo-100" : "border-slate-100 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className={isToday ? "text-indigo-600" : "text-slate-600"}>{DAY_LABEL.format(day)}</span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onStartCreate(day);
                          }}
                          className="rounded-full border border-slate-200 px-2 text-[10px] text-slate-500 hover:bg-slate-50"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="pointer-events-none absolute inset-x-3 bottom-3 top-11">
                {weekBars.map((bar) => (
                  <button
                    key={`${bar.task.id}-${bar.week}-${bar.row}-${bar.left}`}
                    onClick={() => bar.task.__entryType !== ENTRY_TYPES.PROJECT && onSelectTask?.(bar.task.id)}
                    onPointerDown={bar.task.__entryType !== ENTRY_TYPES.PROJECT ? makeMonthGesture(bar, "move") : undefined}
                    className={`group absolute pointer-events-auto flex h-7 items-center gap-2 rounded-2xl px-3 text-left text-xs font-semibold text-white shadow-lg shadow-slate-900/15 transition ${
                      selectedTaskId === bar.task.id ? "ring-2 ring-offset-1 ring-white/70" : ""
                    } ${draggingBarId === bar.task.id ? "ring-2 ring-indigo-200 dragging" : "hover:ring-2 hover:ring-offset-2 hover:ring-indigo-200/60"}`}
                    style={{
                      left: `${bar.left}%`,
                      width: `${bar.width}%`,
                      top: `${bar.row * 34}px`,
                      backgroundImage: bar.tint?.gradient,
                      zIndex: draggingBarId === bar.task.id ? 30 : 15,
                    }}
                  >
                    <span className="truncate">{bar.task.title}</span>
                    {bar.task.__entryType !== ENTRY_TYPES.PROJECT && (
                      <>
                        <ResizeHandle side="start" onPointerDown={makeMonthGesture(bar, "resize-start")} />
                        <ResizeHandle side="end" onPointerDown={makeMonthGesture(bar, "resize-end")} />
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HiddenUnscheduledDropZone() {
  return (
    <Droppable droppableId="unscheduled">
      {(provided) => (
        <div ref={provided.innerRef} {...provided.droppableProps} className="sr-only">
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
}

function TaskOverviewModal({ visible, onClose, stats, tasks = [], projects = [], onAssignDate, onClearDate, onMoveToProject }) {
  const [selected, setSelected] = useState([]);
  const [bulkDate, setBulkDate] = useState("");
  const [bulkProject, setBulkProject] = useState("");

  useEffect(() => {
    if (!visible) {
      setSelected([]);
      setBulkDate("");
      setBulkProject("");
    }
  }, [visible]);

  useEffect(() => {
    setSelected((prev) => prev.filter((id) => tasks.some((task) => task.id === id)));
  }, [tasks]);

  useEffect(() => {
    if (!visible) return;
    const handleKey = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [visible, onClose]);

  const toggleSelection = (taskId) => {
    setSelected((prev) => (prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]));
  };

  const allSelected = tasks.length > 0 && selected.length === tasks.length;

  const handleSelectAll = () => {
    setSelected(allSelected ? [] : tasks.map((task) => task.id));
  };

  const handleBulkAssign = async () => {
    if (!bulkDate || !selected.length) return;
    await onAssignDate?.(selected, bulkDate);
    setBulkDate("");
  };

  const handleBulkClear = async () => {
    if (!selected.length) return;
    await onClearDate?.(selected);
  };

  const handleBulkMove = async () => {
    await onMoveToProject?.(
      selected,
      bulkProject ? Number(bulkProject) : null
    );
    setBulkProject("");
  };

  const statsList = [
    { label: "Всего задач", value: stats.total },
    { label: "Запланировано", value: stats.planned },
    { label: "Без даты", value: stats.unscheduled },
    { label: "Просрочено", value: stats.overdue },
    { label: "Выполнено", value: stats.completed },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex w-full max-w-5xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Обзор задач</h2>
            <p className="text-sm text-slate-500">Аналитика и массовые операции</p>
          </div>
          <button onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
            ×
          </button>
        </div>
        <div className="px-6 py-4 space-y-4 overflow-y-auto max-h-[70vh]">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {statsList.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-800">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Массовые действия</h3>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-semibold text-slate-500">
                Дата
                <input
                  type="date"
                  value={bulkDate || ""}
                  onChange={(event) => setBulkDate(event.target.value)}
                  className="ml-2 rounded-xl border border-slate-200 px-2 py-1 text-sm"
                />
              </label>
              <button
                onClick={handleBulkAssign}
                disabled={!bulkDate || !selected.length}
                className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 disabled:opacity-50"
              >
                Назначить дату
              </button>
              <button
                onClick={handleBulkClear}
                disabled={!selected.length}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50"
              >
                Убрать дату
              </button>
              <label className="text-xs font-semibold text-slate-500">
                Проект
                <select
                  value={bulkProject}
                  onChange={(event) => setBulkProject(event.target.value)}
                  className="ml-2 rounded-xl border border-slate-200 px-2 py-1 text-sm"
                >
                  <option value="">Без проекта</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={handleBulkMove}
                disabled={!selected.length}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50"
              >
                Перенести
              </button>
              <span className="text-xs text-slate-500">Выбрано: {selected.length}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-400">
                <tr>
                  <th className="px-3 py-2">
                    <input type="checkbox" checked={allSelected} onChange={handleSelectAll} />
                  </th>
                  <th className="px-3 py-2 text-left">Задача</th>
                  <th className="px-3 py-2 text-left">Период</th>
                  <th className="px-3 py-2 text-left">Статус</th>
                  <th className="px-3 py-2 text-left">Проект</th>
                  <th className="px-3 py-2 text-left">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={selected.includes(task.id)} onChange={() => toggleSelection(task.id)} />
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-slate-800">{task.title}</p>
                      <p className="text-xs text-slate-500">{task.description?.slice(0, 80)}</p>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{formatTaskRange(task)}</td>
                    <td className="px-3 py-2 text-slate-600">{task.status || "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{task.project?.title || "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="date"
                          className="rounded-xl border border-slate-200 px-2 py-1 text-xs"
                          onChange={async (event) => {
                            const value = event.target.value;
                            if (value) {
                              await onAssignDate?.([task.id], value);
                              event.target.value = "";
                            }
                          }}
                        />
                        <button
                          onClick={() => onClearDate?.([task.id])}
                          className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          Без даты
                        </button>
                        <select
                          className="rounded-xl border border-slate-200 px-2 py-1 text-xs"
                          value=""
                          onChange={async (event) => {
                            const value = event.target.value;
                            await onMoveToProject?.([task.id], value ? Number(value) : null);
                          }}
                        >
                          <option value="">Проект</option>
                          <option value="">Без проекта</option>
                          {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tasks.length === 0 && <p className="p-4 text-center text-sm text-slate-500">Список задач пуст.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectOverviewModal({
  visible,
  onClose,
  stats,
  projects = [],
  tasks = [],
  onOpenProject,
  onRename,
  onArchive,
  onRestore,
  onDelete,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  useEffect(() => {
    if (!visible) {
      setEditingId(null);
      setEditingTitle("");
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const handleKey = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [visible, onClose]);

  const summaries = useMemo(() => {
    const map = new Map();
    tasks.forEach((task) => {
      if (!task.project_id) return;
      if (!map.has(task.project_id)) {
        map.set(task.project_id, { total: 0, planned: 0, unscheduled: 0, completed: 0 });
      }
      const entry = map.get(task.project_id);
      entry.total += 1;
      if (task.start_at || task.end_at) {
        entry.planned += 1;
      } else {
        entry.unscheduled += 1;
      }
      if (task.status === "completed") {
        entry.completed += 1;
      }
    });
    return projects.map((project) => ({
      project,
      counts: map.get(project.id) || { total: 0, planned: 0, unscheduled: 0, completed: 0 },
    }));
  }, [projects, tasks]);

  const startRename = (project) => {
    setEditingId(project.id);
    setEditingTitle(project.title || "");
  };

  const submitRename = async () => {
    if (!editingId || !editingTitle.trim()) return;
    await onRename?.(editingId, { title: editingTitle.trim() });
    setEditingId(null);
    setEditingTitle("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex w-full max-w-5xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Обзор проектов</h2>
            <p className="text-sm text-slate-500">Статистика и управление</p>
          </div>
          <button onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
            ×
          </button>
        </div>
        <div className="px-6 py-4 space-y-4 overflow-y-auto max-h-[70vh]">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Всего проектов</p>
              <p className="mt-2 text-2xl font-semibold text-slate-800">{stats.total}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Активные</p>
              <p className="mt-2 text-2xl font-semibold text-slate-800">{stats.active}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Архив</p>
              <p className="mt-2 text-2xl font-semibold text-slate-800">{stats.archived}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left">Проект</th>
                  <th className="px-3 py-2 text-left">Статус</th>
                  <th className="px-3 py-2 text-left">Задачи</th>
                  <th className="px-3 py-2 text-left">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaries.map(({ project, counts }) => {
                  const isArchived = Boolean(project.archived_at);
                  const isEditing = editingId === project.id;
                  return (
                    <tr key={project.id}>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              value={editingTitle}
                              onChange={(event) => setEditingTitle(event.target.value)}
                              className="flex-1 rounded-xl border border-slate-200 px-3 py-1 text-sm"
                            />
                            <button
                              onClick={submitRename}
                              className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white"
                              disabled={!editingTitle.trim()}
                            >
                              Сохранить
                            </button>
                            <button onClick={() => setEditingId(null)} className="rounded-full border border-slate-200 px-3 py-1 text-xs">
                              Отмена
                            </button>
                          </div>
                        ) : (
                          <p className="font-semibold text-slate-800">{project.title}</p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{isArchived ? "Архив" : "Активен"}</td>
                      <td className="px-3 py-2 text-slate-600">
                        <span className="mr-3">Всего: {counts.total}</span>
                        <span className="mr-3">Запланировано: {counts.planned}</span>
                        <span className="mr-3">Без даты: {counts.unscheduled}</span>
                        <span>Выполнено: {counts.completed}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => {
                              onOpenProject?.(project.id);
                              onClose?.();
                            }}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                          >
                            Открыть
                          </button>
                          {!isEditing && (
                            <button
                              onClick={() => startRename(project)}
                              className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                            >
                              Переименовать
                            </button>
                          )}
                          {isArchived ? (
                            <button
                              onClick={() => onRestore?.(project.id)}
                              className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                            >
                              Разархивировать
                            </button>
                          ) : (
                            <button
                              onClick={() => onArchive?.(project.id)}
                              className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                            >
                              Архивировать
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (window.confirm("Удалить проект?")) {
                                onDelete?.(project.id);
                              }
                            }}
                            className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-600 hover:bg-rose-50"
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {projects.length === 0 && <p className="p-4 text-center text-sm text-slate-500">Нет проектов для отображения.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateTaskModal({
  visible,
  onClose,
  onSubmit,
  title,
  setTitle,
  date,
  setDate,
  projectId,
  setProjectId,
  projects = [],
  saving,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const handleKey = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [visible, onClose]);

  if (!visible) {
    return null;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">Создать задачу</h3>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
            ×
          </button>
        </div>
        <input
          ref={inputRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Название задачи"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
        />
        <label className="flex flex-col gap-1 text-sm text-slate-600">
          Дата
          <input
            type="date"
            value={date || ""}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-600">
          Проект
          <select
            value={projectId || ""}
            onChange={(event) => setProjectId(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2"
          >
            <option value="">Без проекта</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">
            Отмена
          </button>
          <button
            type="submit"
            disabled={!title.trim() || !date || saving}
            className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Создать
          </button>
        </div>
      </form>
    </div>
  );
}

function useBarGestures({ onPreviewSchedule, onCommitSchedule, setDraggingTaskId, throttleMs = 24 }) {
  const throttledPreview = useThrottledPreview(onPreviewSchedule, throttleMs);

  return useCallback(
    (config) => (event) => {
      if (!config?.task) {
        return;
      }
      if (event.button !== undefined && event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const initialSchedule = snapshotSchedule(config.task);
      const meta = config.getMeta ? config.getMeta(event) : {};
      if (meta.pointerStartX == null) {
        meta.pointerStartX = event.clientX;
      }
      if (meta.pointerStartY == null) {
        meta.pointerStartY = event.clientY;
      }
      meta.initialSchedule = initialSchedule;
      let latestSchedule = null;
      setDraggingTaskId?.(config.task.id);

      const handleMove = (moveEvent) => {
        moveEvent.preventDefault();
        const nextSchedule = config.computeSchedule?.(moveEvent, meta);
        if (!nextSchedule) {
          return;
        }
        latestSchedule = nextSchedule;
        throttledPreview(config.task.id, nextSchedule);
      };

      const finish = () => {
        cleanup();
        if (!latestSchedule || schedulesEqual(latestSchedule, initialSchedule)) {
          throttledPreview(config.task.id, initialSchedule);
          return;
        }
        const message = config.describeMessage
          ? config.describeMessage(config.task.title, latestSchedule, meta)
          : describeDateRange(config.task.title, latestSchedule);
        onCommitSchedule?.(config.task.id, latestSchedule, initialSchedule, message);
      };

      const cancel = () => {
        cleanup();
        throttledPreview(config.task.id, initialSchedule);
        config.onCancel?.(meta);
      };

      const cleanup = () => {
        setDraggingTaskId?.((current) => (current === config.task.id ? null : current));
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", cancel);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", cancel);
    },
    [onCommitSchedule, setDraggingTaskId, throttledPreview]
  );
}

function useThrottledPreview(callback, throttleMs = 16) {
  const frameRef = useRef(null);
  const latestArgsRef = useRef(null);
  const lastCallRef = useRef(0);

  useEffect(
    () => () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    },
    []
  );

  return useCallback(
    (taskId, schedule) => {
      if (!callback || !taskId || !schedule) {
        return;
      }
      latestArgsRef.current = { taskId, schedule };
      const now = performance.now();
      if (now - lastCallRef.current >= throttleMs) {
        lastCallRef.current = now;
        callback(taskId, schedule);
        return;
      }
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = requestAnimationFrame(() => {
        if (!latestArgsRef.current) {
          return;
        }
        lastCallRef.current = performance.now();
        callback(latestArgsRef.current.taskId, latestArgsRef.current.schedule);
        frameRef.current = null;
      });
    },
    [callback, throttleMs]
  );
}

function TaskDrawer({ task, visible, onClose, onEdit, onStatusChange, statusOptions = [] }) {
  if (!task && !visible) {
    return null;
  }
  const projectMeta = describeProject(task.project);
  const deadlineMeta = formatDeadline(task.end_at);

  const overlay = (
    <>
      <div
        className={`fixed inset-0 z-[90] bg-slate-900/30 backdrop-blur-sm transition-opacity duration-200 ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
        role="presentation"
      />
      <aside
        className={`fixed inset-y-0 right-0 z-[100] flex w-full max-w-[420px] flex-col border-l border-slate-200 bg-white shadow-2xl shadow-slate-900/10 transition-transform duration-300 ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Обзор задачи</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">{task.title}</h3>
            <p className="text-sm text-slate-500">
              {projectMeta.label} • {deadlineMeta.text}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm text-slate-600">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Описание</p>
            <p className="mt-2 text-slate-700">{task.description || "Описание отсутствует"}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DrawerField label="Проект" value={projectMeta.label} />
            <DrawerField label="Приоритет" value={task.priority || "—"} />
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Статус</p>
              <select
                value={task.status || "todo"}
                onChange={(event) => onStatusChange?.(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <DrawerField label="Дедлайн" value={deadlineMeta.text} />
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Участники</p>
            <div className="mt-3 flex -space-x-2">
              {(task.assignees || task.members || []).slice(0, 3).map((member) => (
                <span key={member.id || member.email || member} className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 text-xs font-semibold text-white shadow">
                  {(member.name || member.email || "?").slice(0, 2).toUpperCase()}
                </span>
              ))}
              {((task.assignees || task.members || []).length || 0) > 3 && (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                  +{(task.assignees || task.members || []).length - 3}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-4">
          <button onClick={onEdit} className="flex-1 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 shadow hover:bg-indigo-100">
            Редактировать
          </button>
          <button onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow hover:bg-slate-50">
            Скрыть
          </button>
        </div>
      </aside>
    </>
  );

  if (typeof document === "undefined") {
    return overlay;
  }
  return createPortal(overlay, document.body);
}

function DrawerField({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function Toast({ message, onUndo, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose?.();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-700 shadow-2xl">
      <span>{message}</span>
      {onUndo && (
        <button onClick={onUndo} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50">
          Отменить
        </button>
      )}
      <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
        ×
      </button>
    </div>
  );
}

function startOfWeek(date) {
  const copy = startOfDay(date);
  const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day);
  return copy;
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return startOfDay(copy);
}

function addMinutes(date, minutes) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() + minutes);
  return copy;
}

function buildMonthMatrix(date) {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = startOfWeek(firstOfMonth);
  return Array.from({ length: 42 }, (_, idx) => addDays(start, idx));
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toISODate(key) {
  return new Date(`${key}T00:00:00Z`).toISOString();
}

function formatDateLabel(isoString) {
  if (!isoString) {
    return "";
  }
  const date = new Date(isoString);
  return date.toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTaskRange(task) {
  if (!task?.start_at && !task?.end_at) {
    return "—";
  }
  const startLabel = task.start_at ? formatDateLabel(task.start_at) : "—";
  if (!task.end_at || task.end_at === task.start_at) {
    return startLabel;
  }
  return `${startLabel} — ${formatDateLabel(task.end_at)}`;
}

function priorityWeight(priority) {
  switch (priority) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function snapshotSchedule(task) {
  if (!task) return null;
  return {
    start_at: task.start_at ?? null,
    end_at: task.end_at ?? null,
    all_day: Boolean(task.all_day),
  };
}

function normalizeScheduleInput(schedule, timeZone = "UTC") {
  if (!schedule) {
    return { start_at: null, end_at: null, all_day: false };
  }
  const normalized = {
    start_at: schedule.start_at ?? null,
    end_at: schedule.end_at ?? null,
    all_day: Boolean(schedule.all_day),
  };
  if (normalized.all_day) {
    return normalizeAllDayRange(normalized, timeZone);
  }
  return normalized;
}

function schedulesEqual(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    (a.start_at || null) === (b.start_at || null) &&
    (a.end_at || null) === (b.end_at || null) &&
    Boolean(a.all_day) === Boolean(b.all_day)
  );
}

function buildAllDaySchedule(isoString, timeZone = "UTC") {
  if (!isoString) {
    return { start_at: null, end_at: null, all_day: true };
  }
  return normalizeAllDayRange({ start_at: isoString, end_at: isoString, all_day: true }, timeZone);
}

function getTaskTint(task, mode = "tasks") {
  const seed = mode === "projects" ? task.project?.id ?? task.project_id ?? task.id : task.id ?? task.project?.id ?? task.project_id ?? 0;
  const colors = TASK_GRADIENTS[Math.abs(hash(seed)) % TASK_GRADIENTS.length];
  return {
    gradient: `linear-gradient(125deg, ${colors[0]}, ${colors[1]})`,
    accent: colors[1],
  };
}

function hash(value) {
  const str = String(value ?? "");
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return h;
}

function computeAllDayBars(tasks, rangeStart, rangeEnd, colorMode) {
  if (!tasks.length) {
    return [];
  }
  const dayWidth = 100 / 7;
  const rangeStartDay = startOfDay(rangeStart);
  const rangeEndExclusive = addDays(startOfDay(rangeEnd), 1);
  const rows = [];

  const normalized = tasks
    .map((task) => {
      if (!task.all_day && !task.start_at && !task.end_at) {
        return null;
      }
      const start = task.start_at ? new Date(task.start_at) : task.end_at ? new Date(task.end_at) : null;
      const end = task.end_at ? new Date(task.end_at) : start ? addDays(start, 1) : null;
      if (!start || !end) {
        return null;
      }
      if (end <= rangeStartDay || start >= rangeEndExclusive) {
        return null;
      }
      const clampedStart = start < rangeStartDay ? rangeStartDay : start;
      const clampedEnd = end > rangeEndExclusive ? rangeEndExclusive : end;
      const startOffset = diffDays(clampedStart, rangeStartDay);
      const endOffset = Math.max(startOffset + 1, diffDays(clampedEnd, rangeStartDay));
      return {
        task,
        startOffset,
        endOffset,
        startDate: start,
        endDate: end,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.startOffset - b.startOffset || a.endOffset - b.endOffset);

  return normalized.map((item) => {
    let rowIndex = 0;
    while (rows[rowIndex] !== undefined && item.startOffset < rows[rowIndex]) {
      rowIndex += 1;
    }
    rows[rowIndex] = item.endOffset;
    const span = Math.max(1, item.endOffset - item.startOffset);
    return {
      task: item.task,
      row: rowIndex,
      left: item.startOffset * dayWidth,
      width: span * dayWidth,
      tint: getTaskTint(item.task, colorMode),
      startDate: item.startDate,
      endDate: item.endDate,
    };
  });
}

function computeMonthBars(tasks, days, colorMode) {
  if (!tasks.length || !days.length) {
    return [];
  }
  const start = startOfDay(days[0]);
  const end = endOfDay(days[days.length - 1]);
  const totalWeeks = Math.ceil(days.length / 7);
  const rowsByWeek = Array.from({ length: totalWeeks }, () => []);
  const bars = [];
  tasks.forEach((task) => {
    if (!task.start_at && !task.end_at) {
      return;
    }
    const taskStart = task.start_at ? new Date(task.start_at) : new Date(task.end_at);
    const taskEnd = task.end_at ? new Date(task.end_at) : taskStart;
    if (taskEnd < start || taskStart > end) {
      return;
    }
    const clampedStart = taskStart < start ? start : taskStart;
    const clampedEnd = taskEnd > end ? end : taskEnd;
    let startIndex = diffDays(clampedStart, start);
    let endIndex = Math.max(startIndex + 1, diffDays(clampedEnd, start));
    startIndex = Math.max(0, Math.min(days.length, startIndex));
    endIndex = Math.max(startIndex + 1, Math.min(days.length, endIndex));
    let cursor = startIndex;
    while (cursor < endIndex) {
      const week = Math.floor(cursor / 7);
      const weekStartIndex = week * 7;
      const weekEndExclusive = weekStartIndex + 7;
      const chunkStart = cursor;
      const chunkEnd = Math.min(endIndex, weekEndExclusive);
      const relStart = chunkStart - weekStartIndex;
      const relEnd = chunkEnd - weekStartIndex;
      const rowRegistry = rowsByWeek[week];
      let rowIndex = 0;
      while (rowRegistry[rowIndex] !== undefined && relStart < rowRegistry[rowIndex]) {
        rowIndex += 1;
      }
      rowRegistry[rowIndex] = relEnd;
      const span = Math.max(1, relEnd - relStart);
      const startDate = addDays(start, chunkStart);
      const endDate = addDays(start, chunkEnd);
      bars.push({
        task,
        week,
        row: rowIndex,
        left: (relStart / 7) * 100,
        width: (span / 7) * 100,
        tint: getTaskTint(task, colorMode),
        startDate,
        endDate,
      });
      cursor = chunkEnd;
    }
  });
  return bars;
}

function buildProjectEntries(projects = [], timeZone = "UTC") {
  if (!projects?.length) {
    return [];
  }
  return projects
    .map((project) => {
      const startSource = project.start_at || project.created_at || project.deadline || new Date().toISOString();
      const endSource = project.deadline || startSource;
      const startDate = new Date(startSource);
      let endDate = new Date(endSource);
      if (!(endDate instanceof Date) || Number.isNaN(endDate.getTime())) {
        endDate = addDays(startDate, 1);
      }
      if (endDate <= startDate) {
        endDate = addDays(startDate, 1);
      }
      const normalized = normalizeAllDayRange({ start_at: startDate.toISOString(), end_at: endDate.toISOString(), all_day: true }, timeZone);
      return {
        ...project,
        id: `project-${project.id}`,
        title: project.title,
        start_at: normalized.start_at,
        end_at: normalized.end_at,
        all_day: true,
        __entryType: ENTRY_TYPES.PROJECT,
        project,
      };
    })
    .filter(Boolean);
}

function buildDayTimeline(tasks) {
  if (!tasks.length) {
    return [];
  }
  const normalized = tasks
    .map((task) => {
      if (!task.start_at) return null;
      const start = new Date(task.start_at);
      const end = task.end_at ? new Date(task.end_at) : new Date(start.getTime() + 60 * 60 * 1000);
      const duration = Math.max(15, (end - start) / (60 * 1000));
      const top = (minutesSinceMidnight(start) / (24 * 60)) * 100;
      const height = (duration / (24 * 60)) * 100;
      return {
        task,
        top,
        height,
        start,
        end,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.top - b.top);

  const columns = [];
  normalized.forEach((item) => {
    let assigned = false;
    for (let idx = 0; idx < columns.length; idx += 1) {
      const last = columns[idx][columns[idx].length - 1];
      if (last.top + last.height <= item.top) {
        columns[idx].push(item);
        item.column = idx;
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      item.column = columns.length;
      columns.push([item]);
    }
  });
  const width = 100 / Math.max(1, columns.length);
  return normalized.map((item) => ({
    ...item,
    left: item.column * width,
    width: width - 4,
    timeLabel: `${item.start.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} — ${item.end.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`,
  }));
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function shiftDateByDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function describeDateRange(taskTitle, schedule) {
  const normalized = normalizeScheduleInput(schedule);
  if (normalized.start_at && normalized.end_at) {
    const start = new Date(normalized.start_at);
    const end = new Date(normalized.end_at);
    if (isSameDay(start, end)) {
      return `${taskTitle} перенесена на ${formatDateLabel(normalized.start_at)}`;
    }
    const startLabel = RANGE_LABEL.format(start);
    const endLabel = RANGE_LABEL.format(end);
    return `${taskTitle} перенесена на ${startLabel} — ${endLabel}`;
  }
  return `${taskTitle} перенесена в «Без даты»`;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isTimedTask(task) {
  return Boolean(task?.start_at && task?.end_at && !task?.all_day);
}

function diffDays(a, b) {
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function chunk(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

function clampAllDayBounds(start, end) {
  const normalizedStart = startOfDay(start);
  let normalizedEnd = startOfDay(end);
  if (normalizedEnd <= normalizedStart) {
    normalizedEnd = addDays(normalizedStart, 1);
  }
  return {
    start: normalizedStart,
    end: normalizedEnd,
  };
}

function selectTasksInRange(tasks, rangeStart, rangeEnd) {
  if (!tasks?.length) {
    return [];
  }
  const startMs = rangeStart.getTime();
  const endMs = rangeEnd.getTime();
  return tasks.filter((task) => {
    const startAt = task.start_at ? new Date(task.start_at).getTime() : null;
    const endAt = task.end_at ? new Date(task.end_at).getTime() : null;
    if (startAt == null && endAt == null) {
      return false;
    }
    const effectiveStart = startAt ?? endAt;
    const effectiveEnd = endAt ?? startAt;
    return effectiveEnd >= startMs && effectiveStart <= endMs;
  });
}

const TZ_FORMATTER_CACHE = new Map();

function getDatePartsInTimeZone(date, timeZone) {
  if (!TZ_FORMATTER_CACHE.has(timeZone)) {
    TZ_FORMATTER_CACHE.set(
      timeZone,
      new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    );
  }
  const formatter = TZ_FORMATTER_CACHE.get(timeZone);
  const parts = formatter.formatToParts(date);
  const select = (type) => {
    const part = parts.find((item) => item.type === type);
    return part ? Number(part.value) : 0;
  };
  return {
    year: select("year"),
    month: select("month"),
    day: select("day"),
  };
}

function startOfDayInTimeZone(date, timeZone = "UTC") {
  const parts = getDatePartsInTimeZone(date, timeZone);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0));
}

function normalizeAllDayRange(schedule, timeZone = "UTC") {
  const startDate = schedule.start_at ? new Date(schedule.start_at) : schedule.end_at ? new Date(schedule.end_at) : null;
  const endDate = schedule.end_at ? new Date(schedule.end_at) : startDate;
  if (!startDate || !endDate) {
    const today = startOfDayInTimeZone(new Date(), timeZone);
    return {
      start_at: today.toISOString(),
      end_at: addDays(today, 1).toISOString(),
      all_day: true,
    };
  }
  const normalizedStart = startOfDayInTimeZone(startDate, timeZone);
  let normalizedEnd = startOfDayInTimeZone(endDate, timeZone);
  if (normalizedEnd <= normalizedStart) {
    normalizedEnd = addDays(normalizedStart, 1);
  }
  return {
    start_at: normalizedStart.toISOString(),
    end_at: normalizedEnd.toISOString(),
    all_day: true,
  };
}
