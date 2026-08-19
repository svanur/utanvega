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
        "Hleð leiðum...",
        "Sveiflum fótum...",
        "Sveiflum höndum...",
        "Teygjum smá...",
        "Drögum andann djúpt...",
        "Bindum skóreimar...",
        "Hoppum á staðnum...",
        "Rólegt skokk...",
        "Af stað...",
        "Ég fer á mínum hraða.",
        "Þessi æfing skiptir máli.",
        "Ég er hér...",
        "Mæting er bæting...",
        "Við stöndum þétt saman...",
        "Stöðugleiki skiptir máli...",
        "Hlusta á líkamann...",
        "Eitt skref í einu.",
        "Andardrátturinn minn er stöðugur.",
        "Ég er örugg í líkama mínum.",
        "Ég þarf ekki að flýta mér.",
        "Ég get haldið áfram...",
        "Í dag er nóg að mæta.",
        "Ég sleppi því sem ég þarf ekki.",
        "Ég treysti líkama mínum.",
        "Ég get...",
        "Þessi stund mun líða hjá.",
        "Ég vel samúð fram yfir gagnrýni.",
        "Ég er að gera mitt besta.",
        "Framfarir geta verið hljóðlátar.",
        "Leggjumst í grasið og jarðtengjum.",
        "Ást er ...að fara í fjallgöngu saman.",
        "Ást er ...að fara út að hlaupa saman.",
        "Anda inn ...anda út",
        "Skoða veðurspána í síðasta sinn...",
        "Hugsandi hvort stullurnar séu of stuttar...",
        "Fylla upp vatnsflöskuna...",
        "Er gel í brjóstvasa?",
        "Þessi hæð virtist minni á kortinu.",
        "Leðja er náttúruleg spa meðferð.",
        "Horfðu ekki á toppinn.",
        "Stígurinn hlustar ekki á afsakanir.",
        "Ég geymi sprettinn þangað til einhver er að horfa :)",
        "Síðasti kílómetrinn lýgur alltaf.",
        "Fæturnir sögðu nei. Ég sagði já. Við sættumst.",
        "Sársaukinn er tímabundinn. Strava er að eilífu.",
        "Hleyp frá vandamálum mínum (það virkar).",
        "Sérhver kílómetri segir sögu.",
        "Það þarf ekki að vera hratt til að vera gott.",
        "Garmin mælir skrefin. Hjartað mælir ferðina.",
        "Meira er ekki alltaf betra",
        "Kílómetrafjöldi er konungur...",
        "Kílómetrafjöldi er drottning...",
        "Sko! Það fer eftir ýmsu...",
        "Minna er meira...",
        "Þetta er ekki rok, þetta er mótstöðuþjálfun.",
        "Gluggaveður — förum samt út.",
        "Fjórar árstíðir á einum kílómetra.",
        "Vindurinn er í móti. Báðar leiðir.",
        "Slydda byggir karakter.",
        "Sést Esjan? Þá fer að rigna.",
        "Þetta reddast..",
        "Kindurnar vita bestu leiðina.",
        "Kindagötur eru bestu göturnar.",
        "Mosinn man hvert skref. Stígðu létt.",
        "Miðnætursólin telur ekki tímann.",
        "Áin var grynnri á kortinu.",
        "Vaðið er hluti af leiðinni.",
        "Malarvegur telst utanvega. Tæknilega.",
        "Hvíld er líka þjálfun.",
        "Það er í lagi að fara hægt í dag.",
        "Hægar framfarir eru samt framfarir.",
        "Enginn kílómetri er tilgangslaus.",
        "Andardrátturinn kemur alltaf aftur.",
        "Fjallið er ekki í keppni við mig.",
        "Líkaminn minn er ekki verkefni sem þarf að leysa.",
        "Ég hleyp af því ég vil, ekki af því ég verð.",
        "Erfiðasta brekkan er útihurðin.",
        "Klukkan segir 5 km. Fæturnir segja 15.",
        "Rafhlaðan: 12%. Bjartsýnin: 100%.",
        "Gelið er alltaf í hinum vasanum.",
        "Það er alltaf einn steinn sem finnur skóinn.",
        "Blöðrur eru bara minjagripir.",
        "Njóttu brekkunnar niður í mót — hún er gjöf.",
        "Nýir skór gera mig hraðari. Þetta eru vísindi.",
        "Að ganga upp brekkuna er líka hlaup.",
        "Enginn spyr um tímann í brekkunni.",
        "Enginn iðrast þess að hafa farið út.",
        "Kaffi fyrir, kleina eftir.",
        "Heiti potturinn er endamarkið.",
        "Sundlaugin bíður.",
        "Nýtt skópar í dag, kemur skapinu í lag..."
    ],
    en: [
        "Loading trails...",
        "Swinging legs...",
        "Swinging arms...",
        "Stretching a little...",
        "Breathing deeply...",
        "Tying shoelaces...",
        "Jumping in place...",
        "Easy jogging...",
        "Let's go...",
        "I am allowed to go at my own pace.",
        "This effort counts.",
        "I can be here with this feeling.",
        "One step is enough right now.",
        "My breath is steady.",
        "I am safe in my body.",
        "I don't have to rush healing.",
        "I can keep going, gently.",
        "Today, showing up is enough.",
        "I release what I don't need.",
        "I trust my body.",
        "I am not broken.",
        "This moment will pass.",
        "I choose compassion over criticism.",
        "I am doing the best I can.",
        "Progress can be quiet.",
        "I am allowed to slow down.",
        "I carry strength I don't always see.",
        "Same place, different pace.",
        "Your Garmin isn't mean, it's just honest.",
        "Balanced HRV is hotter than a fast mile.",
        "You don't stretch enough.",
        "Take rest day and touch some grass.",
        "Mental health is fitness too",
        "Love is ...go hiking together.",
        "Love is ...go running together.",
        "Breathe in ...breathe out.",
        "Checking the forecast one last time...",
        "Debating whether the shorts are too short.",
        "Filling the water bottle...",
        "Checking for gels...",
        "That hill looked smaller on the map.",
        "Mud is just nature's spa treatment.",
        "Don't look at the top.",
        "The trail doesn't care about excuses.",
        "Saving the sprint for when someone is watching.",
        "The last km always lies.",
        "My legs said no. I said yes. We compromised.",
        "The pain is temporary. The Strava segment is forever.",
        "Running from my problems (it's working).",
        "Every km tells a story.",
        "It doesn't have to be fast to be good.",
        "Garmin counts the steps. The heart counts the journey.",
        "More is not always better",
        "Mileage is King...",
        "Mileage is Queen...",
        "It depends...",
        "Less is more...",
        "Go slow to go fast...",
        "That's not wind, that's resistance training.",
        "Looks lovely through the window. Going out anyway.",
        "Four seasons in one kilometre.",
        "The wind is against you. Both ways.",
        "Sleet builds character.",
        "Can you see Esja? Then it's about to rain.",
        "It'll all work out... 'Þetta reddast'",
        "The sheep know the best line.",
        "Sheep paths are the original singletrack.",
        "The moss remembers every step. Tread lightly.",
        "The midnight sun doesn't keep time.",
        "The river looked shallower on the map.",
        "The crossing is part of the route.",
        "Gravel counts as trail. Technically.",
        "Rest is training too.",
        "It's okay to be slow today.",
        "Slow progress is still progress.",
        "No kilometre is wasted.",
        "The breath always comes back.",
        "The mountain isn't competing with me.",
        "My body is not a problem to be solved.",
        "I run because I want to, not because I must.",
        "The steepest hill is the front door.",
        "Watch says 5 km. Legs say 15.",
        "Battery: 12%. Optimism: 100%.",
        "The gel is always in the other pocket.",
        "There's always one stone that finds your shoe.",
        "Blisters are just souvenirs.",
        "Take the downhill. It's a gift.",
        "New shoes make me faster. That's science.",
        "Walking the hill still counts as running.",
        "Nobody asks about your uphill split.",
        "Nobody ever regretted going out.",
        "Coffee before, kleina after.",
        "The hot tub is the finish line.",
        "The pool is waiting."
    ],
};

export default function RunningLoader({ message }: { message?: string }) {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith('is') ? 'is' : 'en';
  const [index] = useState(() => Math.floor(Math.random() * loadingMessages[lang].length));
  // Modulo keeps this in range if the two lists drift apart in length, or the language changes after mount.
  const text = message ?? loadingMessages[lang][index % loadingMessages[lang].length];

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
