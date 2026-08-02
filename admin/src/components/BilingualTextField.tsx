import { useState } from 'react';
import { TextField, InputAdornment, Chip, Tooltip, IconButton, Box } from '@mui/material';
import type { TextFieldProps } from '@mui/material';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import BilingualExpandDialog from './BilingualExpandDialog';

type BilingualTextFieldProps = Omit<TextFieldProps, 'value' | 'onChange'> & {
  valueIs: string;
  valueEn: string;
  onChangeIs: (value: string) => void;
  onChangeEn: (value: string) => void;
};

export default function BilingualTextField({
  valueIs,
  valueEn,
  onChangeIs,
  onChangeEn,
  label,
  ...rest
}: BilingualTextFieldProps) {
  const [lang, setLang] = useState<'is' | 'en'>('is');
  const [expandOpen, setExpandOpen] = useState(false);
  const isEn = lang === 'en';
  const isMultiline = !!rest.multiline;
  const { sx: _sx, ...restWithoutSx } = rest;

  const toggle = (
    <InputAdornment position="end" sx={{ alignItems: 'flex-start', pt: isMultiline ? 1 : 0 }}>
      <Tooltip title={isEn ? 'Switch to Icelandic' : 'Switch to English'}>
        <Chip
          label={isEn ? 'IS' : 'EN'}
          size="small"
          onClick={() => setLang(isEn ? 'is' : 'en')}
          color={isEn ? 'default' : 'primary'}
          variant={isEn ? 'outlined' : 'filled'}
          sx={{ fontWeight: 700, fontSize: '0.7rem', cursor: 'pointer', height: 22, minWidth: 32 }}
        />
      </Tooltip>
      {isMultiline && (
        <Tooltip title="Expand — view & edit IS and EN side by side">
          <IconButton
            size="small"
            onClick={() => setExpandOpen(true)}
            sx={{ ml: 0.5, p: 0.25 }}
          >
            <OpenInFullIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      )}
    </InputAdornment>
  );

  return (
    <>
      <Box sx={{ width: rest.fullWidth ? '100%' : undefined, ...((_sx as object) ?? {}) }}>
        <TextField
          {...restWithoutSx}
          label={isEn ? `${label} (EN)` : label}
          value={isEn ? valueEn : valueIs}
          onChange={(e) => isEn ? onChangeEn(e.target.value) : onChangeIs(e.target.value)}
          InputProps={{
            ...((restWithoutSx as { InputProps?: object }).InputProps ?? {}),
            endAdornment: toggle,
          }}
          sx={{
            width: '100%',
            ...(isEn && {
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'primary.main', borderStyle: 'dashed' },
              },
            }),
          }}
        />
      </Box>
      {isMultiline && (
        <BilingualExpandDialog
          open={expandOpen}
          onClose={() => setExpandOpen(false)}
          label={String(label ?? '')}
          valueIs={valueIs}
          valueEn={valueEn}
          onSave={(is, en) => {
            onChangeIs(is);
            onChangeEn(en);
          }}
        />
      )}
    </>
  );
}
