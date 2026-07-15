"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

/**
 * Création d'un pie chart. Le type de viz est forcé à "pie" : cet onglet
 * ne fait plus QUE des pie charts (les funnels se créent via l'onglet
 * « Funnel » = campagnes). Plus de choix funnel/pie à la création.
 */
export function NewDashboardDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const r = await fetch("/api/dashboards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed, type: "pie", is_shared: isShared }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const { id } = (await r.json()) as { id: string };
      onOpenChange(false);
      setName("");
      setIsShared(false);
      router.push(`/dashboards/${id}`);
    } catch {
      toast.error("Erreur de création");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau pie chart</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom du pie chart</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Répartition des inscriptions par école"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !submitting) submit();
              }}
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              id="dashboard-shared"
              type="checkbox"
              checked={isShared}
              onChange={(e) => setIsShared(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="dashboard-shared" className="cursor-pointer">
              Partagé avec l&apos;école
            </Label>
            <span className="text-xs text-zinc-500">
              {isShared
                ? "Visible par tous les utilisateurs de l'école"
                : "Visible uniquement par vous"}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button onClick={submit} disabled={submitting || !name.trim()}>
            {submitting ? "Création…" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
