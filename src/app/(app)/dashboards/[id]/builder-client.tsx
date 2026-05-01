"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, X, Plus, GripVertical } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SubNavStats } from "../../sub-nav-stats";
import type {
  DashboardWithSteps,
  DashboardStep,
  Palette,
  PaletteItem,
  DatePreset,
} from "@/lib/dashboards/types";

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: "7d", label: "7j" },
  { key: "30d", label: "30j" },
  { key: "90d", label: "90j" },
];

interface PendingStep {
  step_type: "mm_event" | "url_click";
  event_ns?: string;
  redirect_event_id?: string;
}

function stepsToPending(steps: DashboardStep[]): PendingStep[] {
  return steps.map((s) =>
    s.step_type === "mm_event"
      ? { step_type: "mm_event", event_ns: s.event_ns! }
      : { step_type: "url_click", redirect_event_id: s.redirect_event_id! }
  );
}

const STEPS_ZONE_ID = "steps-zone";
const PALETTE_PREFIX = "palette:";

export function BuilderClient({ dashboardId }: { dashboardId: string }) {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardWithSteps | null>(null);
  const [palette, setPalette] = useState<Palette | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeDrag, setActiveDrag] = useState<{
    kind: "palette" | "step";
    label: string;
  } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, pRes] = await Promise.all([
        fetch(`/api/dashboards/${dashboardId}`),
        fetch(`/api/dashboards/palette`),
      ]);
      if (dRes.status === 404) {
        toast.error("Tableau introuvable");
        router.replace("/dashboards");
        return;
      }
      if (!dRes.ok || !pRes.ok) throw new Error("HTTP");
      const dJson = (await dRes.json()) as { dashboard: DashboardWithSteps };
      const pJson = (await pRes.json()) as Palette;
      setDashboard(dJson.dashboard);
      setPalette(pJson);
    } catch {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [dashboardId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(
    (body: Record<string, unknown>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaving(true);
        try {
          const r = await fetch(`/api/dashboards/${dashboardId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
        } catch {
          toast.error("Erreur d'enregistrement");
        } finally {
          setSaving(false);
        }
      }, 500);
    },
    [dashboardId]
  );

  function updateName(name: string) {
    setDashboard((d) => (d ? { ...d, name } : d));
    persist({ name });
  }

  function updatePreset(preset: DatePreset) {
    setDashboard((d) =>
      d
        ? {
            ...d,
            date_preset: preset,
            date_from: preset === "custom" ? d.date_from : null,
            date_to: preset === "custom" ? d.date_to : null,
          }
        : d
    );
    persist({
      date_preset: preset,
      date_from: preset === "custom" ? dashboard?.date_from ?? null : null,
      date_to: preset === "custom" ? dashboard?.date_to ?? null : null,
    });
  }

  function updateCustomDate(field: "date_from" | "date_to", value: string) {
    setDashboard((d) =>
      d ? { ...d, date_preset: "custom", [field]: value || null } : d
    );
    persist({
      date_preset: "custom",
      [field]: value || null,
    });
  }

  function setSteps(updater: (prev: DashboardStep[]) => DashboardStep[]) {
    setDashboard((d) => {
      if (!d) return d;
      const newSteps = updater(d.steps);
      const pending = stepsToPending(newSteps);
      persist({ steps: pending });
      return { ...d, steps: newSteps };
    });
  }

  function addFromPalette(p: PaletteItem) {
    setSteps((prev) => [
      ...prev,
      {
        id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        position: prev.length,
        step_type: p.step_type,
        event_ns: p.step_type === "mm_event" ? p.ref_id : null,
        redirect_event_id: p.step_type === "url_click" ? p.ref_id : null,
      },
    ]);
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  async function deleteDashboard() {
    if (!dashboard) return;
    if (!confirm(`Supprimer définitivement « ${dashboard.name} » ?`)) return;
    const r = await fetch(`/api/dashboards/${dashboardId}`, { method: "DELETE" });
    if (r.ok) {
      toast.success("Supprimé");
      router.push("/dashboards");
    } else {
      toast.error("Erreur");
    }
  }

  const labelLookup = useCallback(
    (s: DashboardStep): string => {
      if (!palette) return "…";
      const refId =
        s.step_type === "mm_event" ? s.event_ns! : s.redirect_event_id!;
      const list =
        s.step_type === "mm_event" ? palette.mmEvents : palette.redirectEvents;
      return list.find((p) => p.ref_id === refId)?.label ?? "(indisponible)";
    },
    [palette]
  );

  function paletteItemFor(refId: string): PaletteItem | null {
    if (!palette) return null;
    return (
      palette.mmEvents.find((p) => p.ref_id === refId) ??
      palette.redirectEvents.find((p) => p.ref_id === refId) ??
      null
    );
  }

  function handleDragStart(e: { active: { id: string | number; data: { current?: unknown } } }) {
    const id = String(e.active.id);
    if (id.startsWith(PALETTE_PREFIX)) {
      const refId = id.slice(PALETTE_PREFIX.length);
      const p = paletteItemFor(refId);
      if (p) setActiveDrag({ kind: "palette", label: p.label });
    } else {
      const step = dashboard?.steps.find((s) => s.id === id);
      if (step) setActiveDrag({ kind: "step", label: labelLookup(step) });
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveDrag(null);
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;

    // Case 1 : drag from palette
    if (activeId.startsWith(PALETTE_PREFIX)) {
      const refId = activeId.slice(PALETTE_PREFIX.length);
      const p = paletteItemFor(refId);
      if (!p) return;
      addFromPalette(p);
      return;
    }

    // Case 2 : reorder existing steps
    if (activeId === overId) return;
    setSteps((prev) => {
      const oldIdx = prev.findIndex((s) => s.id === activeId);
      const newIdx = prev.findIndex((s) => s.id === overId);
      if (oldIdx < 0 || newIdx < 0) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <header className="flex justify-between items-center">
          <SubNavStats />
        </header>
        <p className="text-zinc-500">Chargement…</p>
      </div>
    );
  }
  if (!dashboard || !palette) return null;

  const stepIds = dashboard.steps.map((s) => s.id);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <div className="space-y-4">
        <Toaster richColors position="top-right" />
        <header className="flex justify-between items-center">
          <SubNavStats />
          <div className="flex items-center gap-3">
            {saving && (
              <span className="text-xs text-zinc-500">Enregistrement…</span>
            )}
            <Button variant="outline" onClick={deleteDashboard}>
              <Trash2 className="h-4 w-4 mr-1" /> Supprimer
            </Button>
          </div>
        </header>

        <div className="bg-white border rounded-lg p-4 space-y-3">
          <Input
            value={dashboard.name}
            onChange={(e) => updateName(e.target.value)}
            className="text-lg font-semibold"
            placeholder="Nom du tableau"
          />
          <div className="flex items-end gap-2 flex-wrap">
            {PRESETS.map((p) => (
              <Button
                key={p.key}
                size="sm"
                variant={dashboard.date_preset === p.key ? "default" : "outline"}
                onClick={() => updatePreset(p.key)}
              >
                {p.label}
              </Button>
            ))}
            <span className="text-zinc-400">·</span>
            <div className="space-y-1">
              <Label htmlFor="from" className="text-xs">
                Du
              </Label>
              <Input
                id="from"
                type="date"
                value={dashboard.date_from ?? ""}
                onChange={(e) => updateCustomDate("date_from", e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="to" className="text-xs">
                Au
              </Label>
              <Input
                id="to"
                type="date"
                value={dashboard.date_to ?? ""}
                onChange={(e) => updateCustomDate("date_to", e.target.value)}
                className="w-40"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[240px_1fr_1fr] gap-4">
          <aside className="bg-white border rounded-lg p-3 space-y-4 max-h-[600px] overflow-auto">
            <div>
              <h4 className="text-xs uppercase text-zinc-500 mb-2">
                Custom events MM ({palette.mmEvents.length})
              </h4>
              <ul className="space-y-1">
                {palette.mmEvents.map((p) => (
                  <PaletteRow
                    key={p.ref_id}
                    item={p}
                    onAdd={() => addFromPalette(p)}
                  />
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs uppercase text-zinc-500 mb-2">
                Clics URL ({palette.redirectEvents.length})
              </h4>
              <ul className="space-y-1">
                {palette.redirectEvents.map((p) => (
                  <PaletteRow
                    key={p.ref_id}
                    item={p}
                    onAdd={() => addFromPalette(p)}
                  />
                ))}
              </ul>
            </div>
            {palette.mmEvents.length === 0 &&
              palette.redirectEvents.length === 0 && (
                <p className="text-xs text-zinc-500">
                  Aucun event disponible pour cette école.
                </p>
              )}
          </aside>

          <StepsZone hasSteps={dashboard.steps.length > 0}>
            <SortableContext items={stepIds} strategy={verticalListSortingStrategy}>
              {dashboard.steps.length === 0 ? (
                <p className="text-zinc-500 text-sm py-8 text-center">
                  Glissez un event ici, ou cliquez sur le « + » d&apos;un event.
                </p>
              ) : (
                <ol className="space-y-2">
                  {dashboard.steps.map((s, i) => (
                    <SortableStep
                      key={s.id}
                      step={s}
                      index={i}
                      label={labelLookup(s)}
                      onRemove={() => removeStep(i)}
                    />
                  ))}
                </ol>
              )}
            </SortableContext>
          </StepsZone>

          <section className="bg-white border rounded-lg p-3 min-h-[200px] flex items-center justify-center">
            <p className="text-zinc-400 text-sm">
              La visualisation s&apos;affichera ici quand au moins une étape sera
              ajoutée.
            </p>
          </section>
        </div>
      </div>

      <DragOverlay>
        {activeDrag && (
          <div className="bg-white border rounded shadow px-3 py-2 text-sm">
            {activeDrag.label}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function PaletteRow({
  item,
  onAdd,
}: {
  item: PaletteItem;
  onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${PALETTE_PREFIX}${item.ref_id}`,
  });
  return (
    <li
      ref={setNodeRef}
      className={`flex items-center justify-between gap-2 px-2 py-1 hover:bg-zinc-50 rounded text-sm cursor-grab ${
        isDragging ? "opacity-30" : ""
      }`}
      {...attributes}
      {...listeners}
    >
      <span className="truncate flex-1">{item.label}</span>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        className="text-zinc-400 hover:text-zinc-900 p-1"
        aria-label={`Ajouter ${item.label}`}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function StepsZone({
  hasSteps,
  children,
}: {
  hasSteps: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: STEPS_ZONE_ID });
  return (
    <section
      ref={setNodeRef}
      className={`bg-white border rounded-lg p-3 space-y-2 min-h-[200px] transition-colors ${
        isOver && !hasSteps ? "bg-zinc-50 border-zinc-400" : ""
      }`}
    >
      <h4 className="text-xs uppercase text-zinc-500 mb-2">Étapes du funnel</h4>
      {children}
    </section>
  );
}

function SortableStep({
  step,
  index,
  label,
  onRemove,
}: {
  step: DashboardStep;
  index: number;
  label: string;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-2 bg-zinc-50 rounded border"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-zinc-400 hover:text-zinc-700 -ml-1 p-1"
        aria-label="Réordonner"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-xs text-zinc-400 w-5">{index + 1}.</span>
      <span className="flex-1 truncate text-sm">{label}</span>
      <span className="text-xs text-zinc-400">
        {step.step_type === "mm_event" ? "MM" : "URL"}
      </span>
      <button
        onClick={onRemove}
        className="text-zinc-400 hover:text-red-600 p-1"
        aria-label="Retirer"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
