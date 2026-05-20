"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Palette, PaletteItem } from "@/lib/dashboards/types";
import type { CampaignWithRefs } from "@/lib/campaigns/types";
import { paletteKeyOf } from "@/lib/campaigns/utils";

interface Props {
  mode: "new" | "edit";
  campaignId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Appelé après une création réussie (mode="new"), avec l'id de la
   *  nouvelle campagne. Permet au parent de rediriger vers
   *  `/campaigns/[id]` pour éditer le tableau lié. */
  onCreated?: (id: string) => void;
}

export function CampaignEditorDialog({
  mode,
  campaignId,
  open,
  onOpenChange,
  onCreated,
}: Props) {
  const [name, setName] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [palette, setPalette] = useState<Palette | null>(null);
  /** Map<paletteKey, PaletteItem> : porte tout le contexte nécessaire
   *  au moment du save (step_type + event_school_slug). */
  const [selected, setSelected] = useState<Map<string, PaletteItem>>(new Map());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load palette + campaign (si edit) au montage
  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const pRes = await fetch("/api/dashboards/palette");
        if (!pRes.ok) throw new Error("palette");
        const pJson = (await pRes.json()) as Palette;
        if (!alive) return;
        setPalette(pJson);

        if (mode === "edit" && campaignId) {
          const cRes = await fetch(`/api/campaigns/${campaignId}`);
          if (!cRes.ok) throw new Error("campaign");
          const { campaign } = (await cRes.json()) as {
            campaign: CampaignWithRefs;
          };
          if (!alive) return;
          setName(campaign.name);
          setIsShared(campaign.is_shared);
          // Rebuild Map<paletteKey, PaletteItem> à partir des refs + palette
          const byKey = new Map<string, PaletteItem>();
          const allItems = [...pJson.mmEvents, ...pJson.redirectEvents];
          const itemByKey = new Map(allItems.map((i) => [i.ref_id, i]));
          for (const r of campaign.refs) {
            const key = paletteKeyOf(r);
            const item = itemByKey.get(key);
            if (item) byKey.set(key, item);
          }
          setSelected(byKey);
        } else {
          setName("");
          setIsShared(false);
          setSelected(new Map());
        }
      } catch {
        toast.error("Erreur de chargement");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [mode, campaignId]);

  function toggleRef(item: PaletteItem) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.ref_id)) next.delete(item.ref_id);
      else next.set(item.ref_id, item);
      return next;
    });
  }

  function filterItems(list: PaletteItem[]): PaletteItem[] {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        (i.school_name ?? "").toLowerCase().includes(q)
    );
  }

  const filteredMm = useMemo(
    () => (palette ? filterItems(palette.mmEvents) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [palette, search]
  );
  const filteredUrls = useMemo(
    () => (palette ? filterItems(palette.redirectEvents) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [palette, search]
  );

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const refs = Array.from(selected.values()).map((p) => {
        if (p.step_type === "mm_event") {
          // En EDH ref_id = "<school>:<event_ns>" → on split.
          const eventNs = p.school_slug
            ? p.ref_id.slice(p.school_slug.length + 1)
            : p.ref_id;
          return {
            step_type: "mm_event" as const,
            event_ns: eventNs,
            ...(p.school_slug ? { event_school_slug: p.school_slug } : {}),
          };
        }
        return {
          step_type: "url_click" as const,
          redirect_event_id: p.ref_id,
        };
      });

      const body = JSON.stringify({
        name: trimmed,
        is_shared: isShared,
        refs,
      });

      if (mode === "new") {
        const r = await fetch("/api/campaigns", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const { id } = (await r.json()) as { id: string };
        toast.success("Campagne créée");
        onCreated?.(id);
      } else if (campaignId) {
        const r = await fetch(`/api/campaigns/${campaignId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body,
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        toast.success("Enregistré");
      }
      onOpenChange(false);
    } catch {
      toast.error("Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "new" ? "Nouvelle campagne" : "Éditer la campagne"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-zinc-500 text-sm py-8">Chargement…</p>
        ) : !palette ? (
          <p className="text-red-600 text-sm py-8">Erreur de chargement</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Nom</Label>
              <Input
                id="campaign-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Campagne JPO portes ouvertes mai 2026"
                autoFocus
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                id="campaign-shared"
                type="checkbox"
                checked={isShared}
                onChange={(e) => setIsShared(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="campaign-shared" className="cursor-pointer">
                Partagée avec l&apos;école
              </Label>
              <span className="text-xs text-zinc-500">
                {isShared
                  ? "Visible par tous les utilisateurs de l'école"
                  : "Visible uniquement par vous"}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Briques de la campagne ({selected.size} sélectionnée
                  {selected.size > 1 ? "s" : ""})
                </Label>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  className="w-48 h-8 text-sm"
                />
              </div>

              <div className="border rounded grid grid-cols-2 max-h-[320px] overflow-hidden">
                <RefList
                  title={`Custom events MM (${filteredMm.length})`}
                  items={filteredMm}
                  selected={selected}
                  onToggle={toggleRef}
                />
                <RefList
                  title={`Clics URL (${filteredUrls.length})`}
                  items={filteredUrls}
                  selected={selected}
                  onToggle={toggleRef}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Annuler
          </Button>
          <Button
            onClick={save}
            disabled={saving || loading || !name.trim() || !palette}
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RefList({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: PaletteItem[];
  selected: Map<string, PaletteItem>;
  onToggle: (p: PaletteItem) => void;
}) {
  return (
    <div className="overflow-auto border-r last:border-r-0">
      <h4 className="text-xs uppercase text-zinc-500 px-3 pt-3 pb-1 sticky top-0 bg-white">
        {title}
      </h4>
      {items.length === 0 ? (
        <p className="px-3 py-2 text-xs text-zinc-400">Aucun</p>
      ) : (
        <ul>
          {items.map((p) => {
            const checked = selected.has(p.ref_id);
            return (
              <li key={p.ref_id}>
                <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-50 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(p)}
                    className="shrink-0"
                  />
                  {p.school_name && (
                    <span className="text-[10px] font-mono px-1 py-0 rounded bg-amber-100 text-amber-800 shrink-0">
                      {p.school_name}
                    </span>
                  )}
                  <span className="truncate flex-1">{p.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
