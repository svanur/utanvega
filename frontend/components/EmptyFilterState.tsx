import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Button } from '@mui/material';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';

const quotes = {
    is: [
        'Engin leið fannst... prófaðu aftur!',
        'Hmm, of mikil síun!',
        'Þetta er ekki nóg!',
        'Ekkert hér sem passar...',
        'Prófaðu aðra blöndu!',
        'Ég fann ekkert :(',
        'Viltu breyta leitinni?',
        'Tómt! Engin leið passar.',
        'Eins og að leita að nál í heystakki...',
        'Þessar síur eru of krefjandi!',
        'GELIÐ ER BÚIÐ!',
        'Er ég villtur! Einmana...',
    ],
    en: [
        'No trails found... try again!',
        'Hmm, too many filters!',
        "That's too strict!",
        "Nothing here that fits...",
        'Try a different combo!',
        'I found nothing :(',
        'Wanna tweak the filters?',
        'Empty! No trail matches.',
        'Like finding a needle in a haystack...',
        'These filters are too demanding!',
        'NOOO... OUT OF GELS!',
        'I am lost and lonely...'
    ],
};

function EmptyFilterSvg() {
    return (
        <svg
            viewBox="0 0 260 220"
            width="220"
            height="185"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            {/* Soft ground */}
            <ellipse cx="130" cy="195" rx="110" ry="15" fill="#e0e0e0" opacity="0.3" />

            {/* Runner sitting on the ground, bored */}
            {/* Legs - stretched out */}
            <line x1="115" y1="170" x2="85" y2="190" stroke="#37474f" strokeWidth="5" strokeLinecap="round" />
            <line x1="125" y1="170" x2="100" y2="195" stroke="#37474f" strokeWidth="5" strokeLinecap="round" />
            {/* Shoes */}
            <ellipse cx="82" cy="192" rx="8" ry="4" fill="#e65100" />
            <ellipse cx="97" cy="197" rx="8" ry="4" fill="#e65100" />

            {/* Torso - slightly leaning back */}
            <line x1="120" y1="140" x2="120" y2="172" stroke="#1565c0" strokeWidth="8" strokeLinecap="round" />

            {/* Left arm - propping up */}
            <path d="M120 155 L140 170 L150 180" fill="none" stroke="#ffb74d" strokeWidth="4" strokeLinecap="round" />
            {/* Right arm - chin resting on hand */}
            <path d="M120 148 L105 140 L102 130" fill="none" stroke="#ffb74d" strokeWidth="4" strokeLinecap="round" />

            {/* Head */}
            <circle cx="108" cy="118" r="15" fill="#ffcc80" />
            {/* Running cap */}
            <path d="M93 114 Q108 105 123 114" fill="#e65100" />
            <rect x="93" y="112" width="30" height="4" rx="2" fill="#e65100" />
            <rect x="88" y="110" width="12" height="5" rx="2" fill="#bf360c" />

            {/* Bored face */}
            {/* Half-closed eyes */}
            <line x1="101" y1="118" x2="107" y2="118" stroke="#37474f" strokeWidth="2" strokeLinecap="round" />
            <line x1="111" y1="118" x2="117" y2="118" stroke="#37474f" strokeWidth="2" strokeLinecap="round" />
            {/* Flat mouth */}
            <line x1="103" y1="126" x2="114" y2="126" stroke="#5d4037" strokeWidth="1.5" strokeLinecap="round" />

            {/* Empty magnifying glass */}
            <g transform="translate(170, 95)">
                <circle cx="0" cy="0" r="28" fill="none" stroke="#78909c" strokeWidth="3" />
                <circle cx="0" cy="0" r="22" fill="#f5f5f5" opacity="0.5" />
                <line x1="20" y1="20" x2="38" y2="38" stroke="#78909c" strokeWidth="4" strokeLinecap="round" />
                {/* "X" inside the glass */}
                <line x1="-8" y1="-8" x2="8" y2="8" stroke="#ef5350" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
                <line x1="8" y1="-8" x2="-8" y2="8" stroke="#ef5350" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
            </g>

            {/* Tumbleweeds / dots floating */}
            <circle cx="50" cy="180" r="3" fill="#a1887f" opacity="0.4">
                <animate attributeName="cx" values="50;70;50" dur="6s" repeatCount="indefinite" />
            </circle>
            <circle cx="200" cy="185" r="2" fill="#a1887f" opacity="0.3">
                <animate attributeName="cx" values="200;180;200" dur="5s" repeatCount="indefinite" />
            </circle>

            {/* ZZZ - bored/sleepy */}
            <text x="125" y="105" fontSize="10" fill="#90a4ae" fontWeight="bold">
                z
                <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite" />
            </text>
            <text x="133" y="96" fontSize="12" fill="#90a4ae" fontWeight="bold">
                z
                <animate attributeName="opacity" values="0.6;0.1;0.6" dur="2.5s" repeatCount="indefinite" />
            </text>
            <text x="142" y="85" fontSize="14" fill="#90a4ae" fontWeight="bold">
                z
                <animate attributeName="opacity" values="0.4;0;0.4" dur="3s" repeatCount="indefinite" />
            </text>
        </svg>
    );
}

interface EmptyFilterStateProps {
    onClearFilters: () => void;
    hasActiveFilters: boolean;
    searchQuery?: string;
}

export default function EmptyFilterState({ onClearFilters, hasActiveFilters, searchQuery }: EmptyFilterStateProps) {
    const { i18n, t } = useTranslation();

    const lang = i18n.language.startsWith('is') ? 'is' : 'en';
    const [index] = useState(() => Math.floor(Math.random() * quotes.en.length));

    const isOriginals = searchQuery?.toLowerCase().trim() === 'hin upprunalegu';
    const quote = isOriginals
        ? (lang === 'is' ? 'Sjáið, þarna eru hin upprunalegu...' : 'You are awesome, but...')
        : quotes[lang][index];

    return (
        <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            textAlign="center"
            sx={{ py: { xs: 3, sm: 5 }, px: 2 }}
        >
            <EmptyFilterSvg />

            <Typography
                variant="h6"
                sx={{
                    mt: 2,
                    fontStyle: 'italic',
                    color: 'text.secondary',
                    fontWeight: 500,
                    maxWidth: 350,
                    lineHeight: 1.4,
                }}
            >
                &ldquo;{quote}&rdquo;
            </Typography>

            <Typography
                variant="body2"
                color="text.disabled"
                sx={{ mt: 1 }}
            >
                {hasActiveFilters ? t('home.noTrailsMatch') : t('home.noTrailsFound')}
            </Typography>

            {hasActiveFilters && (
                <Button
                    variant="outlined"
                    startIcon={<FilterListOffIcon />}
                    onClick={onClearFilters}
                    sx={{ mt: 2, borderRadius: 3, textTransform: 'none', px: 3 }}
                >
                    {t('home.clearFilters')}
                </Button>
            )}
        </Box>
    );
}
