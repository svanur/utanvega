import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  createFilterOptions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import DragHandleIcon from '@mui/icons-material/DragIndicator';
import SaveIcon from '@mui/icons-material/Save';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { usePhotoGalleries, type PhotoGalleryDto } from '../../hooks/usePhotoGalleries';
import { usePhotographers } from '../../hooks/usePhotographers';
import BilingualTextField from '../BilingualTextField';
import { trimToUndefined } from '../../utils/strings';

interface PhotoGalleryManagerProps {
  editionId: string | null;
  onNotify: (msg: ReactNode, severity?: 'success' | 'error') => void;
  // Fired after any gallery create/update/delete (including reorder, which goes through
  // updatePhotoGallery) so a caller displaying a denormalized summary elsewhere — the
  // Galleries entry in EventDetailPage's edition meta row — can refresh in step, even
  // when this dialog is dismissed via Cancel rather than Save. See usePhotoGalleries.
  onGalleryMutated?: () => void;
}

// Imperative escape hatch for EditionDialogInner's own Save/Cancel: this component's row drafts
// are otherwise entirely private, but the dialog's Save button needs to flush any dirty/new-but-
// filled row before it closes (rather than silently discarding it, as it did before #549), and
// Cancel/dismiss needs to know one exists so it can warn instead of discarding it silently.
export interface PhotoGalleryManagerHandle {
  hasPendingChanges: () => boolean;
  flushPending: (editionId: string) => Promise<boolean>;
}

interface PhotographerRef {
  id: string;
  name: string;
}

interface RowDraft {
  key: string;
  id: string | null; // null = not yet persisted
  url: string;
  photographer: PhotographerRef | null;
  title: string;
  titleEn: string;
  sortOrder: number;
  dirty: boolean;
  saving: boolean;
}

function draftFromGallery(g: PhotoGalleryDto): RowDraft {
  return {
    key: g.id,
    id: g.id,
    url: g.url,
    photographer: g.photographerId ? { id: g.photographerId, name: g.photographerName ?? '' } : null,
    title: g.title ?? '',
    titleEn: g.titleEn ?? '',
    sortOrder: g.sortOrder,
    dirty: false,
    saving: false,
  };
}

// Options list for the photographer Autocomplete: existing photographers, plus (when the
// typed name doesn't match anything) a synthetic "create new" option.
type PhotographerOption = PhotographerRef | { inputValue: string; name: string };

function isCreateOption(o: PhotographerOption): o is { inputValue: string; name: string } {
  return 'inputValue' in o;
}

const filterPhotographerOptions = createFilterOptions<PhotographerOption>();

