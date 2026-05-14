import type { IcsEvent } from "../../lib/ics";
import { formatEventTime, tintBackground } from "../../lib/ics";

interface EventCardProps {
  event: IcsEvent;
  colour: string;
}

export default function EventCard({ event, colour }: EventCardProps) {
  const time = formatEventTime(event);
  return (
    <li
      className="flex items-baseline gap-1.5 rounded-md px-2 py-1 text-[12px] leading-snug"
      style={{
        backgroundColor: tintBackground(colour),
        borderLeft: `3px solid ${colour}`,
      }}
      title={event.location ? `${event.title} — ${event.location}` : event.title}
    >
      {time && (
        <span
          className="font-mono text-[11px] font-medium"
          style={{ color: colour }}
        >
          {time}
        </span>
      )}
      <span className="flex-1 truncate text-stone-700">{event.title}</span>
    </li>
  );
}
