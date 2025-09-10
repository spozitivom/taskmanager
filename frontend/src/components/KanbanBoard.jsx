// KanbanBoard.jsx
// Kanban-доска с drag&drop и корректной обработкой порядка

import React from "react";
import TaskCard from "./TaskCard";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import * as api from "../api";

export default function KanbanBoard({ tasks, setTasks }) {
  const stages = ["todo", "in_progress", "done"];

  // --- Обработчик завершения перетаскивания ---
  const onDragEnd = async (result) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    // --- Если поменяли столбец ---
    if (source.droppableId !== destination.droppableId) {
      const updatedTasks = tasks.map((t) =>
        t.id.toString() === draggableId
          ? { ...t, stage: destination.droppableId }
          : t
      );
      setTasks(updatedTasks);

      try {
        await api.updateTask(draggableId, {
          stage: destination.droppableId,
        });
      } catch (err) {
        console.error("Ошибка при обновлении стадии:", err);
      }
    } else {
      // --- Если меняем порядок внутри одной колонки ---
      const columnTasks = tasks.filter((t) => t.stage === source.droppableId);
      const [moved] = columnTasks.splice(source.index, 1);
      columnTasks.splice(destination.index, 0, moved);

      // Собираем новый список задач
      const reordered = [
        ...tasks.filter((t) => t.stage !== source.droppableId),
        ...columnTasks,
      ];

      setTasks(reordered);
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-3 gap-4">
        {stages.map((stage) => (
          <Droppable droppableId={stage} key={stage}>
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="bg-gray-100 rounded-lg p-4 min-h-[400px]"
              >
                <h2 className="font-bold text-lg mb-3 capitalize">
                  {stage.replace("_", " ")}
                </h2>

                {tasks
                  .filter((t) => t.stage === stage)
                  .map((task, index) => (
                    <Draggable
                      key={task.id.toString()}
                      draggableId={task.id.toString()}
                      index={index}
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          style={provided.draggableProps.style}
                        >
                          <TaskCard task={task} setTasks={setTasks} />
                        </div>
                      )}
                    </Draggable>
                  ))}

                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
}
