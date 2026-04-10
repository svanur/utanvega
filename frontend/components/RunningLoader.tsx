import { useState } from 'react';
import { Box, Typography, keyframes } from '@mui/material';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import { useTranslation } from 'react-i18next';

const bounce = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
`;

const dust = keyframes`
  0% { opacity: 0.6; transform: scale(1); }
  100% { opacity: 0; transform: scale(2); }
`;

const loadingMessages = {
    is: [
        'Hleð leiðum...',
        'Sveiflum fótum...',
        'Sveiflum höndum...',
        'Teygjum smá...',
        'Drögum andann djúpt...',
        'Bindum skóreimar...',
        'Hoppum á staðnum...',
        'Rólegt skokk...',
        'Af stað...',
        'Ég fer á mínum hraða.',
        'Þessi æfing skiptir máli.',
        'Ég er hér...',
        'Eitt skref í einu.',
        'Andardrátturinn minn er stöðugur.',
        'Ég er örugg í líkama mínum.',
        'Ég þarf ekki að flýta mér.',
        'Ég get haldið áfram...',
        'Í dag er nóg að mæta.',
        'Ég sleppi því sem ég þarf ekki.',
        'Ég treysti líkama mínum.',
        'Ég get...',
        'Þessi stund mun líða hjá.',
        'Ég vel samúð fram yfir gagnrýni.',
        'Ég er að gera mitt besta.',
        'Framfarir geta verið hljóðlátar.',
    ],
    en: [
        'Loading trails...',
        'Swinging legs...',
        'Swinging arms...',
        'Stretching a little...',
        'Breathing deeply...',
        'Tying shoelaces...',
        'Jumping in place...',
        'Easy jogging...',
        "Let's go...",
        "I am allowed to go at my own pace.",
        "This effort counts.",
        "I can be here with this feeling.",
        "One step is enough right now.",
        "My breath is steady.",
        "I am safe in my body.",
        "I don’t have to rush healing.",
        "I can keep going, gently.",
        "Today, showing up is enough.",
        "I release what I don’t need.",
        "I trust my body.",
        "I am not broken.",
        "This moment will pass.",
        "I choose compassion over criticism.",
        "I am doing the best I can.",
        "Progress can be quiet.",
        "I am allowed to slow down.",
        "I carry strength I don’t always see.",
        "Same place, different pace."
    ],
};

export default function RunningLoader({ message }: { message?: string }) {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith('is') ? 'is' : 'en';
  const [index] = useState(() => Math.floor(Math.random() * loadingMessages.en.length));
  const text = message ?? loadingMessages[lang][index];

  return (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" gap={1.5} py={2}>
      <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'flex-end' }}>
        <DirectionsRunIcon
          sx={{
            fontSize: 48,
            color: 'primary.main',
            animation: `${bounce} 0.6s ease-in-out infinite`,
          }}
        />
        {/* Dust particles */}
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              bottom: 2,
              left: -4 - i * 8,
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: 'text.disabled',
              animation: `${dust} 0.8s ease-out infinite`,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </Box>
      <Typography variant="body2" color="text.secondary">
        {text}
      </Typography>
    </Box>
  );
}
