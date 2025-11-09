const STATUS_META = {
  planned: {
    icon: "🗂️",
    tone: "bg-slate-100 text-slate-600",
    tooltip: "Проект в планах",
  },
  active: {
    icon: "🚀",
    tone: "bg-indigo-50 text-indigo-600",
    tooltip: "Проект активен",
  },
  frozen: {
    icon: "🧊",
    tone: "bg-blue-50 text-blue-700",
    tooltip: "Проект заморожен",
  },
  completed: {
    icon: "✅",
    tone: "bg-emerald-50 text-emerald-700",
    tooltip: "Проект завершён",
  },
};

export function describeProject(project) {
  if (!project) {
    return {
      label: "Без проекта",
      icon: null,
      tone: "text-slate-400",
      tooltip: "Задача не привязана к проекту",
    };
  }

  const isArchived = Boolean(project.archived_at);
  const statusMeta = STATUS_META[project.status || "active"];

  if (isArchived) {
    return {
      label: project.title || "Без названия",
      icon: "📦",
      tone: "bg-amber-50 text-amber-700",
      tooltip: "Проект в архиве",
    };
  }

  return {
    label: project.title || "Без названия",
    icon: statusMeta?.icon ?? null,
    tone: statusMeta?.tone ?? "bg-slate-100 text-slate-600",
    tooltip: statusMeta?.tooltip ?? "Проект активен",
  };
}

export function formatDeadline(deadline) {
  if (!deadline) {
    return { text: "Без дедлайна", tone: "text-slate-400" };
  }

  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) {
    return { text: "Недействительная дата", tone: "text-rose-500" };
  }

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dateMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const formatted = date.toLocaleDateString();

  if (dateMidnight < todayMidnight) {
    return { text: `Просрочено · ${formatted}`, tone: "text-rose-600" };
  }
  if (dateMidnight === todayMidnight) {
    return { text: "Сегодня", tone: "text-amber-600" };
  }
  return { text: formatted, tone: "text-slate-600" };
}

export function isProjectOptionDisabled(project) {
  if (!project) {
    return false;
  }
  return Boolean(project.archived_at) || project.status === "frozen";
}
