"use client";

import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2, Pencil, Share2, Lock } from "lucide-react";
import { SubNavStats } from "../sub-nav-stats";
import { CampaignEditorDialog } from "./campaign-editor-dialog";
import type { CampaignListItem } from "@/lib/campaigns/types";

export function CampaignsClient() {
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<
    { mode: "new" } | { mode: "edit"; id: string } | null
  >(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/campaigns");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as { campaigns: CampaignListItem[] };
      setCampaigns(j.campaigns ?? []);
    } catch {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function remove(c: CampaignListItem) {
    if (!confirm(`Supprimer la campagne « ${c.name} » ?`)) return;
    const r = await fetch(`/api/campaigns/${c.id}`, { method: "DELETE" });
    if (r.ok) {
      toast.success("Supprimée");
      load();
    } else {
      toast.error("Erreur");
    }
  }

  return (
    <div className="space-y-4">
      <Toaster richColors position="top-right" />
      <header className="flex justify-between items-center">
        <SubNavStats />
        <Button onClick={() => setEditing({ mode: "new" })}>
          + Nouvelle campagne
        </Button>
      </header>

      <h2 className="text-xl font-semibold">Campagnes</h2>
      <p className="text-sm text-zinc-500 -mt-2">
        Une campagne regroupe des events MM et URLs trackées. Sert de filtre
        pour la palette dans « Mes tableaux ».
      </p>

      {loading ? (
        <p className="text-zinc-500">Chargement…</p>
      ) : campaigns.length === 0 ? (
        <p className="text-zinc-500">
          Aucune campagne pour cette école. Cliquez sur « + Nouvelle campagne ».
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {campaigns.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() =>
                    c.can_edit ? setEditing({ mode: "edit", id: c.id }) : null
                  }
                  className="flex-1 min-w-0 text-left hover:underline disabled:cursor-default disabled:no-underline"
                  disabled={!c.can_edit}
                >
                  <h3 className="font-medium truncate">{c.name}</h3>
                  <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1.5">
                    {c.is_shared ? (
                      <>
                        <Share2 className="h-3 w-3" /> Partagée
                      </>
                    ) : (
                      <>
                        <Lock className="h-3 w-3" /> Privée
                      </>
                    )}
                    <span>·</span>
                    <span>
                      modifiée le{" "}
                      {new Date(c.updated_at).toLocaleDateString("fr-FR")}
                    </span>
                  </p>
                </button>
                {c.can_edit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEditing({ mode: "edit", id: c.id })}
                      className="text-zinc-400 hover:text-zinc-900 p-1"
                      aria-label="Éditer"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(c)}
                      className="text-zinc-400 hover:text-red-600 p-1"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <CampaignEditorDialog
          mode={editing.mode}
          campaignId={editing.mode === "edit" ? editing.id : null}
          open
          onOpenChange={(o) => {
            if (!o) {
              setEditing(null);
              load();
            }
          }}
        />
      )}
    </div>
  );
}
