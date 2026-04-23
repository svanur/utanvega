import { Paper, TextField, InputAdornment, MenuItem, Select, FormControl, InputLabel, Tooltip, IconButton } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';

interface TrailFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  difficultyFilter: string;
  onDifficultyFilterChange: (value: string) => void;
  activityFilter: string;
  onActivityFilterChange: (value: string) => void;
  locationFilter: string;
  onLocationFilterChange: (value: string) => void;
  locationOptions: string[];
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
  difficultyFilter,
  onDifficultyFilterChange,
  activityFilter,
  onActivityFilterChange,
  locationFilter,
  onLocationFilterChange,
  locationOptions,
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
          endAdornment: search ? (
            <InputAdornment position="end">
              <IconButton size="small" aria-label="Clear search" onClick={() => onSearchChange('')}>
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : undefined,
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
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>Difficulty</InputLabel>
        <Select
          value={difficultyFilter}
          label="Difficulty"
          onChange={(e) => onDifficultyFilterChange(e.target.value)}
        >
          <MenuItem value="all">All Difficulties</MenuItem>
          <MenuItem value="Easy">Easy</MenuItem>
          <MenuItem value="Moderate">Moderate</MenuItem>
          <MenuItem value="Hard">Hard</MenuItem>
          <MenuItem value="Expert">Expert</MenuItem>
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>Activity</InputLabel>
        <Select
          value={activityFilter}
          label="Activity"
          onChange={(e) => onActivityFilterChange(e.target.value)}
        >
          <MenuItem value="all">All Activities</MenuItem>
          <MenuItem value="TrailRunning">Trail Running</MenuItem>
          <MenuItem value="Running">Running</MenuItem>
          <MenuItem value="Hiking">Hiking</MenuItem>
          <MenuItem value="Cycling">Cycling</MenuItem>
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>Location</InputLabel>
        <Select
          value={locationFilter}
          label="Location"
          onChange={(e) => onLocationFilterChange(e.target.value)}
        >
          <MenuItem value="all">All Locations</MenuItem>
          <MenuItem value="none">No Location</MenuItem>
          {locationOptions.map(name => (
            <MenuItem key={name} value={name}>{name}</MenuItem>
          ))}
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
