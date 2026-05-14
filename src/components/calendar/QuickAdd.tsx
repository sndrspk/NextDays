import { useState } from "react";
import type { ISODate } from "../../types";
import { useCreateTask } from "../../hooks/useTaskMutations";
import { useProjects } from "../../hooks/useProjects";
import { parseTaskTitle } from "../../lib/parseTaskTitle";

interface QuickAddProps {
  scheduledDate: ISODate;
}

export default function QuickAdd({ scheduledDate }: QuickAddProps) {
  const [title, setTitle] = useState("");
  const create = useCreateTask();
  const projectsQuery = useProjects();

  function submit() {
    const trimmed = title.trim();
    if (!trimmed || create.isPending) return;
    const parsed = parseTaskTitle(trimmed, projectsQuery.data ?? []);
    if (!parsed.title) return;
    create.mutate(
      {
        title: parsed.title,
        scheduled_date: scheduledDate,
        project_id: parsed.project_id,
        tags: parsed.tags,
      },
      {
        onSuccess: () => setTitle(""),
      },
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="group/quick mt-4 -mx-1 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-slate-50 focus-within:bg-slate-50"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="+ Add task"
        disabled={create.isPending}
        className="w-full bg-transparent text-[13px] text-stone-800 placeholder:text-stone-400 focus:outline-none focus:placeholder:text-stone-300 disabled:opacity-50"
      />
      {create.error && (
        <p className="mt-1 text-[11px] text-red-600">
          Failed: {create.error instanceof Error ? create.error.message : String(create.error)}
        </p>
      )}
    </form>
  );
}
