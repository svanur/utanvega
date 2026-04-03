import { IconButton, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';

export default function LanguageToggle() {
    const { i18n } = useTranslation();
    const isIcelandic = i18n.language === 'is';

    const toggle = () => {
        const next = isIcelandic ? 'en' : 'is';
        i18n.changeLanguage(next);
        localStorage.setItem('utanvega-lang', next);
    };

    return (
        <Tooltip title={isIcelandic ? 'Switch to English' : 'Skipta yfir á íslensku'}>
            <IconButton onClick={toggle} size="small" sx={{ fontSize: '1.2rem' }}>
                {isIcelandic ? '🇬🇧' : '🇮🇸'}
            </IconButton>
        </Tooltip>
    );
}
