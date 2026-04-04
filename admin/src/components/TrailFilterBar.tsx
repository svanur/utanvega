import { Paper, TextField, InputAdornment, MenuItem, Select, FormControl, InputLabel, Tooltip, IconButton } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';

interface TrailFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  includeDeleted: boolean;
  onResetFilters: () => void;
}

export default function TrailFilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  includeDeleted,
  onResetFilters,
}: TrailFilterBarProps) {
  return (
    <Paper sx={{ mb: 3, p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
      <TextField
        size="small"
        placeholder="Search name or description..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        sx={{ minWidth: 300 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>Status</InputLabel>
        <Select
          value={statusFilter}
          label="Status"
          onChange={(e) => onStatusFilterChange(e.target.value)}
        >
          <MenuItem value="all">All Statuses</MenuItem>
          <MenuItem value="Draft">Draft</MenuItem>
          <MenuItem value="Published">Published</MenuItem>
          <MenuItem value="Archived">Archived</MenuItem>
          {includeDeleted && <MenuItem value="Deleted">Deleted</MenuItem>}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>Type</InputLabel>
        <Select
          value={typeFilter}
          label="Type"
          onChange={(e) => onTypeFilterChange(e.target.value)}
        >
          <MenuItem value="all">All Types</MenuItem>
          <MenuItem value="Loop">Loop</MenuItem>
          <MenuItem value="OutAndBack">Out and Back</MenuItem>
          <MenuItem value="PointToPoint">Point to Point</MenuItem>
        </Select>
      </FormControl>
      <Tooltip title="Reset all filters">
        <IconButton onClick={onResetFilters}>
          <FilterAltOffIcon />
        </IconButton>
      </Tooltip>
    </Paper>
  );
}
