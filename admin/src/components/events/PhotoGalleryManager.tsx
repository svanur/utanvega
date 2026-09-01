import { useEffect, useRef, useState, type ReactNode } from 'react';
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
  const canSave = draft.url.trim() !== '' && (draft.id === null || draft.dirty);
  const isNew = draft.id === null;

  return (
    <Box
      ref={setNodeRef}
      sx={{
        border: 1,
        borderColor: 'divider',
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
        <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
          {isNew ? 'New gallery' : `Gallery`}
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

export default function PhotoGalleryManager({ editionId, onNotify }: PhotoGalleryManagerProps) {
  const { galleries, loading, createPhotoGallery, updatePhotoGallery, deletePhotoGallery, refresh } = usePhotoGalleries(editionId);
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

  const handleAddRow = () => {
    if (hasUnsavedRow) return;
    const key = `new-${tempKeyRef.current++}`;
    setDrafts(prev => [...prev, {
      key, id: null, url: '', photographer: null, title: '', titleEn: '',
      sortOrder: prev.filter(d => d.id !== null).length, dirty: false, saving: false,
    }]);
  };

  const handleCancelNewRow = (key: string) =>
    setDrafts(prev => prev.filter(d => d.key !== key));

  const handleSaveRow = async (key: string) => {
    const draft = drafts.find(d => d.key === key);
    if (!draft || !editionId) return;
    if (!draft.url.trim()) { onNotify('URL is required', 'error'); return; }
    patchDraft(key, { saving: true });
    try {
      if (draft.id === null) {
        // Recompute at save time (not add time) in case a persisted row was deleted or
        // reordered while this draft was still being filled in.
        const sortOrder = drafts.filter(d => d.id !== null).length;
        const { id } = await createPhotoGallery({
          eventEditionId: editionId,
          url: draft.url.trim(),
          photographerId: draft.photographer?.id ?? null,
          title: trimToUndefined(draft.title) ?? null,
          titleEn: trimToUndefined(draft.titleEn) ?? null,
          sortOrder,
        });
        patchDraft(key, { id, saving: false, dirty: false });
        onNotify('Gallery added', 'success');
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
        onNotify('Gallery saved', 'success');
      }
    } catch (err) {
      patchDraft(key, { saving: false });
      onNotify(err instanceof Error ? err.message : 'Failed to save gallery', 'error');
    }
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
    try {
      await Promise.all(changed.filter(c => c.changed).map(c =>
        updatePhotoGallery({
          id: c.draft.id!,
          url: c.draft.url,
          photographerId: c.draft.photographer?.id ?? null,
          title: trimToUndefined(c.draft.title) ?? null,
          titleEn: trimToUndefined(c.draft.titleEn) ?? null,
          sortOrder: c.newSortOrder,
        }),
      ));
      await refresh();
    } catch {
      setDrafts([...persisted, ...unsaved]);
      onNotify('Failed to reorder galleries', 'error');
    }
  };

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
}
