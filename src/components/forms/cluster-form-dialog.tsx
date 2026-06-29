"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCluster, updateCluster } from "@/server/actions/cluster";

interface Cluster {
  id: string;
  name: string;
  description: string | null;
}

interface ClusterFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cluster?: Cluster | null;
}

export function ClusterFormDialog({ open, onOpenChange, cluster }: ClusterFormDialogProps) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = cluster ? await updateCluster(cluster.id, formData) : await createCluster(formData);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(cluster ? "Cluster updated" : "Cluster created");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{cluster ? "Edit Cluster" : "Create Cluster"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cluster-name">Cluster Name</Label>
            <Input id="cluster-name" name="name" defaultValue={cluster?.name ?? ""} placeholder="e.g. Cluster-1" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cluster-desc">Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea id="cluster-desc" name="description" defaultValue={cluster?.description ?? ""} placeholder="Team focus, region, or other details..." rows={2} />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving..." : cluster ? "Save Changes" : "Create Cluster"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
