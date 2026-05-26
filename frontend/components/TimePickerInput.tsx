import React, { useRef, useState as useLocalState } from 'react';
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
 * Custom time picker with keyboard and arrow key support.
 * Type digits directly (auto-inserts colons) or use arrow keys on segments.
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
  const [rawInput, setRawInput] = useLocalState<string | null>(null);

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

  const formatTime = (h: string, m: string, s: string): string => {
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`;
  };

  const constrainValue = (val: number, max: number): string => {
    const constrained = Math.max(0, Math.min(val, max));
    return String(constrained).padStart(2, '0');
  };

  // Commit raw input as formatted time
  const commitRawInput = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 0) return;

    // Pad digits to 6 (HHMMSS)
    const padded = digits.padEnd(6, '0').slice(0, 6);
    const h = constrainValue(parseInt(padded.slice(0, 2), 10), 23);
    const m = constrainValue(parseInt(padded.slice(2, 4), 10), 59);
    const s = constrainValue(parseInt(padded.slice(4, 6), 10), 59);
    onChange(formatTime(h, m, s));
  };

  // Handle arrow key changes based on cursor position
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      // If in raw input mode, commit first
      if (rawInput !== null) {
        commitRawInput(rawInput);
        setRawInput(null);
      }

      const cursorPos = inputRef.current?.selectionStart || 0;
      let segment: 'hours' | 'minutes' | 'seconds' = 'hours';
      if (cursorPos <= 2) segment = 'hours';
      else if (cursorPos <= 5) segment = 'minutes';
      else segment = 'seconds';

      const current = segment === 'hours' ? parseInt(hours, 10) :
                     segment === 'minutes' ? parseInt(minutes, 10) :
                     parseInt(seconds, 10);

      const max = segment === 'hours' ? 23 : 59;
      const newValue = e.key === 'ArrowUp'
        ? (current === max ? 0 : current + 1)
        : (current === 0 ? max : current - 1);

      const constrained = constrainValue(newValue, max);
      const newTime = formatTime(
        segment === 'hours' ? constrained : hours,
        segment === 'minutes' ? constrained : minutes,
        segment === 'seconds' ? constrained : seconds
      );
      onChange(newTime);

      // Restore cursor position after render
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(cursorPos, cursorPos);
        }
      }, 0);
    } else if (e.key === 'Enter') {
      // Commit on Enter
      if (rawInput !== null) {
        commitRawInput(rawInput);
        setRawInput(null);
      }
    } else if (/^\d$/.test(e.key) && rawInput === null) {
      // Starting to type digits while showing formatted value — enter raw mode
      e.preventDefault();
      setRawInput(e.key);
    }
  };

  // Handle direct text input — allow typing freely, auto-insert colons
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const digits = input.replace(/\D/g, '');

    if (digits.length === 0) {
      onChange('00:00:00');
      setRawInput(null);
      return;
    }

    // Auto-format with colons as user types digits
    let formatted = '';
    for (let i = 0; i < digits.length && i < 6; i++) {
      if (i === 2 || i === 4) formatted += ':';
      formatted += digits[i];
    }
    setRawInput(formatted);

    // Auto-commit when all 6 digits entered
    if (digits.length >= 6) {
      const h = constrainValue(parseInt(digits.slice(0, 2), 10), 23);
      const m = constrainValue(parseInt(digits.slice(2, 4), 10), 59);
      const s = constrainValue(parseInt(digits.slice(4, 6), 10), 59);
      onChange(formatTime(h, m, s));
      setRawInput(null);
    }
  };

  // Commit on blur
  const handleBlur = () => {
    if (rawInput !== null) {
      commitRawInput(rawInput);
      setRawInput(null);
    }
  };

  // Select all on focus so typing replaces the current value
  const handleFocus = () => {
    setTimeout(() => {
      inputRef.current?.select();
    }, 0);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <TextField
        inputRef={inputRef}
        value={rawInput !== null ? rawInput : value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleFocus}
        label={label}
        placeholder="HH:MM:SS"
        disabled={disabled}
        required={required}
        helperText={helperText}
        inputProps={{
          style: { fontFamily: 'monospace', textAlign: 'center' },
        }}
        fullWidth
      />
    </Box>
  );
}
