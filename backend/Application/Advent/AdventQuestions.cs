namespace Utanvega.Backend.Application.Advent;

/// <summary>
/// One door of the "Jóladagatal Hlaupadagskra.is 2026" advent calendar (#1875) — a 4-choice
/// question with a "learn more" link into a real page on the site (or Sportís's shop). Lives in
/// committed backend code, not the database: there is no admin UI to edit these, and
/// <see cref="CorrectIndex"/> must never reach a client, so it is deliberately absent from
/// <c>AdventQuestionDto</c> (the only shape ever serialized to a response) rather than relying on
/// an attribute to strip it at serialization time.
/// </summary>
public sealed record AdventQuestion(
    int Day,
    string TextIs,
    string TextEn,
    string[] ChoicesIs,
    string[] ChoicesEn,
    int CorrectIndex,
    string LinkUrl,
    string LinkLabelIs,
    string LinkLabelEn);

/// <summary>
/// The 24 real questions supplied by the owner verbatim in issue #1875's 2026-11-24 comment
/// (IC_kwDORvhit88AAAABqf6Ung) — Icelandic text, choices and correct answers are transcribed
/// faithfully from that comment. No English source text was supplied alongside it, so
/// <see cref="AdventQuestion.TextEn"/>/<see cref="AdventQuestion.ChoicesEn"/>/
/// <see cref="AdventQuestion.LinkLabelEn"/> are reasonable translations of the Icelandic, not a
/// second verbatim source — flagged as a judgment call in the PR, not re-authored content.
/// </summary>
public static class AdventQuestions
{
    public static readonly IReadOnlyList<AdventQuestion> All = new List<AdventQuestion>
    {
        new(
            Day: 1,
            TextIs: "Hversu margir kílómetrar eru í hálfu maraþoni?",
            TextEn: "How many kilometers are in a half marathon?",
            ChoicesIs: ["12 km", "24 km", "21,1 km", "22,2 km"],
            ChoicesEn: ["12 km", "24 km", "21.1 km", "22.2 km"],
            CorrectIndex: 2,
            LinkUrl: "https://www.hlaupadagskra.is/?distance=21-42&view=list&activity=Running",
            LinkLabelIs: "Skoða öll hálfmaraþon á næsta ári",
            LinkLabelEn: "See all half marathons next year"),
        new(
            Day: 2,
            TextIs: "Hvaða upplýsingar er hægt að skoða á korti á Hlaupadagskra.is?",
            TextEn: "What information can you see on a map on Hlaupadagskra.is?",
            ChoicesIs:
            [
                "Fjölda þátttakenda í hlaupinu í rauntíma",
                "Hlaupaleiðina á íslandskorti",
                "Hjartslátt allra hlaupara",
                "Verð á hlaupaskóm",
            ],
            ChoicesEn:
            [
                "The number of participants in the race in real time",
                "The trail route on a map of Iceland",
                "Every runner's heart rate",
                "The price of running shoes",
            ],
            CorrectIndex: 1,
            LinkUrl: "https://www.hlaupadagskra.is/?view=map",
            LinkLabelIs: "Skoða viðburði á korti",
            LinkLabelEn: "See events on the map"),
        new(
            Day: 3,
            TextIs: "Hversu margir naglar eru í HOKA Speedgoat 5 GORE-TEX Spike hlaupaskónum sem fást hjá Sportís?",
            TextEn: "How many spikes does the HOKA Speedgoat 5 GORE-TEX Spike running shoe sold by Sportís have?",
            ChoicesIs: ["5", "8", "12", "33"],
            ChoicesEn: ["5", "8", "12", "33"],
            CorrectIndex: 2,
            LinkUrl: "https://sportis.is/search?q=speedgoat+spike",
            LinkLabelIs: "Skoða Speedgoat Spike",
            LinkLabelEn: "Product link"),
        new(
            Day: 4,
            TextIs: "Hvað merkir hugtakið „hækkun” (elevation gain) í upplýsingum um hlaupaleið?",
            TextEn: "What does \"elevation gain\" mean in a trail's information?",
            ChoicesIs:
            [
                "Hæð yfir sjávarmáli við rásmark",
                "Mismunur á hæsta og lægsta punkti",
                "Heildarvegalengd niður á við",
                "Samanlögð hækkun á leiðinni",
            ],
            ChoicesEn:
            [
                "Altitude above sea level at the start",
                "Difference between the highest and lowest point",
                "Total distance going downhill",
                "The total climb added up over the route",
            ],
            CorrectIndex: 3,
            LinkUrl: "https://www.hlaupadagskra.is/trails/sulur-vertical-trollid",
            LinkLabelIs: "Súlur Vertical - Tröllið",
            LinkLabelEn: "Súlur Vertical - Tröllið"),
        new(
            Day: 5,
            TextIs: "Hvað stendur skammstöfunin ITRA fyrir í heimi utanvegahlaupa?",
            TextEn: "What does the abbreviation ITRA stand for in the trail running world?",
            ChoicesIs:
            [
                "Icelandic Trail Running Association",
                "International Trail Running Association",
                "International Track Racing Academy",
                "International Trail Runners Alliance",
            ],
            ChoicesEn:
            [
                "Icelandic Trail Running Association",
                "International Trail Running Association",
                "International Track Racing Academy",
                "International Trail Runners Alliance",
            ],
            CorrectIndex: 1,
            LinkUrl: "https://www.hlaupadagskra.is/itra",
            LinkLabelIs: "Allt um ITRA",
            LinkLabelEn: "Everything about ITRA"),
        new(
            Day: 6,
            TextIs: "Hvaða íslenska utanvegahlaup hefst í Landmannalaugum og endar í Þórsmörk?",
            TextEn: "Which Icelandic trail race starts in Landmannalaugar and ends in Þórsmörk?",
            ChoicesIs: ["Hengill Ultra", "Fimmvörðuhálshlaupið", "Laugavegshlaupið", "Súlur Vertical"],
            ChoicesEn: ["Hengill Ultra", "The Fimmvörðuháls Run", "The Laugavegur Run", "Súlur Vertical"],
            CorrectIndex: 2,
            LinkUrl: "https://www.hlaupadagskra.is/?view=map",
            LinkLabelIs: "Skoða kort",
            LinkLabelEn: "See the map"),
        new(
            Day: 7,
            TextIs: "Hvað er „negative split“ í hlaupum?",
            TextEn: "What is a \"negative split\" in running?",
            ChoicesIs:
            [
                "Að hlaupa seinni helming hraðar en þann fyrri",
                "Að hlaupa niður brekku",
                "Að hætta í hlaupi áður en komið er í mark",
                "Að hlaupa með neikvæðan hæðarmun",
            ],
            ChoicesEn:
            [
                "Running the second half faster than the first",
                "Running downhill",
                "Quitting a race before the finish",
                "Running a route with negative elevation gain",
            ],
            CorrectIndex: 0,
            LinkUrl: "https://www.hlaupadagskra.is/tools/training-paces?d=5k",
            LinkLabelIs: "Skoða æfingatímatól",
            LinkLabelEn: "See the training pace tool"),
        new(
            Day: 8,
            TextIs: "Hvað getur þú gert með Utanvega- og götuhhlaupa-skafkortinu sem fæst í verslun Hlaupadagskra.is?",
            TextEn: "What can you do with the trail- and road-running scratch map sold in the Hlaupadagskra.is shop?",
            ChoicesIs:
            [
                "Mælt hjartsláttinn á meðan þú hleypur",
                "Skráð þig sjálfkrafa í öll utanvegahlaup",
                "Fengið afslátt af öllum hlaupum á Íslandi",
                "Skafðið af þeim hlaupum sem þú hefur tekið þátt í og séð ævintýri þín um íslenska náttúru birtast á veggnum.",
            ],
            ChoicesEn:
            [
                "Measure your heart rate while you run",
                "Automatically register for every trail race",
                "Get a discount on every race in Iceland",
                "Scratch off the races you've completed and watch your Icelandic adventures appear on the wall.",
            ],
            CorrectIndex: 3,
            LinkUrl: "https://verslun.hlaupadagskra.is/collections/all",
            LinkLabelIs: "Skoða skafkortið",
            LinkLabelEn: "See the scratch map"),
        new(
            Day: 9,
            TextIs: "Hvaða upplýsingar gefa GPX-skrár sem hægt er að sækja á Hlaupadagskra.is?",
            TextEn: "What information do the GPX files you can download on Hlaupadagskra.is give you?",
            ChoicesIs:
            [
                "Niðurstöður blóðrannsókna hlaupara",
                "GPS-hnit hlaupaleiðar sem hægt er að fylgja í hlaupaúri eða síma",
                "Skráningarlista og símanúmer þátttakenda",
                "Verðlaunaflokka og úrslit hlaupa",
            ],
            ChoicesEn:
            [
                "Runners' blood test results",
                "The trail's GPS coordinates, followable on a running watch or phone",
                "Participants' registration list and phone numbers",
                "Prize categories and race results",
            ],
            CorrectIndex: 1,
            LinkUrl: "https://www.hlaupadagskra.is/trails",
            LinkLabelIs: "Skoða allar leiðir",
            LinkLabelEn: "See all trails"),
        new(
            Day: 10,
            TextIs: "Hver er opinber vegalengd maraþonhlaups?",
            TextEn: "What is the official distance of a marathon?",
            ChoicesIs: ["40 km", "42 km", "42,195 km", "45 km"],
            ChoicesEn: ["40 km", "42 km", "42.195 km", "45 km"],
            CorrectIndex: 2,
            LinkUrl: "https://www.hlaupadagskra.is/?distance=42-100&view=list&activity=Running",
            LinkLabelIs: "Skoða öll maraþon",
            LinkLabelEn: "See all marathons"),
        new(
            Day: 11,
            TextIs: "Á hvaða eyju er utanvegahlaupið The Puffin Run haldið?",
            TextEn: "Which island hosts the trail race The Puffin Run?",
            ChoicesIs: ["Heimaey", "Grímsey", "Hrísey", "Flatey"],
            ChoicesEn: ["Heimaey", "Grímsey", "Hrísey", "Flatey"],
            CorrectIndex: 0,
            LinkUrl: "https://www.hlaupadagskra.is/events/puffin-run",
            LinkLabelIs: "Sjá Puffin Run",
            LinkLabelEn: "See the Puffin Run"),
        new(
            Day: 12,
            TextIs: "Hvað er sérstakt við hlaupamyndböndin hjá 360° Runs Iceland á YouTube?",
            TextEn: "What's special about 360° Runs Iceland's running videos on YouTube?",
            ChoicesIs:
            [
                "Þau eru öll tekin úr þyrlu",
                "Þau sýna eingöngu marksvæðið í hlaupum",
                "Þau eru teiknimyndir af hlaupurum",
                "Þau gera áhorfendum kleift að skoða brautina og umhverfið í 360° þannig að hægt er að horfa allt í kringum sig og átta sig á aðstæðum.",
            ],
            ChoicesEn:
            [
                "They're all filmed from a helicopter",
                "They only show the finish area of races",
                "They're animated cartoons of runners",
                "They let viewers look around the course and surroundings in full 360°, as if standing there themselves.",
            ],
            CorrectIndex: 3,
            LinkUrl: "https://www.youtube.com/@360RunsIceland",
            LinkLabelIs: "Skoða myndbönd",
            LinkLabelEn: "See the videos"),
        new(
            Day: 13,
            TextIs: "Hvaða hlaupatól og reiknivélar er hægt að finna á Hlaupadagskra.is?",
            TextEn: "Which running tools and calculators can you find on Hlaupadagskra.is?",
            ChoicesIs: ["Hraðareikni", "Hraðatöflu", "Aldursleiðréttingu", "Allt hér að ofan og meira"],
            ChoicesEn: ["A pace calculator", "A pace table", "Age-grading", "All of the above, and more"],
            CorrectIndex: 3,
            LinkUrl: "https://www.hlaupadagskra.is/tools",
            LinkLabelIs: "Skoða hlaupatólin",
            LinkLabelEn: "See the running tools"),
        new(
            Day: 14,
            TextIs: "Hvað nefnist raka- og lyktarstjórnunartæknin í Stance Merino ullarhlaupasokkunum frá Sportís?",
            TextEn: "What is the moisture- and odor-control technology in Sportís's Stance Merino wool running socks called?",
            ChoicesIs: ["FreshTek™", "UltraMesh-X", "NoStink™", "OdorMoistTEC"],
            ChoicesEn: ["FreshTek™", "UltraMesh-X", "NoStink™", "OdorMoistTEC"],
            CorrectIndex: 0,
            LinkUrl: "https://sportis.is/products/stance-a448a24lig?variant=49896066023706",
            LinkLabelIs: "Skoða Stance Merino sokka",
            LinkLabelEn: "Product link"),
        new(
            Day: 15,
            TextIs: "Í hvaða landshluta fer utanvegahlaupið Akrafjall Ultra fram?",
            TextEn: "In which part of Iceland does the trail race Akrafjall Ultra take place?",
            ChoicesIs: ["Suðurlandi", "Vesturlandi", "Vestfjörðum", "Norðurlandi eystra"],
            ChoicesEn: ["South Iceland", "West Iceland", "the Westfjords", "Northeast Iceland"],
            CorrectIndex: 1,
            LinkUrl: "https://www.hlaupadagskra.is/trails/akrafjall-ultra-46",
            LinkLabelIs: "Skoða leiðina",
            LinkLabelEn: "See the trail"),
        new(
            Day: 16,
            TextIs: "Hversu margir hlaupaviðburðir voru haldnir á Íslandi árið 2025 samkvæmt ársskýrslu Hlaupadagskra.is?",
            TextEn: "How many running events were held in Iceland in 2025, according to Hlaupadagskra.is's annual report?",
            ChoicesIs: ["25", "45", "73", "141"],
            ChoicesEn: ["25", "45", "73", "141"],
            CorrectIndex: 3,
            LinkUrl: "https://www.hlaupadagskra.is/annual-report/2025",
            LinkLabelIs: "Skoða ársskýrsluna",
            LinkLabelEn: "See the annual report"),
        new(
            Day: 17,
            TextIs: "Ef þú hleypur 10 km á 50 mínútum, hver er meðalhraði þinn í mínútum á kílómetra?",
            TextEn: "If you run 10 km in 50 minutes, what is your average pace in minutes per kilometer?",
            ChoicesIs: ["4:30 mín/km", "5:00 mín/km", "5:30 mín/km", "6:00 mín/km"],
            ChoicesEn: ["4:30 min/km", "5:00 min/km", "5:30 min/km", "6:00 min/km"],
            CorrectIndex: 1,
            LinkUrl: "https://www.hlaupadagskra.is/tools/pace-calculator",
            LinkLabelIs: "Prófaðu hraðareikninn",
            LinkLabelEn: "Try the pace calculator"),
        new(
            Day: 18,
            TextIs: "Hvað heitir klúbburinn á Strava þar sem við birtum fréttir af nýjungum og viðburðum?",
            TextEn: "What is the name of the Strava club where we post news about new features and events?",
            ChoicesIs: ["Ísland á iði", "Út að hlaupa", "Hlaupadagskrá", "Segment kóngar"],
            ChoicesEn: ["Ísland á iði", "Út að hlaupa", "Hlaupadagskrá", "Segment kóngar"],
            CorrectIndex: 2,
            LinkUrl: "https://www.strava.com/clubs/hlaupadagskra",
            LinkLabelIs: "Skoða Strava klúbbinn",
            LinkLabelEn: "See the club"),
        new(
            Day: 19,
            TextIs: "Hvað er „cadence“ í hlaupum?",
            TextEn: "What is \"cadence\" in running?",
            ChoicesIs:
            [
                "Fjöldi hjartslátta á mínútu",
                "Meðalhraði hlauparans",
                "Fjöldi skrefa á mínútu",
                "Meðallengd skrefa",
            ],
            ChoicesEn:
            [
                "Heartbeats per minute",
                "The runner's average pace",
                "Steps per minute",
                "Average stride length",
            ],
            CorrectIndex: 2,
            LinkUrl: "https://www.hlaupadagskra.is/tools",
            LinkLabelIs: "Skoða hlaupatól",
            LinkLabelEn: "See the running tools"),
        new(
            Day: 20,
            TextIs: "Hversu langur er einn hringur í hefðbundnu bakgarðshlaupi (Backyard Ultra)?",
            TextEn: "How long is one loop in a traditional Backyard Ultra?",
            ChoicesIs: ["5 km", "10 km", "Um 6,7 km", "8,4 km"],
            ChoicesEn: ["5 km", "10 km", "About 6.7 km", "8.4 km"],
            CorrectIndex: 2,
            LinkUrl: "https://www.hlaupadagskra.is/?q=bakgar%C3%B0",
            LinkLabelIs: "Skoða bakgarðshlaup",
            LinkLabelEn: "See backyard ultras"),
        new(
            Day: 21,
            TextIs: "Hvaða árstíma er Miðnæturhlaup Suzuki haldið í Reykjavík?",
            TextEn: "What time of year is the Suzuki Midnight Run held in Reykjavík?",
            ChoicesIs: ["Á vetrarsólstöðum í desember", "Á sumarsólstöðum í júní", "Um páska", "Um verslunarmannahelgina í ágúst"],
            ChoicesEn: ["At the winter solstice in December", "At the summer solstice in June", "Around Easter", "Around the August bank holiday weekend"],
            CorrectIndex: 1,
            LinkUrl: "https://www.hlaupadagskra.is/",
            LinkLabelIs: "Finndu hlaupið",
            LinkLabelEn: "Find the race"),
        new(
            Day: 22,
            TextIs: "Til hvers nota sumir utanvegahlauparar hlaupastafi í löngum fjallahlaupum?",
            TextEn: "What do some trail runners use running poles for in long mountain races?",
            ChoicesIs:
            [
                "Til að mæla vindhraða",
                "Til að styðja við hreyfingu og draga úr álagi á fætur í brekkum",
                "Til að mæla vegalengd nákvæmlega",
                "Til að fá sjálfvirka tímaleiðréttingu",
            ],
            ChoicesEn:
            [
                "To measure wind speed",
                "To support their movement and reduce leg strain on climbs",
                "To measure distance precisely",
                "To get an automatic time adjustment",
            ],
            CorrectIndex: 1,
            LinkUrl: "https://sportis.is/collections/bunadur/Stafir",
            LinkLabelIs: "Skoða stafi",
            LinkLabelEn: "See running poles"),
        new(
            Day: 23,
            TextIs: "Hvaða dagatalsvirkni fyrir viðburði er á hlaupadagskrá?",
            TextEn: "What calendar functionality for events does Hlaupadagskrá offer?",
            ChoicesIs:
            [
                "Hægt er að skoða alla viðburði í tímaröð",
                "Hægt er að skoða viðburði eftir dagatali og mánuðum",
                "Hægt er gerast áskrifandi að hlaupadagatali og sjá alla viðburði í eigin dagatali",
                "Allt að ofan",
            ],
            ChoicesEn:
            [
                "You can view all events in chronological order",
                "You can view events by calendar and by month",
                "You can subscribe to the running calendar and see every event in your own calendar",
                "All of the above",
            ],
            CorrectIndex: 3,
            LinkUrl: "https://www.hlaupadagskra.is/events/calendar/2026/11",
            LinkLabelIs: "Skoða dagatal og gerast áskrifandi",
            LinkLabelEn: "See the calendar and subscribe"),
        new(
            Day: 24,
            TextIs: "Hvert af eftirfarandi er meginmarkmið Hlaupadagskra.is?",
            TextEn: "Which of the following is Hlaupadagskra.is's main goal?",
            ChoicesIs:
            [
                "Að selja eingöngu hlaupaskó og hlaupafatnað",
                "Að birta úrslit úr einu tilteknu hlaupi",
                "Að skipuleggja eingöngu maraþonhlaup í Reykjavík",
                "Að safna upplýsingum um íslensk hlaup og hlaupaleiðir á einn stað",
            ],
            ChoicesEn:
            [
                "To sell nothing but running shoes and running clothes",
                "To publish results from one specific race",
                "To organize nothing but marathons in Reykjavík",
                "To gather information about Icelandic races and trails in one place",
            ],
            CorrectIndex: 3,
            LinkUrl: "https://www.hlaupadagskra.is/about",
            LinkLabelIs: "Skoða 'Um okkur' síðuna",
            LinkLabelEn: "See the 'About us' page"),
    }.AsReadOnly();

    /// <summary>Looks up a single day's question, or <c>null</c> for a day outside 1-24.</summary>
    public static AdventQuestion? ForDay(int day) => All.FirstOrDefault(q => q.Day == day);
}
