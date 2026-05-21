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

      // Le dashboard lié à une campagne est toujours créé en type 'funnel'
      // côté API (cf. POST /api/campaigns). Pas de radio dans cette dialog
      // — la décision a été prise de réserver le pie chart à Mes tableaux
      // pour garder l'usage des campagnes simple (suivi de conversion).
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

              <div className="border rounded flex h-[440px]">
                <RefList
                  title={`Custom events MM (${filteredMm.length})`}
                  items={filteredMm}
                  selected={selected}
                  onToggle={toggleRef}
                  searchActive={search.trim().length > 0}
                  className="flex-1 border-r"
                />
                <RefList
                  title={`Clics URL (${filteredUrls.length})`}
                  items={filteredUrls}
                  selected={selected}
                  onToggle={toggleRef}
                  searchActive={search.trim().length > 0}
                  className="flex-1"
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
  searchActive,
  className = "",
}: {
  title: string;
  items: PaletteItem[];
  selected: Map<string, PaletteItem>;
  onToggle: (p: PaletteItem) => void;
  /** Si true, on étale tous les groupes (pas d'accordéon) pour que les
   *  résultats de recherche soient tous visibles. */
  searchActive: boolean;
  className?: string;
}) {
  // Mode EDH : tous les items ont un school_name → on groupe par école
  // pour rendre les 113 events digestes via des accordéons. Mode école
  // précise : pas de chip école → on rend la liste à plat.
  const isMultiSchool = items.some((p) => !!p.school_name);

  // Map<school_slug, { name, items[] }>, ordre d'apparition préservé.
  const groups = new Map<
    string,
    { name: string; items: PaletteItem[] }
  >();
  if (isMultiSchool) {
    for (const p of items) {
      const key = p.school_slug ?? "_";
      const display = p.school_name ?? key;
      const g = groups.get(key);
      if (g) g.items.push(p);
      else groups.set(key, { name: display, items: [p] });
    }
  }

  return (
    <div className={`overflow-auto ${className}`}>
      <h4 className="text-xs uppercase text-zinc-500 px-3 pt-3 pb-1 sticky top-0 bg-white border-b z-10">
        {title}
      </h4>
      {items.length === 0 ? (
        <p className="px-3 py-2 text-xs text-zinc-400">Aucun</p>
      ) : isMultiSchool ? (
        // Accordéon par école : <details> natif. Ouvert par défaut quand
        // une recherche est active, sinon fermé (l'utilisateur déplie ce
        // qui l'intéresse).
        <div>
          {Array.from(groups.values()).map((g) => {
            const groupChecked = g.items.filter((p) => selected.has(p.ref_id))
              .length;
            return (
              <details
                key={g.name}
                open={searchActive || groupChecked > 0}
                className="border-b last:border-b-0"
              >
                <summary className="cursor-pointer select-none px-3 py-1.5 text-xs font-semibold hover:bg-zinc-50 flex items-center gap-2">
                  <span className="text-[10px] font-mono px-1 py-0 rounded bg-amber-100 text-amber-800">
                    {g.name}
                  </span>
                  <span className="text-zinc-600">{g.items.length}</span>
                  {groupChecked > 0 && (
                    <span className="text-zinc-400 ml-auto text-[10px]">
                      {groupChecked} coché{groupChecked > 1 ? "s" : ""}
                    </span>
                  )}
                </summary>
                <ul className="pb-1">
                  {g.items.map((p) => (
                    <RefRow
                      key={p.ref_id}
                      item={p}
                      checked={selected.has(p.ref_id)}
                      onToggle={onToggle}
                      hideSchoolChip
                    />
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      ) : (
        <ul>
          {items.map((p) => (
            <RefRow
              key={p.ref_id}
              item={p}
              checked={selected.has(p.ref_id)}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function RefRow({
  item,
  checked,
  onToggle,
  hideSchoolChip = false,
}: {
  item: PaletteItem;
  checked: boolean;
  onToggle: (p: PaletteItem) => void;
  /** Quand on est déjà sous un accordéon « EFAP », inutile de répéter la
   *  chip école sur chaque ligne. */
  hideSchoolChip?: boolean;
}) {
  return (
    <li>
      <label
        className="flex items-center gap-2 px-3 py-1 hover:bg-zinc-50 cursor-pointer text-sm"
        title={
          item.school_name ? `[${item.school_name}] ${item.label}` : item.label
        }
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(item)}
          className="shrink-0"
        />
        {!hideSchoolChip && item.school_name && (
          <span className="text-[10px] font-mono px-1 py-0 rounded bg-amber-100 text-amber-800 shrink-0">
            {item.school_name}
          </span>
        )}
        <span className="truncate flex-1">{item.label}</span>
      </label>
    </li>
  );
}
