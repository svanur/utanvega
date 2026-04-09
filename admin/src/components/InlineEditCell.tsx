import { useState, useRef, useEffect, useCallback } from 'react';
import { TextField, Select, MenuItem, Typography, Box, CircularProgress, ClickAwayListener } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';

interface InlineEditTextProps {
    value: string;
    onSave: (value: string) => Promise<void>;
    variant?: 'body2' | 'caption';
    fontWeight?: string | number;
    maxWidth?: number;
    multiline?: boolean;
    placeholder?: string;
}

export function InlineEditText({ value, onSave, variant = 'body2', fontWeight, maxWidth = 300, multiline = false, placeholder }: InlineEditTextProps) {
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);
    const [saving, setSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const effectiveMaxWidth = multiline ? Math.max(maxWidth, 550) : maxWidth;

    useEffect(() => {
        if (editing) {
            setEditValue(value);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [editing, value]);

    const handleSave = useCallback(async () => {
        const trimmed = editValue.trim();
        if (!trimmed || trimmed === value) {
            setEditing(false);
            return;
        }
        try {
            setSaving(true);
            await onSave(trimmed);
            setEditing(false);
        } catch {
            // Keep editing on error
        } finally {
            setSaving(false);
        }
    }, [editValue, value, onSave]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            setEditing(false);
        }
    }, [handleSave]);

    if (editing) {
        return (
            <ClickAwayListener onClickAway={handleSave}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TextField
                        inputRef={inputRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        size="small"
                        multiline={multiline}
                        maxRows={multiline ? 6 : 1}
                        variant="standard"
                        disabled={saving}
                        placeholder={placeholder}
                        sx={{ minWidth: multiline ? 350 : 120, maxWidth: effectiveMaxWidth, width: multiline ? '100%' : undefined }}
                        InputProps={{
                            sx: { fontSize: variant === 'caption' ? '0.75rem' : '0.875rem' },
                            endAdornment: saving ? <CircularProgress size={14} /> : (
                                <Box sx={{ display: 'flex', gap: 0 }}>
                                    <CheckIcon
                                        fontSize="small"
                                        sx={{ cursor: 'pointer', color: 'success.main', fontSize: 16 }}
                                        onClick={handleSave}
                                    />
                                    <CloseIcon
                                        fontSize="small"
                                        sx={{ cursor: 'pointer', color: 'text.secondary', fontSize: 16 }}
                                        onClick={() => setEditing(false)}
                                    />
                                </Box>
                            ),
                        }}
                    />
                </Box>
            </ClickAwayListener>
        );
    }

    return (
        <Box
            onClick={() => setEditing(true)}
            sx={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                borderRadius: 0.5,
                px: 0.5,
                mx: -0.5,
                '&:hover': {
                    bgcolor: 'action.hover',
                    '& .edit-icon': { opacity: 1 },
                },
            }}
        >
            <Typography
                variant={variant}
                sx={{ fontWeight, maxWidth: effectiveMaxWidth, overflow: 'hidden', textOverflow: 'ellipsis', color: value ? undefined : 'text.disabled', fontStyle: value ? undefined : 'italic' }}
                noWrap={!multiline}
            >
                {value || placeholder || '—'}
            </Typography>
            <EditIcon className="edit-icon" sx={{ fontSize: 14, opacity: 0, color: 'text.secondary', transition: 'opacity 0.15s' }} />
        </Box>
    );
}

interface InlineEditSelectProps {
    value: string;
    options: { value: string; label: string }[];
    onSave: (value: string) => Promise<void>;
    renderDisplay?: (value: string) => React.ReactNode;
}

export function InlineEditSelect({ value, options, onSave, renderDisplay }: InlineEditSelectProps) {
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleChange = useCallback(async (newValue: string) => {
        if (newValue === value) {
            setEditing(false);
            return;
        }
        try {
            setSaving(true);
            await onSave(newValue);
            setEditing(false);
        } catch {
            // Keep editing on error
        } finally {
            setSaving(false);
        }
    }, [value, onSave]);

    if (editing) {
        return (
            <ClickAwayListener onClickAway={() => setEditing(false)}>
                <Box sx={{ minWidth: 100 }}>
                    <Select
                        value={value}
                        onChange={(e) => handleChange(e.target.value)}
                        size="small"
                        autoFocus
                        open
                        onClose={() => setEditing(false)}
                        disabled={saving}
                        variant="standard"
                        sx={{ fontSize: '0.8rem', minWidth: 90 }}
                    >
                        {options.map(opt => (
                            <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.85rem' }}>
                                {opt.label}
                            </MenuItem>
                        ))}
                    </Select>
                    {saving && <CircularProgress size={14} sx={{ ml: 0.5 }} />}
                </Box>
            </ClickAwayListener>
        );
    }

    return (
        <Box
            onClick={() => setEditing(true)}
            sx={{
                cursor: 'pointer',
                borderRadius: 0.5,
                '&:hover': { bgcolor: 'action.hover' },
            }}
        >
            {renderDisplay ? renderDisplay(value) : (
                <Typography variant="body2">{options.find(o => o.value === value)?.label || value}</Typography>
            )}
        </Box>
    );
}
