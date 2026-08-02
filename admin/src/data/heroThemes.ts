// ─── Hero Band Theme Definitions ─────────────────────────────────────────────
//
// Themes are matched against today's date. Recurring themes fire every year on
// the same calendar window. One-off themes use absolute ISO date ranges.
// If multiple themes overlap, the one with the highest priority wins.
//
// IMAGE GUIDELINES — see also /admin/hero-themes for the full rules.
//   • Place images in /public/themes/<id>.png (or .webp / .jpg)
//   • Recommended size: 400 × 200 px for logos, 1200 × 300 px for wide banners
//   • Max file size: 150 KB (use Squoosh or similar to compress)
//   • Always supply imageAlt for accessibility
// ─────────────────────────────────────────────────────────────────────────────

export interface HeroTheme {
    id: string;
    name: string;
    description: string;
    gradient: string;
    gradientDark: string;
    imagePath?: string;
    imageAlt?: string;
    imagePosition?: 'left' | 'center' | 'right';
    headerLine?: string;           // large heading above the tagline
    tagline?: string;
    fontColor?: string;            // default 'rgba(255,255,255,0.95)'
    countdownSuffix?: string;      // e.g. "DAGAR" — shown after the number
    raceDayText?: string;          // shown on race day instead of countdown
    showCountdown?: boolean;       // default false
    externalUrl?: string;
    enabled?: boolean;             // default true — set false to disable without removing
    // Look up the date from is-holidays.json by holiday name (e.g. 'Bolludagur').
    // Use this for holidays whose date shifts every year (Easter-relative days, etc.).
    // daysBefore/daysAfter widen the window around the looked-up date.
    holidayKey?: string;
    holidayDaysBefore?: number;
    holidayDaysAfter?: number;
    // Annual recurring: fires every year on [month/day - daysBefore .. month/day + daysAfter]
    // milestones: exact days to show the band (e.g. [100, 90, 80])
    // milestoneRange: show every day between from and to inclusive (e.g. { from: 10, to: 1 })
    recurring?: {
        month: number;
        day: number;
        daysBefore?: number;
        daysAfter?: number;
        milestones?: number[];
        milestoneRange?: { from: number; to: number }[]
    };
    // One-off: fires once within an absolute date range (inclusive)
    oneOff?: { from: string; to: string };
    priority: number;
}

