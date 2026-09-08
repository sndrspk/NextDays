import { safeHref } from "../../lib/extractUrl";
import LinkIcon from "./LinkIcon";

interface TaskLinkProps {
  url: string | null;
  /** Mutes the glyph on completed rows. */
  completed?: boolean;
  /**
   * Renders the glyph without a link. Used by the project view's Select mode,
   * where a row click toggles selection — opening a URL mid-selection would be
   * a surprise.
   */
  inert?: boolean;
}

/**
 * The link glyph shown after a task's title wherever tasks are listed
 * (Calendar, Focus, tag view, project view, search results).
 *
 * Every list row opens the task detail panel on click, so the anchor keeps its
 * own click to itself. Renders nothing when the task has no URL, or when the
 * stored value doesn't survive `safeHref` — a row written by an older client
 * or restored from someone else's backup is not trusted to be http(s).
 */
export default function TaskLink({ url, completed = false, inert = false }: TaskLinkProps) {
  const href = safeHref(url);
  if (!href) return null;

  const shared = "ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded align-middle";

  if (inert) {
    return (
      <span aria-label="Task has a link" title={href} className={`${shared} text-stone-300`}>
        <LinkIcon />
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={href}
      aria-label="Open link"
      onClick={(e) => e.stopPropagation()}
      className={`focus-ring ${shared} transition-colors ${
        completed ? "text-stone-300 hover:text-stone-400" : "text-accent hover:text-accent-700"
      }`}
    >
      <LinkIcon />
    </a>
  );
}
