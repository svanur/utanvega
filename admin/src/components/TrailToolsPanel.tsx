import { Paper, Typography, Button, CircularProgress, Box, FormControlLabel, Switch, Collapse, Divider, Stack, Chip, Tooltip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CalculateIcon from '@mui/icons-material/Calculate';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import BuildIcon from '@mui/icons-material/Build';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import type { TagDto } from '../hooks/useTags';

interface TrailToolsPanelProps {
  showTools: boolean;
  onToggleTools: () => void;
  selectedIds: string[];
  includeDeleted: boolean;
  onIncludeDeletedChange: (value: boolean) => void;
  onShowBulkUpload: () => void;
  recalculating: boolean;
  bulkActioning: boolean;
  tags: TagDto[];
  onRecalculateDifficulties: () => void;
  onBulkAction: (action: 'Delete' | 'UpdateStatus', value?: string) => void;
  onBulkTag: (tagId: string, action: 'add' | 'remove') => void;
}

export default function TrailToolsPanel({
  showTools,
  onToggleTools,
  selectedIds,
  includeDeleted,
  onIncludeDeletedChange,
  onShowBulkUpload,
  recalculating,
  bulkActioning,
  tags,
  onRecalculateDifficulties,
  onBulkAction,
  onBulkTag,
}: TrailToolsPanelProps) {
  return (
    <>
      {/* Collapsible Tools Panel */}
      <Collapse in={showTools}>
        <Paper sx={{ mb: 2, mt: 2, p: 2, border: '1px solid', borderColor: 'divider' }}>
          <Stack spacing={2}>
            {/* Upload Section */}
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>📤 Upload</Typography>
              <Button
                variant="contained"
                size="small"
                startIcon={<CloudUploadIcon />}
                onClick={onShowBulkUpload}
              >
                Bulk Upload GPX
              </Button>
            </Box>

            <Divider />

            {/* Maintenance Section */}
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>🔧 Maintenance</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Tooltip title="Recalculate difficulty for all trails based on distance, elevation and activity type">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={recalculating ? <CircularProgress size={16} /> : <CalculateIcon />}
                    onClick={onRecalculateDifficulties}
                    disabled={recalculating}
                  >
                    Recalculate Difficulties
                  </Button>
                </Tooltip>
                <FormControlLabel
                  control={<Switch size="small" checked={includeDeleted} onChange={(e) => onIncludeDeletedChange(e.target.checked)} />}
                  label={<Typography variant="body2">Show Deleted</Typography>}
                />
              </Stack>
            </Box>

            {/* Bulk Actions Section (visible when items selected) */}
            {selectedIds.length > 0 && (
              <>
                <Divider />
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    ⚡ Bulk Actions ({selectedIds.length} selected)
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => onBulkAction('Delete')} disabled={bulkActioning}>Delete</Button>
                    <Button size="small" variant="outlined" onClick={() => onBulkAction('UpdateStatus', 'Published')} disabled={bulkActioning}>Publish</Button>
                    <Button size="small" variant="outlined" onClick={() => onBulkAction('UpdateStatus', 'Draft')} disabled={bulkActioning}>Draft</Button>
                    <Button size="small" variant="outlined" onClick={() => onBulkAction('UpdateStatus', 'Archived')} disabled={bulkActioning}>Archive</Button>
                  </Stack>
                  {tags.length > 0 && (
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        <LocalOfferIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                        Add/Remove Tag:
                      </Typography>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {tags.map(tag => (
                          <Chip
                            key={tag.id}
                            label={tag.name}
                            size="small"
                            onClick={() => onBulkTag(tag.id, 'add')}
                            onDelete={() => onBulkTag(tag.id, 'remove')}
                            disabled={bulkActioning}
                            sx={{
                              borderColor: tag.color || undefined,
                              '& .MuiChip-deleteIcon': { fontSize: 16 },
                            }}
                            variant="outlined"
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Box>
              </>
            )}
          </Stack>
        </Paper>
      </Collapse>

      {/* Inline selection indicator (when tools panel is closed) */}
      {!showTools && selectedIds.length > 0 && (
        <Paper sx={{ mb: 2, p: 1.5, display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'action.selected' }}>
          <Typography variant="body2" fontWeight={600}>{selectedIds.length} selected</Typography>
          <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => onBulkAction('Delete')} disabled={bulkActioning}>Delete</Button>
          <Button size="small" variant="outlined" onClick={() => onBulkAction('UpdateStatus', 'Published')} disabled={bulkActioning}>Publish</Button>
          <Button size="small" variant="outlined" onClick={() => onBulkAction('UpdateStatus', 'Draft')} disabled={bulkActioning}>Draft</Button>
          <Button size="small" variant="outlined" onClick={() => onBulkAction('UpdateStatus', 'Archived')} disabled={bulkActioning}>Archive</Button>
        </Paper>
      )}
    </>
  );
}
