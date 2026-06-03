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
    // Split on colons to respect segment boundaries
    const parts = raw.split(':');
    const hStr = (parts[0] || '').replace(/\D/g, '').padStart(2, '0').slice(0, 2);
    const mStr = (parts[1] || '').replace(/\D/g, '').padStart(2, '0').slice(0, 2);
    const sStr = (parts[2] || '').replace(/\D/g, '').padStart(2, '0').slice(0, 2);

    if (hStr === '00' && mStr === '00' && sStr === '00' && raw.replace(/\D/g, '').length === 0) return;

    const h = constrainValue(parseInt(hStr, 10), 23);
    const m = constrainValue(parseInt(mStr, 10), 59);
    const s = constrainValue(parseInt(sStr, 10), 59);
    onChange(formatTime(h, m, s));
  };

  // Handle arrow key changes based on cursor position
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();

      // Determine base values — use raw input if active, otherwise current value
      let baseHours = hours;
      let baseMinutes = minutes;
      let baseSeconds = seconds;
      if (rawInput !== null) {
        const parts = rawInput.split(':');
        baseHours = constrainValue(parseInt((parts[0] || '0').replace(/\D/g, '') || '0', 10), 23);
        baseMinutes = constrainValue(parseInt((parts[1] || '0').replace(/\D/g, '') || '0', 10), 59);
        baseSeconds = constrainValue(parseInt((parts[2] || '0').replace(/\D/g, '') || '0', 10), 59);
        setRawInput(null);
      }

      const cursorPos = inputRef.current?.selectionStart || 0;
      let segment: 'hours' | 'minutes' | 'seconds' = 'hours';
      if (cursorPos <= 2) segment = 'hours';
      else if (cursorPos <= 5) segment = 'minutes';
      else segment = 'seconds';

      const current = segment === 'hours' ? parseInt(baseHours, 10) :
                     segment === 'minutes' ? parseInt(baseMinutes, 10) :
                     parseInt(baseSeconds, 10);

      const max = segment === 'hours' ? 23 : 59;
      const newValue = e.key === 'ArrowUp'
        ? (current === max ? 0 : current + 1)
        : (current === 0 ? max : current - 1);

      const constrained = constrainValue(newValue, max);
      const newTime = formatTime(
        segment === 'hours' ? constrained : baseHours,
        segment === 'minutes' ? constrained : baseMinutes,
        segment === 'seconds' ? constrained : baseSeconds
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
