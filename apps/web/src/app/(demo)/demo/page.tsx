'use client';

import { useState } from 'react';
import { Chess } from 'chess.js';
import { useTheme } from 'next-themes';
import { Chessboard, BoardSettingsProvider } from '@/components/board';
import type { MoveIntent } from '@purechess/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { MarketingPage } from '@/components/layout/MarketingPage';
import { formatDuration, formatRelativeTime, clampRatingDelta } from '@/lib/utils';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function ChessboardDemo() {
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(START_FEN);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | undefined>();
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');

  function handleMove(intent: MoveIntent) {
    if (!intent.from || !intent.to) return;
    try {
      const result = chess.move({ from: intent.from, to: intent.to, promotion: intent.promotion ?? 'q' });
      if (result) {
        setFen(chess.fen());
        setLastMove({ from: intent.from, to: intent.to });
      }
    } catch {
      /* illegal move */
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
          onClick={() => { chess.reset(); setFen(START_FEN); setLastMove(undefined); }}
        >
          Reset
        </button>
        <button
          className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
          onClick={() => setOrientation((o) => o === 'white' ? 'black' : 'white')}
        >
          Flip
        </button>
      </div>
      <BoardSettingsProvider>
        <Chessboard
          position={fen}
          orientation={orientation}
          onMove={handleMove}
          lastMove={lastMove as { from: import('@purechess/shared').Square; to: import('@purechess/shared').Square } | undefined}
          className="max-w-[480px]"
        />
      </BoardSettingsProvider>
      <p className="text-xs text-muted-foreground font-mono truncate">{fen}</p>
    </div>
  );
}

export default function DemoPage() {
  const { theme, setTheme } = useTheme();
  const [count, setCount] = useState(0);

  return (
    <AppShell>
      <MarketingPage>
        <div className="space-y-10">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Design System</h1>
            <p className="text-sm text-muted-foreground">Purechess component primitives</p>
          </div>

          <section className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Theme
            </h2>
            <div className="flex gap-2">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <Button
                  key={t}
                  variant={theme === t ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme(t)}
                >
                  {t}
                </Button>
              ))}
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Buttons
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button disabled>Disabled</Button>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Badges
            </h2>
            <div className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Destructive</Badge>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Form
            </h2>
            <div className="max-w-sm space-y-3">
              <div className="space-y-1">
                <Label htmlFor="username">Username</Label>
                <Input id="username" placeholder="purechess_user" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="user@example.com" />
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Cards
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Game summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Rating change</span>
                    <span className="font-mono tabular-nums text-sm text-green-600">+12</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Duration</span>
                    <span className="font-mono tabular-nums text-sm">
                      {formatDuration(342000)}
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Skeleton state</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Avatar
            </h2>
            <div className="flex gap-3">
              <Avatar>
                <AvatarFallback>MK</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>JS</AvatarFallback>
              </Avatar>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Tabs
            </h2>
            <Tabs defaultValue="active">
              <TabsList>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="analysis">Analysis</TabsTrigger>
              </TabsList>
              <TabsContent value="active" className="pt-2 text-sm text-muted-foreground">
                Active games appear here.
              </TabsContent>
              <TabsContent value="completed" className="pt-2 text-sm text-muted-foreground">
                Completed games appear here.
              </TabsContent>
              <TabsContent value="analysis" className="pt-2 text-sm text-muted-foreground">
                Game analysis appears here.
              </TabsContent>
            </Tabs>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Dialog + Dropdown + Toast
            </h2>
            <div className="flex flex-wrap gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">Open dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm resignation</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    Are you sure you want to resign this game?
                  </p>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm">Cancel</Button>
                    <Button variant="destructive" size="sm">Resign</Button>
                  </div>
                </DialogContent>
              </Dialog>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">Open menu</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>Analyze game</DropdownMenuItem>
                  <DropdownMenuItem>Share</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                onClick={() => toast('Move played', { description: 'e4 — King\'s Pawn Opening' })}
              >
                Show toast
              </Button>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Utilities
            </h2>
            <dl className="grid grid-cols-2 gap-2 text-sm max-w-sm">
              <dt className="text-muted-foreground">formatDuration(5400000)</dt>
              <dd className="font-mono tabular-nums">{formatDuration(5400000)}</dd>
              <dt className="text-muted-foreground">formatRelativeTime(now - 2h)</dt>
              <dd className="font-mono">{formatRelativeTime(new Date(Date.now() - 7200000))}</dd>
              <dt className="text-muted-foreground">clampRatingDelta(999)</dt>
              <dd className="font-mono tabular-nums">{clampRatingDelta(999)}</dd>
            </dl>
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Chess Board
            </h2>
            <ChessboardDemo />
          </section>

          <Separator />

          <section className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Clock typography (tabular-nums)
            </h2>
            <div className="space-y-1">
              <p className="font-mono tabular-nums text-4xl font-light tracking-tight">
                {formatDuration(count * 1000)}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setCount((c) => c + 60)}>
                  +1 min
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCount(0)}>
                  Reset
                </Button>
              </div>
            </div>
          </section>
        </div>
      </MarketingPage>
    </AppShell>
  );
}
