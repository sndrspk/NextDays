import { useMemo } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import {
  ICS_STALE_MS,
  eventsByDate,
  fetchIcsCalendar,
  loadCachedEvents,
  writeCachedEvents,
  type IcsEvent,
} from "../lib/ics";
import type { IcsCalendarRow, ISODate } from "../types";
import { useIcsCalendars } from "./useIcsCalendars";

export interface ExternalEventsState {
  events: IcsEvent[];
  byDate: Map<ISODate, IcsEvent[]>;
  errors: Array<{ calendarId: string; message: string }>;
  fetchedAt: Map<string, string>;
  isFetching: boolean;
  refresh: () => void;
}

export function useExternalEvents(): ExternalEventsState {
  const calendarsQuery = useIcsCalendars();
  const icsCalendars = calendarsQuery.data ?? [];
  const qc = useQueryClient();

  const queries = useQueries({
    queries: icsCalendars.map((cal) => ({
      queryKey: ["icsCalendar", cal.id, cal.url] as const,
      queryFn: async () => {
        const events = await fetchIcsCalendar(cal);
        writeCachedEvents(cal.id, events);
        return { events, fetchedAt: new Date().toISOString() };
      },
      initialData: () => {
        const cached = loadCachedEvents(cal.id);
        if (!cached) return undefined;
        return { events: cached.events, fetchedAt: cached.fetchedAt };
      },
      initialDataUpdatedAt: () => {
        const cached = loadCachedEvents(cal.id);
        return cached ? new Date(cached.fetchedAt).getTime() : 0;
      },
      staleTime: ICS_STALE_MS,
      refetchOnWindowFocus: false,
      retry: 1,
    })),
  });

  return useMemo<ExternalEventsState>(() => {
    const events: IcsEvent[] = [];
    const errors: Array<{ calendarId: string; message: string }> = [];
    const fetchedAt = new Map<string, string>();
    let isFetching = false;

    queries.forEach((q, i) => {
      const cal: IcsCalendarRow | undefined = icsCalendars[i];
      if (!cal) return;
      if (q.isFetching) isFetching = true;
      if (q.error) {
        errors.push({
          calendarId: cal.id,
          message: q.error instanceof Error ? q.error.message : String(q.error),
        });
      }
      if (q.data) {
        events.push(...q.data.events);
        fetchedAt.set(cal.id, q.data.fetchedAt);
      }
    });

    return {
      events,
      byDate: eventsByDate(events),
      errors,
      fetchedAt,
      isFetching,
      refresh: () => {
        qc.invalidateQueries({ queryKey: ["icsCalendar"] });
      },
    };
    // queries is rebuilt every render; depending on its content keeps memoised
    // groupings stable while still refreshing when data changes.
  }, [queries.map((q) => `${q.dataUpdatedAt}:${q.errorUpdatedAt}:${q.isFetching}`).join("|"), icsCalendars, qc]);
}
