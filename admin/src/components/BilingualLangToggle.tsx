import { Box, Chip } from '@mui/material';
import { useBilingualLang } from '../hooks/useBilingualLang';

// #935: this Chip toggle used to be copy-pasted (byte-identical) across five files —
// EventWizardPage, EventDetailPage, EventFormCard, RaceFormCard, TrailFormCard. It flips
// BilingualLangContext between IS/EN, same as before.
//
// The Chip itself stays visually small (MUI `size="small"`, 24px tall) so it doesn't balloon next
// to this page's other compact controls, but its actual hit area is widened to the 44px
// touch-target minimum by centering it inside an invisibly larger Box. The Box (not the Chip)
// owns the onClick so the whole 44x44 area is tappable. The Chip must NOT be given `onClick` or
// `clickable` — either one makes MUI render it as a `ButtonBase`, i.e. a second
// `<div role="button" tabIndex={0}>` nested inside this Box's own role="button", which is an
// invalid nested-interactive-element ARIA pattern (a dead extra tab stop, since the inner Chip
// would have no onClick of its own to respond to Enter/Space). The Chip stays a plain,
// non-interactive visual element; the Box is the only focusable/interactive control.
export default function BilingualLangToggle() {
  const { lang, toggle } = useBilingualLang();
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={lang === 'is' ? 'Switch all fields to English' : 'Switch all fields to Icelandic'}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      }}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 44,
        minHeight: 44,
        cursor: 'pointer',
      }}
    >
      <Chip
        label={lang === 'is' ? 'IS' : 'EN'}
        size="small"
        color={lang === 'en' ? 'primary' : 'default'}
        variant={lang === 'en' ? 'filled' : 'outlined'}
        sx={{ fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', minWidth: 36 }}
      />
    </Box>
  );
}
