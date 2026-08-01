import { useState } from 'react';
import { TextField, InputAdornment, Chip, Tooltip } from '@mui/material';
import type { TextFieldProps } from '@mui/material';

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
  const isEn = lang === 'en';

  const toggle = (
    <InputAdornment position="end">
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
    </InputAdornment>
  );

  return (
    <TextField
      {...rest}
      label={isEn ? `${label} (EN)` : label}
      value={isEn ? valueEn : valueIs}
      onChange={(e) => isEn ? onChangeEn(e.target.value) : onChangeIs(e.target.value)}
      InputProps={{
        ...((rest as { InputProps?: object }).InputProps ?? {}),
        endAdornment: toggle,
      }}
      sx={{
        ...rest.sx,
        ...(isEn && {
          '& .MuiOutlinedInput-root': {
            '& fieldset': { borderColor: 'primary.main', borderStyle: 'dashed' },
          },
        }),
      }}
    />
  );
}
