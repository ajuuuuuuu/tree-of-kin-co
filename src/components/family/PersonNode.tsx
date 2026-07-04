import { Handle, Position } from "reactflow";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Person } from "@/lib/family-data";
import { getYear } from "@/lib/tree-layout";

interface NodeData {
  person: Person;
  hasChildren?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: (id: string) => void;
}

export function PersonNode({ data }: { data: NodeData }) {
  const p = data.person;
  const initials = p.name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");
  const accent =
    p.gender === "female"
      ? "border-l-pink-400"
      : p.gender === "male"
        ? "border-l-blue-400"
        : "border-l-gray-400";
  return (
    <div
      className={`group relative flex w-[160px] flex-col items-center rounded-lg border border-l-4 ${accent} bg-card px-3 pb-3 pt-10 shadow-sm transition hover:shadow-md`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
      <Handle type="source" position={Position.Right} id="right" className="!opacity-0" />
      <Handle type="target" position={Position.Left} id="left" className="!opacity-0" />
      <div className="absolute -top-8 left-1/2 -translate-x-1/2">
        {p.photoUrl ? (
          <img
            src={p.photoUrl}
            alt={p.name}
            className="h-16 w-16 rounded-full border-4 border-card object-cover shadow-sm"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-card bg-muted text-base font-semibold text-muted-foreground shadow-sm">
            {initials}
          </div>
        )}
      </div>
      <div className="w-full min-w-0 text-center">
        <div className="truncate text-sm font-semibold text-foreground">{p.name}</div>
        <div className="text-xs text-muted-foreground">
          {getYear(p.birthDate) || "?"} – {getYear(p.deathDate) || ""}
        </div>
      </div>
      {data.hasChildren && data.onToggleCollapse && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            data.onToggleCollapse!(p.id);
          }}
          className="absolute -bottom-3 left-1/2 z-10 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground"
          aria-label={data.collapsed ? "Expand descendants" : "Collapse descendants"}
          title={data.collapsed ? "Expand descendants" : "Collapse descendants"}
        >
          {data.collapsed ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </div>
  );
}
