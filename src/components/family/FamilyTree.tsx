import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonNode } from "./PersonNode";
import { buildTree } from "@/lib/tree-layout";
import type { Person, Relationship } from "@/lib/family-data";

const nodeTypes = { person: PersonNode };

export function FamilyTree({
  persons,
  relationships,
  onSelect,
  onOpen,
  highlightId,
  relatedIds,
}: {
  persons: Person[];
  relationships: Relationship[];
  onSelect: (id: string) => void;
  onOpen?: (id: string) => void;
  highlightId?: string | null;
  relatedIds?: Set<string>;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const { nodes, edges, hasChildrenOf } = useMemo(
    () => buildTree(persons, relationships, collapsed),
    [persons, relationships, collapsed],
  );

  const styledNodes = useMemo<Node[]>(
    () =>
      nodes.map((n) => {
        const base: Node = {
          ...n,
          data: {
            ...n.data,
            hasChildren: hasChildrenOf.has(n.id),
            collapsed: collapsed.has(n.id),
            onToggleCollapse: toggleCollapse,
          },
        };
        if (n.id === highlightId) {
          return {
            ...base,
            style: { ...n.style, outline: "3px solid hsl(45 95% 55%)", borderRadius: 12 },
          };
        }
        if (relatedIds?.has(n.id)) {
          return {
            ...base,
            style: { ...n.style, outline: "2px solid hsl(160 70% 45%)", borderRadius: 12 },
          };
        }
        return base;
      }),
    [nodes, hasChildrenOf, collapsed, toggleCollapse, highlightId, relatedIds],
  );

  useEffect(() => {
    setIsLoading(true);

    const frame = window.requestAnimationFrame(() => {
      if (styledNodes.length > 0) {
        window.setTimeout(() => setIsLoading(false), 900);
      } else {
        window.setTimeout(() => setIsLoading(false), 1200);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [persons, relationships, styledNodes.length]);

  const [rfKey] = useState(() => Math.random());
  const showSkeleton = isLoading;

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-lg border bg-background/80">
      {showSkeleton && (
        <div className="absolute inset-0 z-10 flex flex-col justify-center gap-4 overflow-hidden bg-background/90 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-center gap-3">
            <Skeleton className="relative h-12 w-24 overflow-hidden rounded-full">
              <div className="absolute inset-0 animate-[shimmer_0.8s_linear_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            </Skeleton>
            <Skeleton className="relative h-12 w-24 overflow-hidden rounded-full">
              <div className="absolute inset-0 animate-[shimmer_0.8s_linear_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            </Skeleton>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Skeleton className="relative h-20 w-24 overflow-hidden rounded-2xl">
              <div className="absolute inset-0 animate-[shimmer_0.8s_linear_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            </Skeleton>
            <Skeleton className="relative h-20 w-24 overflow-hidden rounded-2xl">
              <div className="absolute inset-0 animate-[shimmer_0.8s_linear_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            </Skeleton>
            <Skeleton className="relative h-20 w-24 overflow-hidden rounded-2xl">
              <div className="absolute inset-0 animate-[shimmer_0.8s_linear_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            </Skeleton>
          </div>
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
            <Skeleton className="relative h-16 w-24 overflow-hidden rounded-2xl">
              <div className="absolute inset-0 animate-[shimmer_0.8s_linear_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            </Skeleton>
            <Skeleton className="relative h-16 w-24 overflow-hidden rounded-2xl">
              <div className="absolute inset-0 animate-[shimmer_0.8s_linear_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            </Skeleton>
            <Skeleton className="relative h-16 w-24 overflow-hidden rounded-2xl">
              <div className="absolute inset-0 animate-[shimmer_0.8s_linear_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            </Skeleton>
          </div>
        </div>
      )}

      <ReactFlow
        key={rfKey}
        nodes={styledNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onSelect(node.id)}
        onNodeDoubleClick={(_, node) => onOpen?.(node.id)}
        fitView
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="h-full w-full"
        style={{ width: "100%", height: "100%" }}
      >
        <Background gap={20} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
