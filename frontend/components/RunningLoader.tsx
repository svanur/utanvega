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

// One entry per message, both languages together — so the two can never drift apart.
// Adding a message means adding one line with both translations.
const loadingMessages: { is: string; en: string }[] = [
    // Warming up
    { is: "Hleð leiðum...", en: "Loading trails..." },
    { is: "Sveiflum fótum...", en: "Swinging legs..." },
    { is: "Sveiflum höndum...", en: "Swinging arms..." },
    { is: "Teygjum smá...", en: "Stretching a little..." },
    { is: "Drögum andann djúpt...", en: "Breathing deeply..." },
    { is: "Bindum skóreimar...", en: "Tying shoelaces..." },
    { is: "Hoppum á staðnum...", en: "Jumping in place..." },
    { is: "Rólegt skokk...", en: "Easy jogging..." },
    { is: "Af stað...", en: "Let's go..." },

    // Before heading out
    { is: "Skoða veðurspána í síðasta sinn...", en: "Checking the forecast one last time..." },
    { is: "Hugsandi hvort stullurnar séu of stuttar...", en: "Debating whether the shorts are too short." },
    { is: "Fylla upp vatnsflöskuna...", en: "Filling the water bottle..." },
    { is: "Er gel í brjóstvasa?", en: "Checking for gels..." },
    { is: "Bíðum eftir GPS-merkinu...", en: "Waiting for the GPS signal..." },

    // Mindful
    { is: "Halló, þú stendur þig vel :)", en: "Hello, you're doing great :)" },
    { is: "Ég fer á mínum hraða.", en: "I am allowed to go at my own pace." },
    { is: "Þessi æfing skiptir máli.", en: "This effort counts." },
    { is: "Ég er hér...", en: "I can be here with this feeling." },
    { is: "Eitt skref í einu.", en: "One step is enough right now." },
    { is: "Andardrátturinn minn er stöðugur.", en: "My breath is steady." },
    { is: "Ég er örugg í líkama mínum.", en: "I am safe in my body." },
    { is: "Ég treysti líkama mínum.", en: "I trust my body." },
    { is: "Ég þarf ekki að flýta mér.", en: "I am allowed to slow down." },
    { is: "Ég þarf ekki að flýta lækningunni.", en: "I don't have to rush healing." },
    { is: "Ég get haldið áfram...", en: "I can keep going, gently." },
    { is: "Ég get...", en: "I can..." },
    { is: "Í dag er nóg að mæta.", en: "Today, showing up is enough." },
    { is: "Mæting er bæting...", en: "Showing up is levelling up..." },
    { is: "Ég sleppi því sem ég þarf ekki.", en: "I release what I don't need." },
    { is: "Þessi stund mun líða hjá.", en: "This moment will pass." },
    { is: "Ég vel samúð fram yfir gagnrýni.", en: "I choose compassion over criticism." },
    { is: "Ég er að gera mitt besta.", en: "I am doing the best I can." },
    { is: "Framfarir geta verið hljóðlátar.", en: "Progress can be quiet." },
    { is: "Það er ekkert brotið í mér.", en: "I am not broken." },
    { is: "Ég ber styrk sem ég sé ekki alltaf.", en: "I carry strength I don't always see." },
    { is: "Stöðugleiki skiptir máli...", en: "Consistency matters..." },
    { is: "Við stöndum þétt saman...", en: "We stand close together..." },
    { is: "Hlusta á líkamann...", en: "Listening to the body..." },
    { is: "Sami staður, annar hraði.", en: "Same place, different pace." },
    { is: "Andleg heilsa er líka þjálfun", en: "Mental health is fitness too" },
    { is: "Hvíld er líka þjálfun.", en: "Rest is training too." },
    { is: "Það er í lagi að fara hægt í dag.", en: "It's okay to be slow today." },
    { is: "Hægar framfarir eru samt framfarir.", en: "Slow progress is still progress." },
    { is: "Enginn kílómetri er tilgangslaus.", en: "No kilometre is wasted." },
    { is: "Andardrátturinn kemur alltaf aftur.", en: "The breath always comes back." },
    { is: "Fjallið er ekki í keppni við mig.", en: "The mountain isn't competing with me." },
    { is: "Líkaminn minn er ekki verkefni sem þarf að leysa.", en: "My body is not a problem to be solved." },
    { is: "Ég hleyp af því ég vil, ekki af því ég verð.", en: "I run because I want to, not because I must." },
    { is: "Leggjumst í grasið og jarðtengjum.", en: "Take rest day and touch some grass." },
    { is: "Anda inn ...anda út", en: "Breathe in ...breathe out." },
    { is: "Ást er ...að fara í fjallgöngu saman.", en: "Love is ...go hiking together." },
    { is: "Ást er ...að fara út að hlaupa saman.", en: "Love is ...go running together." },

    // Trail truths
    { is: "Þessi hæð virtist minni á kortinu.", en: "That hill looked smaller on the map." },
    { is: "Leðja er náttúruleg spa meðferð.", en: "Mud is just nature's spa treatment." },
    { is: "Horfðu ekki á toppinn.", en: "Don't look at the top." },
    { is: "Stígurinn hlustar ekki á afsakanir.", en: "The trail doesn't care about excuses." },
    { is: "Ég geymi sprettinn þangað til einhver er að horfa :)", en: "Saving the sprint for when someone is watching." },
    { is: "Síðasti kílómetrinn lýgur alltaf.", en: "The last km always lies." },
    { is: "Fæturnir sögðu nei. Ég sagði já. Við sættumst.", en: "My legs said no. I said yes. We compromised." },
    { is: "Sársaukinn er tímabundinn. Strava er að eilífu.", en: "The pain is temporary. The Strava segment is forever." },
    { is: "Hleyp frá vandamálum mínum (það virkar).", en: "Running from my problems (it's working)." },
    { is: "Sérhver kílómetri segir sögu.", en: "Every km tells a story." },
    { is: "Það þarf ekki að vera hratt til að vera gott.", en: "It doesn't have to be fast to be good." },
    { is: "Garmin mælir skrefin. Hjartað mælir ferðina.", en: "Garmin counts the steps. The heart counts the journey." },
    { is: "Garminn er ekki vondur, hann er bara hreinskilinn.", en: "Your Garmin isn't mean, it's just honest." },
    { is: "Stöðugt HRV er meira sexí en hraður kílómetri.", en: "Balanced HRV is hotter than a fast mile." },
    { is: "Þú teygir ekki nóg.", en: "You don't stretch enough." },
    { is: "Meira er ekki alltaf betra", en: "More is not always better" },
    { is: "Kílómetrafjöldi er konungur...", en: "Mileage is King..." },
    { is: "Kílómetrafjöldi er drottning...", en: "Mileage is Queen..." },
    { is: "Sko! Það fer eftir ýmsu...", en: "It depends..." },
    { is: "Minna er meira...", en: "Less is more..." },
    { is: "Farðu hægt til að fara hratt...", en: "Go slow to go fast..." },
    { is: "Planið! Planið er einfalt...", en: "The plan! The plan is simple..." },
    { is: "Byrjum rólega ...og hægjum svo á.", en: "Start out easy ...then slow down." },

    // Icelandic weather & nature
    { is: "Þetta er ekki rok, þetta er mótstöðuþjálfun.", en: "That's not wind, that's resistance training." },
    { is: "Gluggaveður — förum samt út.", en: "Looks lovely through the window. Going out anyway." },
    { is: "Fjórar árstíðir á einum kílómetra.", en: "Four seasons in one kilometre." },
    { is: "Mótvindur! Báðar leiðir.", en: "The wind is against you. Both ways." },
    { is: "Vindur er bara gola að flýta sér", en: "Wind is just a breeze in a hurry" },
    { is: "Vindurinn snerist. Auðvitað.", en: "The wind turned. Of course." },
    { is: "Það er ekki til vont veður, bara vondur fatnaður.", en: "There's no bad weather, only bad clothing." },
    { is: "Slydda byggir karakter.", en: "Sleet builds character." },
    { is: "Þokan gerir alla stíga nýja.", en: "Fog makes every trail new." },
    { is: "Sést Esjan? Þá fer að rigna.", en: "Can you see Esja? Then it's about to rain." },
    { is: "Þetta reddast..", en: "It'll all work out... 'Þetta reddast'" },
    { is: "Kindurnar vita bestu leiðina.", en: "The sheep know the best line." },
    { is: "Kindagötur eru bestu göturnar.", en: "Sheep paths are the original singletrack." },
    { is: "Krían ræður leiðinni í júní.", en: "In June, the arctic tern decides the route." },
    { is: "Hestarnir hlaupa með þér að girðingunni.", en: "The horses will race you to the fence." },
    { is: "Mosinn man hvert skref. Stígðu létt.", en: "The moss remembers every step. Tread lightly." },
    { is: "Miðnætursólin telur ekki tímann.", en: "The midnight sun doesn't keep time." },
    { is: "Áin var grynnri á kortinu.", en: "The river looked shallower on the map." },
    { is: "Vaðið er hluti af leiðinni.", en: "The crossing is part of the route." },
    { is: "Malarvegur telst utanvega. Tæknilega.", en: "Gravel counts as trail. Technically." },

    // Winter and darkness
    { is: "Höfuðljósið sýnir bara næstu tvo metra. Það er nóg.", en: "The headlamp shows only the next two metres. That's enough." },
    { is: "Broddarnir voru góð hugmynd.", en: "The spikes were a good idea." },
    { is: "Skafrenningur er bara snjór á hlaupum.", en: "Drifting snow is just snow out for a run." },

    // Gear, aches and small comedies
    { is: "Erfiðasta brekkan er útihurðin.", en: "The steepest hill is the front door." },
    { is: "Versta veðrið er í forstofunni", en: "The worst weather is in the hallway" },
    { is: "Klukkan segir 5 km. Fæturnir segja 15.", en: "Watch says 5 km. Legs say 15." },
    { is: "Rafhlaðan: 12%. Bjartsýnin: 100%.", en: "Battery: 12%. Optimism: 100%." },
    { is: "Gelið er alltaf í hinum vasanum.", en: "The gel is always in the other pocket." },
    { is: "Það er alltaf einn steinn sem finnur skóinn.", en: "There's always one stone that finds your shoe." },
    { is: "Blöðrur eru bara minjagripir.", en: "Blisters are just souvenirs." },
    { is: "Njóttu brekkunnar niður í mót — hún er gjöf.", en: "Take the downhill. It's a gift." },
    { is: "Nýir skór gera mig hraðari. Þetta eru vísindi.", en: "New shoes make me faster. That's science." },
    { is: "Nýtt skópar í dag, kemur skapinu í lag...", en: "New shoes today, good mood all the way..." },
    { is: "Að ganga upp brekkuna er líka hlaup.", en: "Walking the hill still counts as running." },
    { is: "Enginn spyr um tímann í brekkunni.", en: "Nobody asks about your uphill split." },
    { is: "Enginn iðrast þess að hafa farið út.", en: "Nobody ever regretted going out." },

    // The finish line and afterwards
    { is: "Fagnaðu sigri þegar þú kemur í mark.", en: "Celebrate the win when you cross the line." },
    { is: "Komum alltaf brosandi í mark.", en: "Always cross the line smiling." },
    { is: "Kaffi fyrir, kleina eftir.", en: "Coffee before, kleina after." },
    { is: "Heiti potturinn er endamarkið.", en: "The hot tub is the finish line." },
    { is: "Sundlaugin bíður.", en: "The pool is waiting." },

    // A wink at the loading screen itself
    { is: "Þetta hleðst hraðar ef þú andar.", en: "This loads faster if you breathe." },
];

export default function RunningLoader({ message }: { message?: string }) {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith('is') ? 'is' : 'en';
  const [index] = useState(() => Math.floor(Math.random() * loadingMessages.length));
  const text = message ?? loadingMessages[index][lang];

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
