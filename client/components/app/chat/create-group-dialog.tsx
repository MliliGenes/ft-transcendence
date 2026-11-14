'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/auth-provider';
import { GroupMark } from '@/components/app/chat/details-panel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { chatApi, type ChatGroup } from '@/lib/chat/client';

export function CreateGroupDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (group: ChatGroup) => Promise<void> | void;
}) {
  const { requestWithSession } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  const create = useMutation({
    mutationFn: () =>
      requestWithSession((token) =>
        chatApi.createGroup(name.trim(), token, rules, description),
      ),
    onSuccess: async (group) => {
      setName('');
      setDescription('');
      setRules('');
      await onCreated(group);
      onOpenChange(false);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!create.isPending) onOpenChange(next);
      }}
    >
      <DialogPopup className="max-w-lg">
        <div className="pr-8">
          <DialogTitle>Create a group</DialogTitle>
          <DialogDescription className="mt-1">
            A shared space with its own channels. You’ll be its admin and can
            invite people afterwards.
          </DialogDescription>
        </div>
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <div className="flex items-center gap-4 bg-card p-4">
            <GroupMark name={name || 'New group'} />
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {name.trim() || 'Your new group'}
              </p>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {description.trim() || 'Starts with a #general channel'}
              </p>
            </div>
          </div>
          <label className="grid gap-1.5 text-sm font-medium">
            Group name
            <Input
              autoFocus
              value={name}
              maxLength={100}
              required
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Weekend chess club"
              className="h-11"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            <span>
              Description{' '}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </span>
            <Textarea
              value={description}
              maxLength={1000}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What brings this group together?"
              className="min-h-20"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            <span>
              Rules{' '}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </span>
            <Textarea
              value={rules}
              maxLength={4000}
              onChange={(event) => setRules(event.target.value)}
              placeholder="Be kind. Keep it on topic. Markdown is supported."
              className="min-h-28"
            />
          </label>
          {create.error && (
            <p role="alert" className="text-sm text-destructive">
              {create.error.message}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 px-4"
              disabled={create.isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="min-h-11 px-5"
              disabled={!name.trim() || create.isPending}
            >
              {create.isPending ? 'Creating…' : 'Create group'}
            </Button>
          </div>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
