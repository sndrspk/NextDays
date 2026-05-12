import { useState } from "react";
import type { ISODate } from "../../types";
import { useCreateTask } from "../../hooks/useTaskMutations";

interface QuickAddProps {
  scheduledDate: ISODate;
}

export default function QuickAdd({ scheduledDate }: QuickAddProps) {
  const [title, setTitle] = useState("");
  const create = useCreateTask();

  function submit() {
    const trimmed = title.trim();
    if (!trimmed || create.isPending) return;
    create.mutate(
      { title: trimmed, scheduled_date: scheduledDate },
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
      className="mt-3"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="+ Add task"
        disabled={create.isPending}
        className="w-full bg-transparent text-sm text-stone-700 placeholder:text-stone-300 focus:outline-none disabled:opacity-50"
      />
      {create.error && (
        <p className="mt-1 text-[11px] text-red-600">Failed: {String(create.error)}</p>
      )}
    </form>
  );
}
