export interface Quote {
    text: string;
    author?: string;
}

export class QuoteService {
    private static quotes: Quote[] = [
        { text: "Sumir elska malbik, allir elska utanvega" },
        { text: "Pain is inevitable, suffering is optional" },
        { text: "We suffer more often in imagination than in reality.", author: "Seneca" },
        { text: "Man is disturbed not by things, but by the view which he takes of them.", author: "Epictetus" },
        { text: "Pain is neither unbearable nor unending as long as you keep in mind its limits and don’t magnify them in your imagination.", author: "Marcus Aurelius" },
        { text: "90% of suffering is the story you tell yourself about what happened.", author: "Maxime Lagacé" },
        { text: "Pain is what the world does to you; suffering is what you do to yourself.", author: "Often attributed to the Buddha" },
        { text: "Pain * Resistance = Suffering.", author: "Shinzen Young" },
        { text: "What you resist, persists.", author: "Often attributed to Carl Jung" },
        { text: "The root of all suffering is attachment.", author: "Gautama Buddha" },
        { text: "Suffering is your perceptions clashing with reality.", author: "Unknown" },
        { text: "You can be cold, wet, and miserable, or you can just be cold and wet.", author: "Modern Proverb" },
        { text: "To live is to suffer, to survive is to find some meaning in the suffering.", author: "Friedrich Nietzsche" },
        { text: "Suffering ceases to be suffering at the moment it finds a meaning.", author: "Viktor Frankl" },
        { text: "Out of suffering have emerged the strongest souls; the most massive characters are seared with scars.", author: "Kahlil Gibran" },
        { text: "Be patient and tough; someday this pain will be useful to you.", author: "Ovid" },
        { text: "Of all the paths you take in life, make sure a few of them are dirt.", author: "John Muir" },
        { text: "And into the forest I go, to lose my mind and find my soul.", author: "Often attributed to John Muir" },
        { text: "Trail running is the antidote to a world addicted to speed.", author: "Christopher McDougall, author of Born to Run" },
        { text: "Go fast enough to get there, but slow enough to see.", author: "Unknown" },
        { text: "The danger of an adventure is worth a thousand days of ease and comfort.", author: "Paulo Coelho" },
        { text: "Run when you can, walk if you have to, crawl if you must; just never give up.", author: "Dean Karnazes" },
        { text: "It’s just a hill. Get over it.", author: "Common trail runner mantra" },
        { text: "When everything feels like an uphill struggle, just think of the view from the top.", author: "Unknown" },
        { text: "Forward is a pace.", author: "Common ultrarunning mantra" },
        { text: "The trail is a journey into yourself.", author: "Vanessa Rodriguez" },
        { text: "In long-distance running the only opponent you have to beat is yourself, the way you used to be." },
        { text: "I’m not a human. I’m a piece of machinery. I don’t need to feel a thing. Just forge on ahead.", author: "Haruki Murakami (mantra during a 62-mile ultramarathon)" },
        { text: "Exerting yourself to the fullest within your individual limits: that’s the essence of running.", author: "Haruki Murakami" },
        { text: "To appreciate the beauty of a snowflake, it is necessary to stand out in the cold.", author: "Aristotle" },
        { text: "Life begins at the end of your comfort zone.", author: "Neale Donald Walsch" },
        { text: "The miracle isn't that I finished. The miracle is that I had the courage to start.", author: "John Bingham" },
        { text: "There is no such thing as bad weather, only inappropriate clothing.", author: "Sir Ranulph Fiennes" }
    ];

    static getRandomQuote(): Quote {
        const randomIndex = Math.floor(Math.random() * this.quotes.length);
        return this.quotes[randomIndex];
    }
}
