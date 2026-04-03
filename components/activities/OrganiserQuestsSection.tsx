"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ImagePlus, Plus } from "lucide-react";
import { uploadImage } from "@/lib/uploadImage";
import { QuestVisual } from "@/components/quests/QuestVisual";
import { cn } from "@/lib/utils";

interface OrganiserQuestsSectionProps {
  activityId: Id<"activities">;
}

export function OrganiserQuestsSection({
  activityId,
}: OrganiserQuestsSectionProps) {
  const { getToken } = useAuth();
  const dashboard = useQuery(api.quests.organiserQuestDashboard, { activityId });
  const createQuest = useMutation(api.quests.createManualQuest);
  const markComplete = useMutation(api.quests.markQuestCompleteForUser);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [expAmount, setExpAmount] = useState("50");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageDropActive, setImageDropActive] = useState(false);
  const questImageInputRef = useRef<HTMLInputElement>(null);

  const iconPreviewUrl = useMemo(
    () => (iconFile ? URL.createObjectURL(iconFile) : null),
    [iconFile]
  );

  useEffect(() => {
    return () => {
      if (iconPreviewUrl) URL.revokeObjectURL(iconPreviewUrl);
    };
  }, [iconPreviewUrl]);

  const handleCreate = async () => {
    const xp = Number(expAmount);
    if (!name.trim()) {
      toast.error("Quest name is required");
      return;
    }
    if (!Number.isFinite(xp) || xp < 0) {
      toast.error("Invalid XP");
      return;
    }
    setSaving(true);
    try {
      let iconImageUrl: string | undefined;
      if (iconFile) {
        iconImageUrl = await uploadImage(iconFile, "quest", () =>
          getToken({ template: "convex" })
        );
      }
      await createQuest({
        activityId,
        questName: name.trim(),
        description: description.trim(),
        expAmount: xp,
        iconImageUrl,
      });
      setName("");
      setDescription("");
      setExpAmount("50");
      setIconFile(null);
      toast.success("Quest created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create quest");
    } finally {
      setSaving(false);
    }
  };

  const handleMark = async (
    questId: Id<"quests">,
    userId: Id<"users">,
    already: boolean
  ) => {
    if (already) return;
    try {
      const r = await markComplete({ questId, userId });
      if (r.awarded) {
        toast.success(
          r.levelsGained > 0
            ? `Quest completed — level up! Now level ${r.newLevel}`
            : "Quest marked complete"
        );
      } else {
        toast.message("Already completed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to mark quest");
    }
  };

  const acceptImage = "image/jpeg,image/png,image/webp,image/gif";

  const setQuestImageFromFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    setIconFile(file);
  };

  if (dashboard === undefined) {
    return (
      <Card className="border-border border-2">
        <CardHeader>
          <CardTitle>Manage quests</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-border border-2">
      <CardHeader>
        <CardTitle>Manage quests</CardTitle>
        <CardDescription>
          Create challenges and mark completion for anyone on an active
          reservation. Guests see quests above; remove them there if needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-4 rounded-lg border border-border p-4">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Plus className="size-4" />
            New quest
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="oq-name">Name</Label>
              <Input
                id="oq-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. First to high-five the guide"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="oq-desc">Description</Label>
              <Textarea
                id="oq-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="resize-none"
                placeholder="What should they do?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oq-xp">XP reward</Label>
              <Input
                id="oq-xp"
                type="number"
                min={0}
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Quest image (optional)</Label>
              <input
                ref={questImageInputRef}
                type="file"
                accept={acceptImage}
                className="sr-only"
                onChange={(e) => {
                  setQuestImageFromFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {iconPreviewUrl ? (
                <div className="flex flex-col gap-3 rounded-xl border-2 border-border bg-muted/30 p-4 sm:flex-row sm:items-center">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-background shadow-sm">
                    <Image
                      src={iconPreviewUrl}
                      alt="Quest image preview"
                      fill
                      sizes="80px"
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                    <p className="text-sm text-muted-foreground">
                      This thumbnail appears next to the quest on your activity
                      page.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => questImageInputRef.current?.click()}
                      >
                        Replace
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setIconFile(null)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => questImageInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setImageDropActive(true);
                  }}
                  onDragLeave={() => setImageDropActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setImageDropActive(false);
                    setQuestImageFromFile(e.dataTransfer.files?.[0]);
                  }}
                  className={cn(
                    "flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    imageDropActive
                      ? "border-primary/50 bg-primary/5"
                      : "border-muted-foreground/20 bg-muted/25 hover:border-muted-foreground/35 hover:bg-muted/40"
                  )}
                >
                  <span className="flex size-14 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border">
                    <ImagePlus
                      className="size-7 text-muted-foreground"
                      aria-hidden
                    />
                  </span>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Add a quest image
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Drop a file here or click to browse. Square images work
                      best. PNG, JPG, WebP, or GIF.
                    </p>
                  </div>
                  <span className="text-xs font-medium text-primary">
                    Choose file
                  </span>
                </button>
              )}
            </div>
          </div>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? "Saving…" : "Add quest"}
          </Button>
        </div>

        {dashboard.quests.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No quests yet. Add one above — it will appear in the public
            &quot;Quests&quot; section on this page.
          </p>
        ) : null}

        {dashboard.participants.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No participants on active reservations yet. When someone reserves,
            they appear here for quest check-off.
          </p>
        ) : (
          <div className="space-y-3 overflow-x-auto">
            <h4 className="text-sm font-semibold">Mark completion</h4>
            <table className="w-full min-w-[280px] text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-2 font-medium">Participant</th>
                  {dashboard.quests.map((q) => (
                    <th
                      key={q._id}
                      className="py-2 px-1 font-medium text-center max-w-[100px]"
                      title={q.questName}
                    >
                      <span className="inline-flex justify-center">
                        <QuestVisual
                          iconImageUrl={q.iconImageUrl}
                          iconSvg={q.iconSvg}
                          size="sm"
                        />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dashboard.participants.map((row) => (
                  <tr key={row.userId} className="border-b border-border/60">
                    <td className="py-2 pr-2">
                      <span className="font-medium">@{row.username}</span>
                      <span className="block text-xs text-muted-foreground truncate max-w-[160px]">
                        {row.name}
                      </span>
                    </td>
                    {dashboard.quests.map((q) => {
                      const done = row.completedQuestIds.some(
                        (id) => id === q._id
                      );
                      return (
                        <td key={q._id} className="py-2 px-1 text-center">
                          <Checkbox
                            checked={done}
                            disabled={done}
                            onCheckedChange={(v) => {
                              if (v === true) {
                                void handleMark(q._id, row.userId, done);
                              }
                            }}
                            aria-label={`${q.questName} for @${row.username}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
