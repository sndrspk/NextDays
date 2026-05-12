import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseConfigured } from "../../lib/supabase";
import type { Task } from "../../types";

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function SmokeScreen() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");

  const tasksQuery = useQuery({
    enabled: supabaseConfigured,
    queryKey: ["smoke-tasks"],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (taskTitle: string) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({ title: taskTitle, scheduled_date: todayISO() })
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => {
      setTitle("");
      qc.invalidateQueries({ queryKey: ["smoke-tasks"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["smoke-tasks"] }),
  });

  return (
    <section className="max-w-xl rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold">Supabase smoke test</h2>
      <p className="mt-1 text-xs text-stone-500">
        Dev-only. Creates, lists, and deletes rows in the <code>tasks</code> table to prove the
        client is wired up. Removed once Milestone 2 begins.
      </p>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) createMutation.mutate(title.trim());
        }}
      >
        <input
          className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
          placeholder="New task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={!supabaseConfigured || createMutation.isPending}
        />
        <button
          type="submit"
          className="rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={!supabaseConfigured || !title.trim() || createMutation.isPending}
        >
          Add
        </button>
      </form>

      {createMutation.error && (
        <p className="mt-2 text-xs text-red-600">Insert failed: {String(createMutation.error)}</p>
      )}
      {tasksQuery.error && (
        <p className="mt-2 text-xs text-red-600">Query failed: {String(tasksQuery.error)}</p>
      )}

      <ul className="mt-4 divide-y divide-stone-100">
        {tasksQuery.isLoading && <li className="py-2 text-sm text-stone-500">Loading…</li>}
        {tasksQuery.data?.length === 0 && (
          <li className="py-2 text-sm text-stone-500">No tasks yet. Add one above.</li>
        )}
        {tasksQuery.data?.map((task) => (
          <li key={task.id} className="flex items-center justify-between py-2 text-sm">
            <span>
              <span className="font-medium">{task.title}</span>
              <span className="ml-2 text-xs text-stone-400">{task.scheduled_date}</span>
            </span>
            <button
              className="text-xs text-stone-500 hover:text-red-600"
              onClick={() => deleteMutation.mutate(task.id)}
            >
              delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
