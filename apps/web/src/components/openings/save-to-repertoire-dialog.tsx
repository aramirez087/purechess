'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import type { RepertoireColorDto, RepertoireDto, RepertoireNodeDto } from '@purechess/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { mergeTrees } from '@/lib/board/merge-trees';
import type { AnalysisNode } from '@/lib/board/analysis-tree';
import {
  createRepertoire,
  getRepertoire,
  listRepertoires,
  updateRepertoire,
} from '@/lib/api/repertoire';
import { cn } from '@/lib/utils';

export interface SaveToRepertoireDialogProps {
  open: boolean;
  onClose: () => void;
  /** The live tree from the lab session (cloned before merge). */
  tree: AnalysisNode;
  /** Suggested repertoire name from the active variation. */
  suggestedName: string;
  onSaved?: (rep: RepertoireDto) => void;
}

export function SaveToRepertoireDialog({
  open,
  onClose,
  tree,
  suggestedName,
  onSaved,
}: SaveToRepertoireDialogProps) {
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ['repertoires'],
    queryFn: listRepertoires,
    enabled: open,
  });

  const [mode, setMode] = useState<'new' | 'merge'>('new');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [name, setName] = useState(suggestedName);
  const [color, setColor] = useState<RepertoireColorDto>('white');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(suggestedName);
      setError(null);
      setMode('new');
      setTargetId(null);
    }
  }, [open, suggestedName]);

  const hasMoves = tree.children.length > 0;

  async function handleSave() {
    if (!hasMoves) {
      setError('Play at least one move before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = structuredClone(tree) as RepertoireNodeDto;
      if (mode === 'new') {
        if (!name.trim()) {
          setError('Give your repertoire a name.');
          setSaving(false);
          return;
        }
        const created = await createRepertoire({
          name: name.trim(),
          color,
          tree: payload,
        });
        queryClient.invalidateQueries({ queryKey: ['repertoires'] });
        onSaved?.(created);
        onClose();
        return;
      }
      if (!targetId) {
        setError('Pick a repertoire to merge into.');
        setSaving(false);
        return;
      }
      const existing = await getRepertoire(targetId);
      const merged = structuredClone(existing.tree) as AnalysisNode;
      mergeTrees(merged, tree);
      const updated = await updateRepertoire(targetId, {
        tree: merged as RepertoireNodeDto,
      });
      queryClient.invalidateQueries({ queryKey: ['repertoires'] });
      onSaved?.(updated);
      onClose();
    } catch {
      setError('Could not save — try again.');
    } finally {
      setSaving(false);
    }
  }

  const repertoires = list.data ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save to repertoire</DialogTitle>
          <DialogDescription>
            Store this line in your personal repertoire — create a new one or merge into an existing
            tree.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('new')}
            className={cn(
              'flex-1 rounded-[8px] border px-3 py-2 text-sm font-medium transition-colors',
              mode === 'new'
                ? 'border-brass/60 bg-brass/10 text-foreground'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            New repertoire
          </button>
          <button
            type="button"
            onClick={() => setMode('merge')}
            disabled={repertoires.length === 0}
            className={cn(
              'flex-1 rounded-[8px] border px-3 py-2 text-sm font-medium transition-colors',
              mode === 'merge'
                ? 'border-brass/60 bg-brass/10 text-foreground'
                : 'border-border text-muted-foreground hover:text-foreground',
              repertoires.length === 0 && 'opacity-50',
            )}
          >
            Merge into existing
          </button>
        </div>

        {mode === 'new' ? (
          <div className="space-y-3">
            <div>
              <Label htmlFor="rep-name">Name</Label>
              <Input
                id="rep-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Italian — Fegatello"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Your color</Label>
              <div className="mt-1.5 flex gap-2">
                {(['white', 'black'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-sm capitalize transition-colors',
                      color === c
                        ? 'border-brass/60 bg-brass/10 text-foreground'
                        : 'border-border text-muted-foreground',
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {repertoires.map((rep) => (
              <button
                key={rep.id}
                type="button"
                onClick={() => setTargetId(rep.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-[8px] border px-3 py-2 text-left text-sm transition-colors',
                  targetId === rep.id
                    ? 'border-brass/60 bg-brass/10'
                    : 'border-border hover:bg-raised',
                )}
              >
                <span className="truncate font-medium">{rep.name}</span>
                <span className="shrink-0 text-xs capitalize text-muted-foreground">{rep.color}</span>
              </button>
            ))}
          </div>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !hasMoves}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" aria-hidden="true" /> Save line
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}