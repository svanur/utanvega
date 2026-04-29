import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Button } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';

const quotes = {
    is: [
        'Hvar eru allir?',
        'Bíðið eftir mér!',
        'Er ég villtur?',
        'Bíddu, úrið sagði mér að ...',
        'Hér er ekkert að sjá :/',
        'Er svona mikil þoka, eða?',
        'Ógurlegt geisp',
        'Oh, nú gekk ég of langt...',
        '???',
        'Ég sagði að við hefðum átt að beygja þarna áðan',
        'FÁÐUÞÉRBÍLHELV**#%&/ö(',
        'Hey, af hverju finnst þetta ekki?',
        'Meiri vitleysan.',
        'Ó, átti að hittast klukkan 6 EFTIR hádegi! :/',
        'Er ég of seinn?',
        'Hvar er ég?',
    ],
    en: [
        'Where is everyone?',
        'Wait for me!',
        'Am I lost?',
        'Wait, my watch told me to...',
        'Nothing to see here :/',
        'Is it really this foggy, or...?',
        '*Enormous yawn*',
        'Oh, I went too far...',
        '???',
        "I said we should've turned back there",
        'GETMEARIDEHELLL**#%&/ö(',
        "Hey, why can't I find this?",
        'What nonsense.',
        'Oh, the meetup was at 6 PM! :/',
        'Am I too late?',
        'Where am I?',
    ],
};

function LostRunnerSvg() {
    return (
        <svg
            viewBox="0 0 300 280"
            width="260"
            height="240"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            {/* Fog / misty background */}
            <defs>
                <radialGradient id="fog" cx="50%" cy="80%" r="60%">
                    <stop offset="0%" stopColor="#b0bec5" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#b0bec5" stopOpacity="0" />
                </radialGradient>
            </defs>
            <ellipse cx="150" cy="240" rx="140" ry="30" fill="url(#fog)" />

            {/* Ground with rough terrain */}
            <path
                d="M0 250 Q30 240 60 248 Q90 255 120 245 Q150 238 180 248 Q210 258 240 245 Q270 238 300 250 V280 H0Z"
                fill="#7c9a5e"
                opacity="0.6"
            />

            {/* Distant foggy mountains */}
            <path
                d="M-10 250 L40 180 L70 210 L110 160 L150 200 L190 150 L230 200 L270 175 L310 250Z"
                fill="#90a4ae"
                opacity="0.25"
            />

            {/* Broken trail sign post */}
            <rect x="60" y="140" width="5" height="110" fill="#8d6e63" rx="1" />
            <rect
                x="50" y="130" width="50" height="22" rx="3"
                fill="#a1887f" stroke="#6d4c41" strokeWidth="1"
                transform="rotate(12 75 141)"
            />
            <text
                x="75" y="146"
                textAnchor="middle"
                fontSize="9"
                fill="#4e342e"
                fontWeight="bold"
                transform="rotate(12 75 141)"
            >
                ???
            </text>

            {/* Runner body - confused pose, scratching head */}
            {/* Left leg (standing) */}
            <line x1="168" y1="210" x2="162" y2="245" stroke="#37474f" strokeWidth="5" strokeLinecap="round" />
            {/* Right leg (slightly lifted, uncertain) */}
            <line x1="178" y1="210" x2="188" y2="240" stroke="#37474f" strokeWidth="5" strokeLinecap="round" />
            {/* Shoes */}
            <ellipse cx="160" cy="247" rx="8" ry="4" fill="#e65100" />
            <ellipse cx="190" cy="242" rx="8" ry="4" fill="#e65100" />

            {/* Torso */}
            <line x1="173" y1="175" x2="173" y2="212" stroke="#1565c0" strokeWidth="8" strokeLinecap="round" />

            {/* Left arm (hand on hip, frustrated) */}
            <path d="M173 185 L155 198 L158 210" fill="none" stroke="#ffb74d" strokeWidth="4" strokeLinecap="round" />
            {/* Right arm (scratching head) */}
            <path d="M173 185 L192 175 L195 160" fill="none" stroke="#ffb74d" strokeWidth="4" strokeLinecap="round" />

            {/* Head */}
            <circle cx="173" cy="157" r="16" fill="#ffcc80" />
            {/* Running cap */}
            <path d="M157 153 Q173 142 189 153" fill="#e65100" />
            <rect x="157" y="150" width="32" height="4" rx="2" fill="#e65100" />
            <rect x="183" y="148" width="14" height="5" rx="2" fill="#bf360c" />

            {/* Confused face */}
            {/* Eyes - one squinting, one wide */}
            <circle cx="167" cy="158" r="2.5" fill="#37474f" />
            <ellipse cx="179" cy="157" rx="3" ry="3.5" fill="#37474f" />
            {/* Raised eyebrow */}
            <path d="M175 151 Q179 147 184 151" fill="none" stroke="#5d4037" strokeWidth="1.5" />
            {/* Confused mouth - wavy */}
            <path d="M165 168 Q170 165 173 168 Q176 171 181 168" fill="none" stroke="#5d4037" strokeWidth="1.5" strokeLinecap="round" />

            {/* Sweat drop */}
            <path d="M190 150 Q192 144 194 150 Q192 153 190 150Z" fill="#64b5f6" opacity="0.8">
                <animate
                    attributeName="opacity"
                    values="0.8;0.3;0.8"
                    dur="2s"
                    repeatCount="indefinite"
                />
            </path>

            {/* Question marks floating */}
            <text x="200" y="135" fontSize="18" fill="#78909c" fontWeight="bold">
                ?
                <animate
                    attributeName="y"
                    values="135;128;135"
                    dur="2.5s"
                    repeatCount="indefinite"
                />
                <animate
                    attributeName="opacity"
                    values="0.8;0.4;0.8"
                    dur="2.5s"
                    repeatCount="indefinite"
                />
            </text>
            <text x="215" y="125" fontSize="14" fill="#90a4ae" fontWeight="bold">
                ?
                <animate
                    attributeName="y"
                    values="125;120;125"
                    dur="3s"
                    repeatCount="indefinite"
                />
                <animate
                    attributeName="opacity"
                    values="0.6;0.2;0.6"
                    dur="3s"
                    repeatCount="indefinite"
                />
            </text>

            {/* Crumpled map on the ground */}
            <rect
                x="200" y="238" width="18" height="13" rx="1"
                fill="#fff9c4" stroke="#c9b037" strokeWidth="0.5"
                transform="rotate(-8 209 244)"
            />
            <line x1="203" y1="241" x2="213" y2="241" stroke="#a1887f" strokeWidth="0.5" transform="rotate(-8 209 244)" />
            <line x1="203" y1="244" x2="211" y2="244" stroke="#a1887f" strokeWidth="0.5" transform="rotate(-8 209 244)" />
        </svg>
    );
}

export default function LostRunner({ message, buttonLabel, onBack }: {
    message?: string;
    buttonLabel?: string;
    onBack?: () => void;
}) {
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
            <LostRunnerSvg />

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
                {message ?? t('trail.notFound')}
            </Typography>

            <Button
                variant="contained"
                startIcon={<HomeIcon />}
                onClick={() => onBack ? onBack() : navigate('/')}
                sx={{ mt: 3, borderRadius: 3, textTransform: 'none', px: 3 }}
            >
                {buttonLabel ?? t('trail.backToTrails')}
            </Button>
        </Box>
    );
}