function PhotographerPicker({
  options, value, onChange, onCreate, disabled,
}: {
  options: PhotographerRef[];
  value: PhotographerRef | null;
  onChange: (v: PhotographerRef | null) => void;
  onCreate: (name: string) => Promise<PhotographerRef | null>;
  disabled?: boolean;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <Autocomplete<PhotographerOption, false, false, false>
      size="small"
      fullWidth
      options={options}
      value={value}
      loading={creating}
      disabled={disabled || creating}
      isOptionEqualToValue={(option, val) => !isCreateOption(option) && !isCreateOption(val) && option.id === val.id}
      getOptionLabel={(option) => isCreateOption(option) ? option.inputValue : option.name}
      filterOptions={(opts, params) => {
        const filtered = filterPhotographerOptions(opts, params);
        const input = params.inputValue.trim();
        const isExisting = opts.some(o => input.toLowerCase() === o.name.toLowerCase());
        if (input !== '' && !isExisting) {
          filtered.push({ inputValue: input, name: `Add "${input}" as new photographer` });
        }
        return filtered;
      }}
      onChange={(_, newValue) => {
        if (!newValue) { onChange(null); return; }
        if (isCreateOption(newValue)) {
          setCreating(true);
          onCreate(newValue.inputValue)
            .then(created => { if (created) onChange(created); })
            .finally(() => setCreating(false));
          return;
        }
        onChange(newValue);
      }}
      renderOption={(props, option) => (
        <li {...props} key={isCreateOption(option) ? option.inputValue : option.id}>
          {option.name}
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Photographer (optional)"
          placeholder="Search or create…"
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {creating ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      selectOnFocus
      clearOnBlur
      handleHomeEndKeys
    />
  );
}

interface GalleryRowProps {
  draft: RowDraft;
  photographers: PhotographerRef[];
  onCreatePhotographer: (name: string) => Promise<PhotographerRef | null>;
  onChange: (patch: Partial<RowDraft>) => void;
  onSave: () => void;
  onDelete: () => void;
  confirmingDelete: boolean;
  draggable: boolean;
}

function GalleryRow({ draft, photographers, onCreatePhotographer, onChange, onSave, onDelete, confirmingDelete, draggable }: GalleryRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: draft.key, disabled: !draggable });
  const isNew = draft.id === null;
  // Mirrors the "needs a flush" gate in PhotoGalleryManager.flushPending — kept in sync there
  // and here so the border/label always agree with what a dialog Save would actually persist.
  const isUnsaved = draft.url.trim() !== '' && (isNew || draft.dirty);
  const canSave = isUnsaved;

  return (
    <Box
      ref={setNodeRef}
      sx={{
        border: 1,
        borderColor: isUnsaved ? 'warning.main' : 'divider',
        borderRadius: 1,
        p: 1.5,
        mb: 1.5,
        bgcolor: 'background.paper',
        opacity: isDragging ? 0.5 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
        <Box
          sx={{ color: draggable ? 'text.disabled' : 'action.disabled', cursor: draggable ? 'grab' : 'default', display: 'flex' }}
          {...(draggable ? { ...attributes, ...listeners } : {})}
        >
          <DragHandleIcon fontSize="small" />
        </Box>
        <Typography variant="caption" color={isUnsaved ? 'warning.main' : 'text.secondary'} sx={{ flexGrow: 1 }}>
          {isNew ? 'New gallery (unsaved)' : draft.dirty ? 'Gallery (unsaved changes)' : 'Gallery'}
        </Typography>
        {canSave && (
          <Tooltip title={isNew ? 'Add gallery' : 'Save changes'}>
            <span>
              <IconButton size="small" color="primary" disabled={draft.saving} onClick={onSave}>
                {draft.saving ? <CircularProgress size={16} /> : <SaveIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        )}
        <Tooltip title={isNew ? 'Cancel' : confirmingDelete ? 'Click again to confirm — or wait 3 seconds to cancel' : 'Delete gallery'}>
          <IconButton size="small" color={confirmingDelete ? 'error' : 'default'} onClick={onDelete}>
            {isNew ? <CloseIcon fontSize="small" /> : <DeleteIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Stack>
      <Stack spacing={1.25}>
        <TextField
          size="small" fullWidth label="URL" value={draft.url}
          onChange={e => onChange({ url: e.target.value, dirty: true })}
          placeholder="https://…"
        />
        <PhotographerPicker
          options={photographers}
          value={draft.photographer}
          onChange={v => onChange({ photographer: v, dirty: true })}
          onCreate={onCreatePhotographer}
        />
        <BilingualTextField
          size="small" fullWidth label="Title (optional)"
          valueIs={draft.title} valueEn={draft.titleEn}
          onChangeIs={v => onChange({ title: v, dirty: true })}
          onChangeEn={v => onChange({ titleEn: v, dirty: true })}
        />
      </Stack>
    </Box>
  );
}

const PhotoGalleryManager = forwardRef<PhotoGalleryManagerHandle, PhotoGalleryManagerProps>(function PhotoGalleryManager({ editionId, onNotify, onGalleryMutated }, ref) {
  const { galleries, loading, createPhotoGallery, updatePhotoGallery, updatePhotoGalleriesBatch, deletePhotoGallery } = usePhotoGalleries(editionId, onGalleryMutated);
  const { photographers, createPhotographer } = usePhotographers();

  const [drafts, setDrafts] = useState<RowDraft[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const tempKeyRef = useRef(0);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Seed local editable rows from the fetched galleries exactly once per dialog open — after
  // that, every row's own local state is the source of truth (we patch it optimistically on
  // save/delete/reorder) so a background refetch never clobbers an in-progress edit on another row.
  useEffect(() => {
    if (!editionId) { setDrafts([]); setInitialized(false); return; }
    if (!loading && !initialized) {
      setDrafts(galleries.map(draftFromGallery));
      setInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editionId, loading, initialized]);

  useEffect(() => {
    if (!confirmDeleteKey) return;
    const t = setTimeout(() => setConfirmDeleteKey(null), 3000);
    return () => clearTimeout(t);
  }, [confirmDeleteKey]);

  const photographerRefs: PhotographerRef[] = photographers.map(p => ({ id: p.id, name: p.name }));

  const handleCreatePhotographer = async (name: string): Promise<PhotographerRef | null> => {
    try {
      const { id } = await createPhotographer({ name });
      return { id, name };
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to create photographer', 'error');
      return null;
    }
  };

  const patchDraft = (key: string, patch: Partial<RowDraft>) =>
    setDrafts(prev => prev.map(d => d.key === key ? { ...d, ...patch } : d));

  // Only one unsaved row at a time — avoids two drafts racing for the same "append at the end"
  // sortOrder before either has actually been persisted.
  const hasUnsavedRow = drafts.some(d => d.id === null);

  // max(SortOrder)+1 rather than a count of persisted rows — a delete-then-add of a non-last
  // gallery leaves a gap, and counting rows would reissue an already-used SortOrder, colliding
  // with a survivor since neither the backend nor the OrderBy query renumbers/tiebreaks on it.
  const nextSortOrder = (rows: RowDraft[]): number => {
    const persistedOrders = rows.filter(d => d.id !== null).map(d => d.sortOrder);
    return persistedOrders.length === 0 ? 0 : Math.max(...persistedOrders) + 1;
  };

  const handleAddRow = () => {
    if (hasUnsavedRow) return;
    const key = `new-${tempKeyRef.current++}`;
    setDrafts(prev => [...prev, {
      key, id: null, url: '', photographer: null, title: '', titleEn: '',
      sortOrder: nextSortOrder(prev), dirty: false, saving: false,
    }]);
  };

  const handleCancelNewRow = (key: string) =>
    setDrafts(prev => prev.filter(d => d.key !== key));

  // Shared by the per-row Save button (handleSaveRow) and the dialog-level flush (flushPending,
  // exposed via the ref) so the two paths can never diverge in payload shape — see #549.
  const persistDraft = async (
    key: string,
    effectiveEditionId: string,
    opts?: { notifyOnSuccess?: boolean },
  ): Promise<boolean> => {
    const draft = drafts.find(d => d.key === key);
    if (!draft || !draft.url.trim()) return false;
    const notifyOnSuccess = opts?.notifyOnSuccess ?? true;
    patchDraft(key, { saving: true });
    try {
      if (draft.id === null) {
        // Recompute at save time (not add time) in case a persisted row was deleted or
        // reordered while this draft was still being filled in.
        const sortOrder = nextSortOrder(drafts);
        const { id } = await createPhotoGallery({
          eventEditionId: effectiveEditionId,
          url: draft.url.trim(),
          photographerId: draft.photographer?.id ?? null,
          title: trimToUndefined(draft.title) ?? null,
          titleEn: trimToUndefined(draft.titleEn) ?? null,
          sortOrder,
        });
        patchDraft(key, { id, saving: false, dirty: false });
        if (notifyOnSuccess) onNotify('Gallery added', 'success');
      } else {
        await updatePhotoGallery({
          id: draft.id,
          url: draft.url.trim(),
          photographerId: draft.photographer?.id ?? null,
          title: trimToUndefined(draft.title) ?? null,
          titleEn: trimToUndefined(draft.titleEn) ?? null,
          sortOrder: draft.sortOrder,
        });
        patchDraft(key, { saving: false, dirty: false });
        if (notifyOnSuccess) onNotify('Gallery saved', 'success');
      }
      return true;
    } catch (err) {
      patchDraft(key, { saving: false });
      onNotify(err instanceof Error ? err.message : 'Failed to save gallery', 'error');
      return false;
    }
  };

  const handleSaveRow = async (key: string) => {
    const draft = drafts.find(d => d.key === key);
    if (!draft || !editionId) return;
    if (!draft.url.trim()) { onNotify('URL is required', 'error'); return; }
    await persistDraft(key, editionId);
  };

  const handleDeleteRow = async (key: string) => {
    const draft = drafts.find(d => d.key === key);
    if (!draft) return;
    if (draft.id === null) { handleCancelNewRow(key); return; }
    if (confirmDeleteKey !== key) { setConfirmDeleteKey(key); return; }
    try {
      await deletePhotoGallery(draft.id);
      setDrafts(prev => prev.filter(d => d.key !== key));
      setConfirmDeleteKey(null);
      onNotify('Gallery deleted', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to delete gallery', 'error');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const persisted = drafts.filter(d => d.id !== null);
    const unsaved = drafts.filter(d => d.id === null);
    const oldIndex = persisted.findIndex(d => d.key === active.id);
    const newIndex = persisted.findIndex(d => d.key === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(persisted, oldIndex, newIndex);
    const changed = reordered.map((d, idx) => ({ draft: d, newSortOrder: idx, changed: d.sortOrder !== idx }));
    setDrafts([...reordered.map((d, idx) => ({ ...d, sortOrder: idx })), ...unsaved]);
    const toUpdate = changed.filter(c => c.changed);
    try {
      const results = await updatePhotoGalleriesBatch(toUpdate.map(c => ({
        id: c.draft.id!,
        url: c.draft.url,
        photographerId: c.draft.photographer?.id ?? null,
        title: trimToUndefined(c.draft.title) ?? null,
        titleEn: trimToUndefined(c.draft.titleEn) ?? null,
        sortOrder: c.newSortOrder,
      })));
      const failedResults = results.filter(r => !r.success);
      if (failedResults.length === 0) return; // every PUT landed — the optimistic order above is already correct
      const failedIds = new Set(failedResults.map(r => r.id));
      if (failedIds.size === results.length) {
        // Nothing persisted — revert the whole batch to its pre-reorder order, as before.
        setDrafts([...persisted, ...unsaved]);
      } else {
        // Partial failure: some rows' new sortOrder is genuinely persisted server-side (and the
        // hook has already invalidated the cache to match), so only the rows whose PUT actually
        // failed get reverted — both their array position (back to where they sat pre-reorder)
        // and their sortOrder, together. Reverting sortOrder alone (as before #620) left a failed
        // row's displayed position and its sortOrder number disagreeing, and that stale number
        // could collide with whichever surviving row now legitimately owns it. The survivors keep
        // the new position their (successful) PUT actually persisted, and every row is renumbered
        // to its final array index afterwards so sortOrder stays a unique, gapless rank.
        const survivorsInNewOrder = reordered.filter(d => !d.id || !failedIds.has(d.id));
        const failedInOriginalOrder = reordered
          .filter(d => d.id && failedIds.has(d.id))
          .map(draft => ({ draft, originalIndex: persisted.findIndex(p => p.key === draft.key) }))
          .sort((a, b) => a.originalIndex - b.originalIndex);
        const reconciled = [...survivorsInNewOrder];
        failedInOriginalOrder.forEach(({ draft, originalIndex }) => {
          reconciled.splice(Math.min(originalIndex, reconciled.length), 0, draft);
        });
        setDrafts([...reconciled.map((d, idx) => ({ ...d, sortOrder: idx })), ...unsaved]);
      }
      // Surface which row(s) failed and why (per BatchUpdateResult.error), rather than a fixed
      // generic string that gives the user no way to tell which gallery to retry (#620).
      const firstError = failedResults[0]?.error;
      const detail = firstError ? `: ${firstError}` : '';
      onNotify(
        results.length === 1
          ? `Failed to reorder gallery${detail}`
          : `Failed to reorder ${failedResults.length} of ${results.length} galleries${detail}`,
        'error',
      );
    } catch (err) {
      // updatePhotoGalleriesBatch no longer rejects on a failed PUT (Promise.allSettled), so this
      // only fires for a genuinely unexpected error — with no per-row info to reconcile with,
      // fall back to a full revert as before.
      setDrafts([...persisted, ...unsaved]);
      onNotify(err instanceof Error ? `Failed to reorder galleries: ${err.message}` : 'Failed to reorder galleries', 'error');
    }
  };

  // A row "needs flushing" under the same gate GalleryRow uses to show its own Save button
  // (canSave/isUnsaved) — a non-empty URL that's either brand new or edited since its last save.
  const hasPendingChanges = () =>
    drafts.some(d => d.url.trim() !== '' && (d.id === null || d.dirty));

  // Called by EditionDialogInner's own Save button, with the edition id it just created/already
  // has — never the editionId prop directly, since for a brand-new edition that prop is still
  // null at the point the dialog's create-edition call resolves. Sequential rather than
  // Promise.all: a new row's sortOrder is computed from current `drafts` at persist time
  // (see persistDraft/nextSortOrder), so two new rows persisting concurrently could both read
  // the same "next" value and collide.
  const flushPending = async (effectiveEditionId: string): Promise<boolean> => {
    const pendingKeys = drafts.filter(d => d.url.trim() !== '' && (d.id === null || d.dirty)).map(d => d.key);
    let allOk = true;
    for (const key of pendingKeys) {
      const ok = await persistDraft(key, effectiveEditionId, { notifyOnSuccess: false });
      if (!ok) allOk = false;
    }
    return allOk;
  };

  useImperativeHandle(ref, () => ({ hasPendingChanges, flushPending }));

  if (!editionId) {
    return (
      <Typography variant="body2" color="text.secondary">
        Save the edition first to add photo galleries.
      </Typography>
    );
  }

  if (loading && !initialized) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  const persistedKeys = drafts.filter(d => d.id !== null).map(d => d.key);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle2">Photo galleries</Typography>
        <Tooltip title={hasUnsavedRow ? 'Finish the new gallery below first' : ''}>
          <span>
            <Button size="small" startIcon={<AddIcon />} onClick={handleAddRow} disabled={hasUnsavedRow}>
              Add gallery
            </Button>
          </span>
        </Tooltip>
      </Stack>
      {drafts.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No photo galleries yet.</Typography>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => void handleDragEnd(e)}>
          <SortableContext items={persistedKeys} strategy={verticalListSortingStrategy}>
            {drafts.map(draft => (
              <GalleryRow
                key={draft.key}
                draft={draft}
                photographers={photographerRefs}
                onCreatePhotographer={handleCreatePhotographer}
                onChange={patch => patchDraft(draft.key, patch)}
                onSave={() => void handleSaveRow(draft.key)}
                onDelete={() => void handleDeleteRow(draft.key)}
                confirmingDelete={confirmDeleteKey === draft.key}
                draggable={draft.id !== null}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}
    </Box>
  );
});

export default PhotoGalleryManager;
