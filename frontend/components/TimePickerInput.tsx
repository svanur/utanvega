import React, { useState, useRef } from 'react';
import { Box, TextField } from '@mui/material';

interface TimePickerInputProps {
  value: string; // HH:MM:SS format
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  helperText?: string;
}

/**
 * Custom time picker with arrow key support for hours, minutes, seconds.
 * Click on a segment (HH, MM, or SS) and use arrow keys to adjust.
 * Format: HH:MM:SS
 */
export default function TimePickerInput({
  value,
  onChange,
  label = 'Time',
  disabled = false,
  required = false,
  helperText = 'Format: HH:MM:SS',
}: TimePickerInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse current value into segments
  const parseTime = (timeStr: string) => {
    const parts = timeStr.split(':').map(p => p.padStart(2, '0'));
    return {
      hours: parts[0] || '00',
      minutes: parts[1] || '00',
      seconds: parts[2] || '00',
    };
  };

  const { hours, minutes, seconds } = parseTime(value);

  // Format time string
  const formatTime = (h: string, m: string, s: string): string => {
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`;
  };

  // Validate and constrain numeric values
  const constrainValue = (val: number, max: number): string => {
    const constrained = Math.max(0, Math.min(val, max));
    return String(constrained).padStart(2, '0');
  };

  // Handle arrow key changes
  const handleKeyDown = (e: React.KeyboardEvent, segment: 'hours' | 'minutes' | 'seconds') => {
    if (disabled) return;

    const current = segment === 'hours' ? parseInt(hours, 10) : 
                   segment === 'minutes' ? parseInt(minutes, 10) : 
                   parseInt(seconds, 10);

    let newValue = current;
    const max = segment === 'hours' ? 23 : 59;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      newValue = current === max ? 0 : current + 1;
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      newValue = current === 0 ? max : current - 1;
    }

    if (newValue !== current) {
      const constrained = constrainValue(newValue, max);
      const newTime = formatTime(
        segment === 'hours' ? constrained : hours,
        segment === 'minutes' ? constrained : minutes,
        segment === 'seconds' ? constrained : seconds
      );
      onChange(newTime);
    }
  };

  // Handle direct text input
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value;

    // Allow only digits and colons
    input = input.replace(/[^\d:]/g, '');

    // Auto-format on input
    const parts = input.split(':').filter(p => p.length > 0);
    if (parts.length >= 1) {
      const h = constrainValue(parseInt(parts[0], 10), 23);
      const m = parts.length >= 2 ? constrainValue(parseInt(parts[1], 10), 59) : '00';
      const s = parts.length >= 3 ? constrainValue(parseInt(parts[2], 10), 59) : '00';
      onChange(formatTime(h, m, s));
    }
  };

  // Handle keyboard navigation (detect segment by cursor position)
  const handleTextFieldKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!inputRef.current || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;

    const cursorPos = inputRef.current.selectionStart || 0;
    let segment: 'hours' | 'minutes' | 'seconds' = 'hours';

    if (cursorPos <= 2) segment = 'hours';
    else if (cursorPos <= 5) segment = 'minutes';
    else segment = 'seconds';

    handleKeyDown(e, segment);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <TextField
        inputRef={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleTextFieldKeyDown}
        label={label}
        placeholder="HH:MM:SS"
        disabled={disabled}
        required={required}
        helperText={helperText}
        inputProps={{
          pattern: '\\d{2}:\\d{2}:\\d{2}',
          maxLength: 8,
          style: { fontFamily: 'monospace', textAlign: 'center' },
        }}
        fullWidth
      />
    </Box>
  );
}
