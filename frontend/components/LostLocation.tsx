import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Button } from '@mui/material';
import ExploreIcon from '@mui/icons-material/Explore';

const quotes = {
    is: [
        'Þessi staður er horfinn af kortinu...',
        'Áttavitinn segir nei.',
        'Er þetta Bermúdaþríhyrningurinn?',
        'Hér var eitthvað... einu sinni.',
        'GPS-ið mitt er í ruglinu.',
        'Ég er viss um að þetta var hér áðan!',
        'Kortið lýgur!',
        'Jörðin gleypti þetta!',
        'Bíddu, ég er að reikna...',
        'Þetta er ekki á neinu korti sem ég þekki.',
        'Hvar í ósköpunum...?',
        'Staðurinn brást mér.',
        'Ég sé ekki alveg nógu vel á úrið.',
        'Ég VERÐ að fá mér nýtt úr.',
        'Hvað meinarðu, svaf ég ekki nógu vel?',
        'UNPRODUCTIVE',
    ],
    en: [
        'This place has vanished from the map...',
        'The compass says no.',
        'Is this the Bermuda Triangle?',
        'There was something here... once.',
        'My GPS is confused.',
        "I'm sure this was here before!",
        'The map is lying!',
        'The earth swallowed it!',
        'Hold on, I\'m calculating...',
        "This isn't on any map I know.",
        'Where on earth...?',
        'The location failed me.',
        'I cant see clearly where I am.',
        'I MUST get a new watch.',
        'What do you mean? I didn\'t sleep well enough?',
        'UNPRODUCTIVE',
    ],
};

function LostMapPinSvg() {
    return (
        <svg
            viewBox="0 0 300 280"
            width="260"
            height="240"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            {/* Misty background */}
            <defs>
                <radialGradient id="locFog" cx="50%" cy="80%" r="60%">
                    <stop offset="0%" stopColor="#b0bec5" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#b0bec5" stopOpacity="0" />
                </radialGradient>
            </defs>
            <ellipse cx="150" cy="240" rx="140" ry="30" fill="url(#locFog)" />

            {/* Ground */}
            <path
                d="M0 250 Q50 242 100 248 Q150 254 200 245 Q250 238 300 250 V280 H0Z"
                fill="#7c9a5e"
                opacity="0.5"
            />

            {/* Torn/crumpled map background */}
            <rect
                x="85" y="195" width="55" height="40" rx="2"
                fill="#fff9c4" stroke="#c9b037" strokeWidth="0.8"
                transform="rotate(-5 112 215)"
                opacity="0.8"
            />
            <line x1="92" y1="205" x2="130" y2="205" stroke="#a1887f" strokeWidth="0.5" transform="rotate(-5 112 215)" />
            <line x1="92" y1="211" x2="125" y2="211" stroke="#a1887f" strokeWidth="0.5" transform="rotate(-5 112 215)" />
            <line x1="92" y1="217" x2="128" y2="217" stroke="#a1887f" strokeWidth="0.5" transform="rotate(-5 112 215)" />

            {/* Giant sad map pin - tilted and broken */}
            {/* Pin body */}
            <g transform="translate(150, 100) rotate(12)">
                {/* Pin head (circle) */}
                <circle cx="0" cy="0" r="40" fill="#ef5350" stroke="#c62828" strokeWidth="2" />
                <circle cx="0" cy="0" r="20" fill="#ffcdd2" />

                {/* Crack across the pin */}
                <path d="M-15 -10 L-5 5 L5 -8 L15 10" fill="none" stroke="#c62828" strokeWidth="2" strokeLinecap="round" />

                {/* Pin point - broken off */}
                <path d="M-12 38 L0 70 L12 38" fill="#ef5350" stroke="#c62828" strokeWidth="2" />
                {/* Break line */}
                <path d="M8 55 L14 52" stroke="#c62828" strokeWidth="1.5" strokeLinecap="round" />

                {/* Sad face on pin */}
                {/* Eyes - X marks */}
                <g transform="translate(-10, -5)">
                    <line x1="-4" y1="-4" x2="4" y2="4" stroke="#b71c1c" strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="4" y1="-4" x2="-4" y2="4" stroke="#b71c1c" strokeWidth="2.5" strokeLinecap="round" />
                </g>
                <g transform="translate(10, -5)">
                    <line x1="-4" y1="-4" x2="4" y2="4" stroke="#b71c1c" strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="4" y1="-4" x2="-4" y2="4" stroke="#b71c1c" strokeWidth="2.5" strokeLinecap="round" />
                </g>
                {/* Frown */}
                <path d="M-12 12 Q0 5 12 12" fill="none" stroke="#b71c1c" strokeWidth="2.5" strokeLinecap="round" />
            </g>

            {/* Floating question marks */}
            <text x="210" y="75" fontSize="22" fill="#78909c" fontWeight="bold">
                ?
                <animate attributeName="y" values="75;67;75" dur="2.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2.5s" repeatCount="indefinite" />
            </text>
            <text x="230" y="90" fontSize="16" fill="#90a4ae" fontWeight="bold">
                ?
                <animate attributeName="y" values="90;84;90" dur="3s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0.2;0.6" dur="3s" repeatCount="indefinite" />
            </text>

            {/* Compass spinning on the ground */}
            <g transform="translate(220, 230)">
                <circle cx="0" cy="0" r="12" fill="#eceff1" stroke="#78909c" strokeWidth="1" />
                <line x1="0" y1="-8" x2="0" y2="8" stroke="#e53935" strokeWidth="1.5">
                    <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="0 0 0" to="360 0 0"
                        dur="4s"
                        repeatCount="indefinite"
                    />
                </line>
                <circle cx="0" cy="0" r="2" fill="#78909c" />
            </g>

            {/* Small "X marks the spot" dashes scattered */}
            <g opacity="0.4">
                <text x="70" y="180" fontSize="16" fill="#8d6e63" fontWeight="bold">✕</text>
                <text x="240" y="200" fontSize="12" fill="#8d6e63" fontWeight="bold">✕</text>
                <text x="55" y="230" fontSize="10" fill="#8d6e63" fontWeight="bold">✕</text>
            </g>
        </svg>
    );
}

export default function LostLocation() {
    const navigate = useNavigate();
    const { i18n, t } = useTranslation();

    const lang = i18n.language.startsWith('is') ? 'is' : 'en';
    const [index] = useState(() => Math.floor(Math.random() * quotes.en.length));
    const quote = quotes[lang][index];

    return (
        <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            textAlign="center"
            sx={{ mt: { xs: 2, sm: 4 }, px: 2, minHeight: '50vh' }}
        >
            <LostMapPinSvg />

            <Typography
                variant="h5"
                sx={{
                    mt: 2,
                    fontStyle: 'italic',
                    color: 'text.secondary',
                    fontWeight: 500,
                    maxWidth: 400,
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
                {t('locations.locationNotFound')}
            </Typography>

            <Button
                variant="contained"
                startIcon={<ExploreIcon />}
                onClick={() => navigate('/locations')}
                sx={{ mt: 3, borderRadius: 3, textTransform: 'none', px: 3 }}
            >
                {t('locations.backToLocations')}
            </Button>
        </Box>
    );
}