export const HERO_THEMES: HeroTheme[] = [
    // ── January ──────────────────────────────────────────────────────────────
    {
        id: 'nýársdagur',
        name: 'Nýársdagur',
        description: 'New Year\'s Day — January 1st.',
        gradient: 'linear-gradient(90deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
        gradientDark: 'linear-gradient(90deg, #07061a 0%, #1d1a3d 50%, #14132a 100%)',
        headerLine: 'Gleðilegt nýtt ár! 🎆',
        tagline: 'Hvernig væri að byrja árið á eins og einni Esju? — Framtíðin er björt!',
        showCountdown: false,
        recurring: { month: 1, day: 1, daysBefore: 0, daysAfter: 0 },
        priority: 15,
    },
    {
        id: 'þrettándinn',
        name: 'Þrettándinn',
        description: 'Epiphany / Þrettándinn — January 6th. Last night of the Yule season.',
        gradient: 'linear-gradient(90deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
        gradientDark: 'linear-gradient(90deg, #0d0d1a 0%, #0d1826 40%, #082040 100%)',
        headerLine: 'Gleðilegan þrettánda! 🧨',
        tagline: 'Jólin eru búin — LET´S GO!',
        showCountdown: false,
        recurring: { month: 1, day: 6, daysBefore: 0, daysAfter: 0 },
        priority: 5,
    },
    {
        id: 'bóndadagur',
        name: 'Bóndadagur',
        description: 'Farmer\'s Day — date shifts every year (fourth Monday of January).',
        gradient: 'linear-gradient(90deg, #3d2b1f 0%, #6b4226 50%, #a0522d 100%)',
        gradientDark: 'linear-gradient(90deg, #1f150f 0%, #3d2414 50%, #5a2e18 100%)',
        headerLine: 'Gleðilegan bóndadag! 🐄',
        tagline: 'Í dag fagna bændur landsins!',
        showCountdown: false,
        holidayKey: 'Bóndadagur',
        priority: 5,
    },

    // ── February ─────────────────────────────────────────────────────────────
    {
        id: 'bolludagur',
        name: 'Bolludagur',
        description: 'Bun Day — date shifts every year (Easter-relative). Looked up from is-holidays.json.',
        gradient: 'linear-gradient(90deg, #c0392b 0%, #e74c3c 40%, #f7b7a3 100%)',
        gradientDark: 'linear-gradient(90deg, #7b241c 0%, #a93226 40%, #d09080 100%)',
        headerLine: 'Gleðilegan bolludag! 🍩',
        tagline: 'Í dag er Bolludagur — borðaðu bollur! Gott kolvetni',
        showCountdown: false,
        holidayKey: 'Bolludagur',
        priority: 5,
    },
    {
        id: 'sprengidagur',
        name: 'Sprengidagur',
        description: 'Explosion Day — the day before Ash Wednesday. Eat salt meat and peas!',
        gradient: 'linear-gradient(90deg, #b34700 0%, #e65c00 50%, #f9d423 100%)',
        gradientDark: 'linear-gradient(90deg, #6b2a00 0%, #9c3e00 50%, #c9a800 100%)',
        headerLine: 'Gleðilegan sprengdag! 💥',
        tagline: 'Borðið saltkjöt og baunir þangað til þið springið!',
        showCountdown: false,
        holidayKey: 'Sprengidagur',
        priority: 5,
    },
    {
        id: 'öskudagur',
        name: 'Öskudagur',
        description: 'Ash Wednesday — children dress up and sing for sweets.',
        gradient: 'linear-gradient(90deg, #4a4a4a 0%, #7a7a7a 50%, #b0b0b0 100%)',
        gradientDark: 'linear-gradient(90deg, #2a2a2a 0%, #4a4a4a 50%, #707070 100%)',
        headerLine: 'Gleðilegan öskudag! 🎭',
        tagline: 'Í dag syngja börnin — gefðu þeim nammi! Gott kolvetni!',
        showCountdown: false,
        holidayKey: 'Öskudagur',
        priority: 5,
    },
    {
        id: 'valentínusardagurinn',
        name: 'Valentínusardagurinn',
        description: 'Valentine\'s Day — February 14th.',
        gradient: 'linear-gradient(90deg, #c0392b 0%, #e91e63 50%, #f48fb1 100%)',
        gradientDark: 'linear-gradient(90deg, #7b241c 0%, #a0104a 50%, #b05070 100%)',
        headerLine: 'Gleðilegan valentínusardag! ❤️',
        tagline: 'Farðu út að hlaupa með ástinni þinni og segðu að þú elskir hana!',
        showCountdown: false,
        recurring: { month: 2, day: 14, daysBefore: 0, daysAfter: 0 },
        priority: 5,
    },
    {
        id: 'konudagur',
        name: 'Konudagur',
        description: 'Women\'s Day — date shifts every year (Sunday before Lent).',
        gradient: 'linear-gradient(90deg, #6a0572 0%, #ab47bc 50%, #f8bbd0 100%)',
        gradientDark: 'linear-gradient(90deg, #3a0240 0%, #7b1fa2 50%, #c07090 100%)',
        headerLine: 'Gleðilegan konudag! 💐',
        tagline: 'Í dag fagna konur landsins!',
        showCountdown: false,
        holidayKey: 'Konudagur',
        priority: 5,
    },

    // ── Easter week ───────────────────────────────────────────────────────────
    {
        id: 'pálmasunnudagur',
        name: 'Pálmasunnudagur',
        description: 'Palm Sunday — shifts every year.',
        gradient: 'linear-gradient(90deg, #2e7d32 0%, #66bb6a 50%, #a5d6a7 100%)',
        gradientDark: 'linear-gradient(90deg, #1b5e20 0%, #388e3c 50%, #66a868 100%)',
        headerLine: 'Pálmasunnudagur 🌿',
        tagline: 'Páskavikan hefst — von og endurnýjun.',
        showCountdown: false,
        holidayKey: 'Pálmasunnudagur',
        priority: 5,
    },
    {
        id: 'skírdagur',
        name: 'Skírdagur',
        description: 'Maundy Thursday — shifts every year.',
        gradient: 'linear-gradient(90deg, #4a148c 0%, #7b1fa2 50%, #ce93d8 100%)',
        gradientDark: 'linear-gradient(90deg, #2a0850 0%, #4a0f66 50%, #8a5090 100%)',
        headerLine: 'Skírdagur 🕊️',
        tagline: 'Síðasti fimmtudagur fyrir páska og lögbundinn frídagur. Út að hlaupa?',
        showCountdown: false,
        holidayKey: 'Skírdagur',
        priority: 5,
    },
    {
        id: 'föstudagurinn-langi',
        name: 'Föstudagurinn langi',
        description: 'Good Friday — shifts every year.',
        gradient: 'linear-gradient(90deg, #1a1a1a 0%, #424242 50%, #757575 100%)',
        gradientDark: 'linear-gradient(90deg, #0d0d0d 0%, #212121 50%, #424242 100%)',
        headerLine: 'Föstudagurinn langi ✝️',
        tagline: 'Lögbundinn frídagur — njóttu dagsins og farðu út að hlaupa!',
        showCountdown: false,
        holidayKey: 'Föstudagurinn langi',
        priority: 5,
    },
    {
        id: 'páskadagur',
        name: 'Páskadagur',
        description: 'Easter Sunday — shifts every year.',
        gradient: 'linear-gradient(90deg, #f9a825 0%, #ffee58 50%, #aed581 100%)',
        gradientDark: 'linear-gradient(90deg, #b07810 0%, #c8b820 50%, #6a9040 100%)',
        headerLine: 'Gleðilega páska! 🐣',
        tagline: 'Gleðilega páska — vorið er komið!',
        fontColor: 'rgba(30,30,30,0.95)',
        showCountdown: false,
        holidayKey: 'Páskadagur',
        priority: 8,
    },
    {
        id: 'annar-í-páskum',
        name: 'Annar í páskum',
        description: 'Easter Monday — shifts every year.',
        gradient: 'linear-gradient(90deg, #f9a825 0%, #ffee58 50%, #aed581 100%)',
        gradientDark: 'linear-gradient(90deg, #b07810 0%, #c8b820 50%, #6a9040 100%)',
        headerLine: 'Annar í páskum 🐣 Annar í hlaupum',
        tagline: 'Gleðilega páska!',
        fontColor: 'rgba(30,30,30,0.95)',
        showCountdown: false,
        holidayKey: 'Annar í páskum',
        priority: 5,
    },

    // ── Spring ────────────────────────────────────────────────────────────────
    {
        id: 'sumardagurinn-fyrsti',
        name: 'Sumardagurinn fyrsti',
        description: 'First Day of Summer — shifts every year (first Thursday after April 19).',
        gradient: 'linear-gradient(90deg, #00796b 0%, #26a69a 40%, #80cbc4 70%, #b2dfdb 100%)',
        gradientDark: 'linear-gradient(90deg, #004d40 0%, #00695c 40%, #4db6ac 70%, #80cbc4 100%)',
        headerLine: 'Gleðilegan sumardaginn fyrsta! ☀️',
        tagline: 'Sumarið er komið — sól í heiði skín og fætur í hlaupaská!',
        showCountdown: false,
        holidayKey: 'Sumardagurinn fyrsti',
        priority: 10,
    },
    {
        id: 'baráttudagur-verkalýðsins',
        name: 'Baráttudagur verkalýðsins',
        description: 'Labour Day — May 1st.',
        gradient: 'linear-gradient(90deg, #b71c1c 0%, #e53935 50%, #ef9a9a 100%)',
        gradientDark: 'linear-gradient(90deg, #6a0e0e 0%, #b71c1c 50%, #c06060 100%)',
        headerLine: 'Gleðilegan 1. maí! ✊',
        tagline: 'Baráttudagur verkalýðsins — réttlæti og samstaða ...og samhlaup',
        showCountdown: false,
        recurring: { month: 5, day: 1, daysBefore: 0, daysAfter: 0 },
        priority: 8,
    },
    {
        id: 'uppstigningardagur',
        name: 'Uppstigningardagur',
        description: 'Ascension Day — shifts every year (39 days after Easter).',
        gradient: 'linear-gradient(90deg, #1565c0 0%, #42a5f5 50%, #e3f2fd 100%)',
        gradientDark: 'linear-gradient(90deg, #0d3c77 0%, #1976d2 50%, #90caf9 100%)',
        headerLine: 'Uppstigningardagur 🕊️',
        tagline: 'Frí í dag — njóttu dagsins - á hlaupum!',
        showCountdown: false,
        holidayKey: 'Uppstigningardagur',
        priority: 5,
    },
    {
        id: 'mæðradagurinn',
        name: 'Mæðradagurinn',
        description: 'Mother\'s Day — shifts every year (second Sunday in May).',
        gradient: 'linear-gradient(90deg, #e91e63 0%, #f48fb1 50%, #fce4ec 100%)',
        gradientDark: 'linear-gradient(90deg, #880e4f 0%, #c2185b 50%, #e09090 100%)',
        headerLine: 'Gleðilegan mæðradag! 🌸',
        tagline: 'Í dag fögnum við öllum frábærum mæðrum!',
        fontColor: 'rgba(30,30,30,0.95)',
        showCountdown: false,
        holidayKey: 'Mæðradagurinn',
        priority: 8,
    },
    {
        id: 'hvítasunnudagur',
        name: 'Hvítasunnudagur',
        description: 'Whit Sunday (Pentecost) — shifts every year.',
        gradient: 'linear-gradient(90deg, #f5f5f5 0%, #ffe082 50%, #ffffff 100%)',
        gradientDark: 'linear-gradient(90deg, #9e9e9e 0%, #c8a000 50%, #bdbdbd 100%)',
        headerLine: 'Hvítasunnudagur 🕊️',
        tagline: 'Frí í dag — njóttu dagsins!',
        fontColor: 'rgba(30,30,30,0.95)',
        showCountdown: false,
        holidayKey: 'Hvítasunnudagur',
        priority: 5,
    },

    // ── June ──────────────────────────────────────────────────────────────────
    {
        id: 'sjómannadagurinn',
        name: 'Sjómannadagurinn',
        description: 'Seamen\'s Day — first Sunday in June.',
        gradient: 'linear-gradient(90deg, #0d47a1 0%, #1976d2 40%, #42a5f5 80%, #0d47a1 100%)',
        gradientDark: 'linear-gradient(90deg, #062970 0%, #0d47a1 40%, #1976d2 80%, #062970 100%)',
        headerLine: 'Gleðilegan sjómannadag! ⚓',
        tagline: 'Við heiðrum sjómennina okkar — burðarás þjóðarinnar.',
        showCountdown: false,
        holidayKey: 'Sjómannadagurinn',
        priority: 8,
    },
    {
        id: 'independence-day',
        name: 'Þjóðhátíðardagurinn 17. júní',
        description: 'Icelandic National Day — celebrated every year on June 17th.',
        gradient: 'linear-gradient(90deg, #003897 0%, #ffffff 50%, #D72828 100%)',
        gradientDark: 'linear-gradient(90deg, #002266 0%, #cccccc 50%, #a01e1e 100%)',
        headerLine: 'Til hamingju með daginn Íslendingar! 🎉',
        tagline: 'Það er kominn 17. júní 🇮🇸',
        externalUrl: 'https://is.wikipedia.org/wiki/%C3%8Dslenski_%C3%BEj%C3%B3%C3%B0h%C3%A1t%C3%AD%C3%B0ardagurinn',
        showCountdown: false,
        recurring: { month: 6, day: 17, daysBefore: 0, daysAfter: 0 },
        priority: 20,
    },

    // ── July / Race season ────────────────────────────────────────────────────
    {
        id: 'laugavegur-ultra',
        name: 'Laugavegur Ultra',
        description: 'The biggest and most popular trail run in Iceland, held annually in mid-July.',
        gradient: 'linear-gradient(90deg, #1b4332 0%, #2d6a4f 40%, #40916c 70%, #1b4332 100%)',
        gradientDark: 'linear-gradient(90deg, #0d2118 0%, #1a3d2d 40%, #245a42 70%, #0d2118 100%)',
        imagePath: '/themes/laugavegur-ultra.webp',
        imageAlt: 'Laugavegur Ultra Marathon logo',
        imagePosition: 'right',
        tagline: 'Laugavegshlaupið nálgast — 11. júlí 2026️',
        countdownSuffix: 'DAGAR',
        raceDayText: '🏃 Laugavegshlaupið er í dag!',
        showCountdown: true,
        externalUrl: 'https://www.laugavegshlaup.is/',
        recurring: {
            month: 7, day: 11,
            daysBefore: 100,
            daysAfter: 1,
            milestones: [100, 90, 80, 70, 60, 50, 40, 30, 20],
            milestoneRange: [{ from: 16, to: 1 }],
        },
        priority: 10,
    },

    // ── August ────────────────────────────────────────────────────────────────
    {
        id: 'frídagur-verslunarmanna',
        name: 'Frídagur verslunarmanna',
        description: 'Merchants\' Holiday — first Monday in August. Big outdoor weekend.',
        gradient: 'linear-gradient(90deg, #f57f17 0%, #ffca28 50%, #fff9c4 100%)',
        gradientDark: 'linear-gradient(90deg, #a35000 0%, #c8960a 50%, #c8b870 100%)',
        headerLine: 'Verslunarmannahelgin! 🎪',
        tagline: 'Stærsta ferðahelgi ársins — Njótið!',
        fontColor: 'rgba(30,30,30,0.95)',
        showCountdown: false,
        holidayKey: 'Frídagur verslunarmanna',
        priority: 10,
        holidayDaysBefore: 2,
    },
    {
        id: 'reykjavik-pride',
        name: 'Reykjavík Pride',
        description: 'Reykjavík Pride / Gleðigangan — typically second Saturday in August.',
        gradient: 'linear-gradient(90deg, #e53935 0%, #fb8c00 20%, #fdd835 40%, #43a047 60%, #1e88e5 80%, #8e24aa 100%)',
        gradientDark: 'linear-gradient(90deg, #b71c1c 0%, #c46200 20%, #c8a800 40%, #2e7d32 60%, #1565c0 80%, #6a1b9a 100%)',
        headerLine: 'Reykjavík Pride! 🌈',
        tagline: 'Gleðigangan — kærleikur er kærleikur.',
        showCountdown: false,
        holidayKey: 'Reykjavík Pride/Gleðigangan',
        priority: 8,
        holidayDaysBefore: 1,
    },
    {
        id: 'menningarnótt',
        name: 'Menningarnótt',
        description: 'Culture Night in Reykjavík — typically third Saturday in August.',
        gradient: 'linear-gradient(90deg, #4a148c 0%, #7e57c2 50%, #e040fb 100%)',
        gradientDark: 'linear-gradient(90deg, #2a0850 0%, #4527a0 50%, #8e00c0 100%)',
        headerLine: 'Menningarnótt í Reykjavík! 🎨',
        tagline: 'Listir, tónlist og gleði — og Reykjarvíkurmaraþon :)',
        showCountdown: false,
        holidayKey: 'Menningarnótt í Reykjavík',
        priority: 8,
    },

    // ── Autumn ────────────────────────────────────────────────────────────────
    {
        id: 'fæðingardagur-forseta',
        name: 'Fæðingardagur forseta',
        description: 'President\'s Birthday — date can vary by president.',
        gradient: 'linear-gradient(90deg, #003897 0%, #1976d2 50%, #90caf9 100%)',
        gradientDark: 'linear-gradient(90deg, #002266 0%, #0d47a1 50%, #5090c0 100%)',
        headerLine: 'Til hamingju forseti! 🎂',
        tagline: 'Við óskum forseta Íslands til hamingju með afmælið.',
        showCountdown: false,
        holidayKey: 'Fæðingardagur forseta',
        priority: 5,
    },
    {
        id: 'fyrsti-vetrardagur',
        name: 'Fyrsti vetrardagur',
        description: 'First Day of Winter — shifts every year (first Saturday after Oct 21).',
        gradient: 'linear-gradient(90deg, #263238 0%, #455a64 40%, #90a4ae 80%, #cfd8dc 100%)',
        gradientDark: 'linear-gradient(90deg, #0d1518 0%, #263238 40%, #546e7a 80%, #90a4ae 100%)',
        headerLine: 'Gleðilegan fyrsta vetrardag! ❄️',
        tagline: 'Veturinn er kominn — hlaupum áfram!',
        showCountdown: false,
        holidayKey: 'Fyrsti vetrardagur',
        priority: 8,
    },
    {
        id: 'hrekkjavaka',
        name: 'Hrekkjavaka',
        description: 'Halloween — October 31st.',
        gradient: 'linear-gradient(90deg, #1a0a00 0%, #e65c00 50%, #1a0a00 100%)',
        gradientDark: 'linear-gradient(90deg, #0d0500 0%, #994000 50%, #0d0500 100%)',
        headerLine: 'Gleðilega hrekkjavöku! 🎃',
        tagline: 'Skelfilegar stundir — Búningahlaup kannski?',
        showCountdown: false,
        recurring: { month: 10, day: 31, daysBefore: 0, daysAfter: 0 },
        priority: 5,
    },
    {
        id: 'feðradagurinn',
        name: 'Feðradagurinn',
        description: 'Father\'s Day — shifts every year (second Sunday in November).',
        gradient: 'linear-gradient(90deg, #1a237e 0%, #3949ab 50%, #7986cb 100%)',
        gradientDark: 'linear-gradient(90deg, #0d1248 0%, #1a237e 50%, #4050a0 100%)',
        headerLine: 'Gleðilegan feðradag! 👨‍👧',
        tagline: 'Í dag fagna við öllum frábærum feðrum!',
        showCountdown: false,
        holidayKey: 'Feðradagurinn',
        priority: 8,
    },
    {
        id: 'dagur-íslenzkrar-tungu',
        name: 'Dagur íslenzkrar tungu',
        description: 'Icelandic Language Day — November 16th.',
        gradient: 'linear-gradient(90deg, #003897 0%, #ffffff 50%, #D72828 100%)',
        gradientDark: 'linear-gradient(90deg, #002266 0%, #aaaaaa 50%, #a01e1e 100%)',
        headerLine: 'Dagur íslenskrar tungu 📖',
        tagline: 'Íslenska — eitt elsta og fegursta mál heims.',
        showCountdown: false,
        recurring: { month: 11, day: 16, daysBefore: 0, daysAfter: 0 },
        priority: 8,
    },

    // ── December ──────────────────────────────────────────────────────────────
    {
        id: 'fullveldisdagurinn',
        name: 'Fullveldisdagurinn',
        description: 'Sovereignty Day — December 1st. Iceland became a sovereign state in 1918.',
        gradient: 'linear-gradient(90deg, #003897 0%, #ffffff 50%, #D72828 100%)',
        gradientDark: 'linear-gradient(90deg, #002266 0%, #cccccc 50%, #a01e1e 100%)',
        headerLine: 'Fullveldisdagurinn 1. desember 🇮🇸',
        tagline: 'Ísland varð fullvalda ríki 1. desember 1918.',
        showCountdown: false,
        recurring: { month: 12, day: 1, daysBefore: 0, daysAfter: 0 },
        priority: 8,
    },
    {
        id: 'aðfangadagur',
        name: 'Aðfangadagur jóla',
        description: 'Christmas Eve — December 24th. The main celebration day in Iceland.',
        gradient: 'linear-gradient(90deg, #1b5e20 0%, #c62828 50%, #1b5e20 100%)',
        gradientDark: 'linear-gradient(90deg, #0d3010 0%, #7a1010 50%, #0d3010 100%)',
        headerLine: 'Gleðileg jól! 🎄',
        tagline: 'Aðfangadagur jóla — kveikið á kertum og fagnið hátíð ljóssins',
        showCountdown: false,
        recurring: { month: 12, day: 24, daysBefore: 2, daysAfter: 0 },
        priority: 15,
    },
    {
        id: 'joladagur',
        name: 'Jóladagur',
        description: 'Christmas Day — December 25th.',
        gradient: 'linear-gradient(90deg, #1b5e20 0%, #c62828 50%, #1b5e20 100%)',
        gradientDark: 'linear-gradient(90deg, #0d3010 0%, #7a1010 50%, #0d3010 100%)',
        headerLine: 'Gleðileg jól! 🎄',
        tagline: 'Jóladagur — heitt kakó, smákökur - friðsamlegur og fallegur.',
        showCountdown: false,
        recurring: { month: 12, day: 25, daysBefore: 0, daysAfter: 1 },
        priority: 12,
    },
    {
        id: 'gamlársdagur',
        name: 'Gamlársdagur',
        description: 'New Year\'s Eve — December 31st.',
        gradient: 'linear-gradient(90deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
        gradientDark: 'linear-gradient(90deg, #07061a 0%, #1d1a3d 50%, #14132a 100%)',
        headerLine: 'Gleðilegt komandi ár! 🎆',
        tagline: 'Síðasti dagur ársins — Gamlárshlaupið?',
        showCountdown: false,
        recurring: { month: 12, day: 31, daysBefore: 0, daysAfter: 0 },
        priority: 12,
    },
];
