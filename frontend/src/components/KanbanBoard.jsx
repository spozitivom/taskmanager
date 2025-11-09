import React from "react";
import TaskCard from "./TaskCard";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import * as api from "../api";

const columns = [
  {
    id: "todo",
    label: "В планах",
    description: "Свежие идеи и входящие задачи",
    badgeTone: "bg-slate-100 text-slate-600",
  },
  {
    id: "in_progress",
    label: "В работе",
    description: "Задачи, над которыми идет работа",
    badgeTone: "bg-indigo-100 text-indigo-600",
  },
  {
    id: "completed",
    label: "Готово",
    description: "Завершённые задачи и результаты",
    badgeTone: "bg-emerald-100 text-emerald-600",
  },
];

export default function KanbanBoard({ tasks, setTasks, onEditTask }) {

  // --- Обработчик завершения перетаскивания ---
  const onDragEnd = async (result) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    // --- Если поменяли столбец ---
    if (source.droppableId !== destination.droppableId) {
      const updatedTasks = tasks.map((t) =>
        t.id.toString() === draggableId
          ? {
              ...t,
              status: destination.droppableId,
              stage: destination.droppableId,
            }
          : t
      );
      setTasks(updatedTasks);

      try {
        await api.updateTask(draggableId, {
          status: destination.droppableId,
          stage: destination.droppableId,
        });
      } catch (err) {
        console.error("Ошибка при обновлении стадии:", err);
      }
    } else {
      // --- Если меняем порядок внутри одной колонки ---
      const columnTasks = tasks.filter((t) => t.status === source.droppableId);
      const [moved] = columnTasks.splice(source.index, 1);
      columnTasks.splice(destination.index, 0, moved);

      // Собираем новый список задач
      const reordered = [
        ...tasks.filter((t) => t.status !== source.droppableId),
        ...columnTasks,
      ];

      setTasks(reordered);
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {columns.map((column) => {
          const columnTasks = tasks.filter((t) => t.status === column.id);
          return (
            <Droppable droppableId={column.id} key={column.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-100 flex flex-col transition-all ${
                    snapshot.isDraggingOver ? "ring-2 ring-indigo-100" : ""
                  }`}
                >
                  <header className="p-5 border-b border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-base font-semibold text-slate-800">
                        {column.label}
                      </h2>
                      <span
                        className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium ${column.badgeTone}`}
                      >
                        {columnTasks.length}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{column.description}</p>
                  </header>

                  <div
                    className={`flex-1 p-4 space-y-3 overflow-y-auto min-h-[360px] ${
                      snapshot.isDraggingOver ? "bg-indigo-50/50" : "bg-slate-50/40"
                    }`}
                  >
                    {columnTasks.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-4 text-center text-xs text-slate-400">
                        Перетащите задачу сюда
                      </div>
                    )}

                    {columnTasks.map((task, index) => (
                      <Draggable
                        key={task.id.toString()}
                        draggableId={task.id.toString()}
                        index={index}
                      >
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            style={dragProvided.draggableProps.style}
                            className={`transition-transform ${
                              dragSnapshot.isDragging ? "scale-[1.01]" : ""
                            }`}
                          >
                            <TaskCard
                              task={task}
                              setTasks={setTasks}
                              onEditTask={onEditTask}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}
