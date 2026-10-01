import type { DiscoveryKind, MediaType, NormalizedEpisode, NormalizedMedia } from "@/lib/types";
import { ProviderError, type MediaProvider } from "./base";

interface LocalItem {
  id: string;
  title: string;
  year: number;
  date: string;
  genres: string[];
  rating: number;
  runtime: number;
  overview: string;
  crew?: string[];
  cast?: string[];
  studio?: string;
  /** [seasonCount, episodesPerSeason] */
  seasons?: [number, number];
  /** Currently airing: the latest season is spread around today. */
  airing?: boolean;
  /** A new season is announced and starts airing in the future. */
  announced?: boolean;
  platforms?: string[];
  developer?: string;
  publisher?: string;
  playtime?: number;
  popular: number;
}

const MOVIES: LocalItem[] = [
  { id: "interstellar", title: "Interstellar", year: 2014, date: "2014-11-07", genres: ["Sci-Fi", "Adventure", "Drama"], rating: 8.4, runtime: 169, overview: "When Earth becomes uninhabitable, a farmer and ex-NASA pilot is tasked to pilot a spacecraft, along with a team of researchers, to find a new planet for humans.", crew: ["Christopher Nolan"], cast: ["Matthew McConaughey", "Anne Hathaway", "Jessica Chastain"], studio: "Legendary", popular: 98 },
  { id: "arrival", title: "Arrival", year: 2016, date: "2016-11-11", genres: ["Sci-Fi", "Drama", "Mystery"], rating: 7.9, runtime: 116, overview: "A linguist works with the military to communicate with alien lifeforms after twelve mysterious spacecraft appear around the world.", crew: ["Denis Villeneuve"], cast: ["Amy Adams", "Jeremy Renner", "Forest Whitaker"], studio: "21 Laps", popular: 84 },
  { id: "blade-runner-2049", title: "Blade Runner 2049", year: 2017, date: "2017-10-06", genres: ["Sci-Fi", "Drama", "Thriller"], rating: 7.6, runtime: 164, overview: "A young blade runner's discovery of a long-buried secret leads him to track down former blade runner Rick Deckard, missing for thirty years.", crew: ["Denis Villeneuve"], cast: ["Ryan Gosling", "Harrison Ford", "Ana de Armas"], studio: "Alcon", popular: 81 },
  { id: "dune-part-two", title: "Dune: Part Two", year: 2024, date: "2024-03-01", genres: ["Sci-Fi", "Adventure"], rating: 8.5, runtime: 166, overview: "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.", crew: ["Denis Villeneuve"], cast: ["Timothée Chalamet", "Zendaya", "Rebecca Ferguson"], studio: "Legendary", popular: 96 },
  { id: "oppenheimer", title: "Oppenheimer", year: 2023, date: "2023-07-21", genres: ["Drama", "History", "Thriller"], rating: 8.1, runtime: 181, overview: "The story of J. Robert Oppenheimer's role in the development of the atomic bomb during World War II.", crew: ["Christopher Nolan"], cast: ["Cillian Murphy", "Emily Blunt", "Robert Downey Jr."], studio: "Universal", popular: 92 },
  { id: "your-name", title: "Your Name", year: 2016, date: "2016-08-26", genres: ["Animation", "Anime", "Romance", "Drama"], rating: 8.5, runtime: 106, overview: "High schoolers Mitsuha and Taki are complete strangers living separate lives until they suddenly begin swapping bodies.", crew: ["Makoto Shinkai"], cast: ["Ryunosuke Kamiki", "Mone Kamishiraishi"], studio: "CoMix Wave", popular: 88 },
  { id: "spider-verse", title: "Spider-Man: Across the Spider-Verse", year: 2023, date: "2023-06-02", genres: ["Animation", "Action", "Adventure"], rating: 8.4, runtime: 140, overview: "Miles Morales catapults across the multiverse, where he encounters a team of Spider-People charged with protecting its existence.", crew: ["Joaquim Dos Santos"], cast: ["Shameik Moore", "Hailee Steinfeld"], studio: "Sony", popular: 90 },
  { id: "parasite", title: "Parasite", year: 2019, date: "2019-05-30", genres: ["Thriller", "Drama", "Comedy"], rating: 8.5, runtime: 133, overview: "Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan.", crew: ["Bong Joon-ho"], cast: ["Song Kang-ho", "Choi Woo-shik"], studio: "CJ Entertainment", popular: 86 },
  { id: "whiplash", title: "Whiplash", year: 2014, date: "2014-10-10", genres: ["Drama", "Music"], rating: 8.5, runtime: 107, overview: "A promising young drummer enrolls at a cut-throat music conservatory where his dreams are mentored by an instructor who will stop at nothing to realize a student's potential.", crew: ["Damien Chazelle"], cast: ["Miles Teller", "J.K. Simmons"], studio: "Bold Films", popular: 79 },
  { id: "mad-max-fury-road", title: "Mad Max: Fury Road", year: 2015, date: "2015-05-15", genres: ["Action", "Adventure", "Sci-Fi"], rating: 7.6, runtime: 120, overview: "In a post-apocalyptic wasteland, a woman rebels against a tyrannical ruler in search for her homeland with the aid of a group of female prisoners and a drifter named Max.", crew: ["George Miller"], cast: ["Tom Hardy", "Charlize Theron"], studio: "Village Roadshow", popular: 83 },
  { id: "the-batman", title: "The Batman", year: 2022, date: "2022-03-04", genres: ["Crime", "Mystery", "Action"], rating: 7.7, runtime: 176, overview: "When a sadistic serial killer begins murdering key political figures in Gotham, Batman is forced to investigate the city's hidden corruption.", crew: ["Matt Reeves"], cast: ["Robert Pattinson", "Zoë Kravitz"], studio: "DC", popular: 85 },
  { id: "everything-everywhere", title: "Everything Everywhere All at Once", year: 2022, date: "2022-03-25", genres: ["Sci-Fi", "Comedy", "Adventure"], rating: 7.8, runtime: 139, overview: "An aging Chinese immigrant is swept up in an insane adventure in which she alone can save the world by exploring other universes.", crew: ["Daniel Kwan"], cast: ["Michelle Yeoh", "Ke Huy Quan"], studio: "A24", popular: 80 },
  { id: "coco", title: "Coco", year: 2017, date: "2017-11-22", genres: ["Animation", "Family", "Music"], rating: 8.2, runtime: 105, overview: "Aspiring musician Miguel enters the Land of the Dead to find his great-great-grandfather, a legendary singer.", crew: ["Lee Unkrich"], cast: ["Anthony Gonzalez", "Gael García Bernal"], studio: "Pixar", popular: 77 },
  { id: "the-social-network", title: "The Social Network", year: 2010, date: "2010-10-01", genres: ["Drama", "History"], rating: 7.4, runtime: 120, overview: "As Harvard student Mark Zuckerberg creates the social networking site that would become known as Facebook, he is sued by the twins who claimed he stole their idea.", crew: ["David Fincher"], cast: ["Jesse Eisenberg", "Andrew Garfield"], studio: "Columbia", popular: 70 },
  { id: "inception", title: "Inception", year: 2010, date: "2010-07-16", genres: ["Sci-Fi", "Action", "Thriller"], rating: 8.4, runtime: 148, overview: "A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.", crew: ["Christopher Nolan"], cast: ["Leonardo DiCaprio", "Joseph Gordon-Levitt"], studio: "Warner Bros.", popular: 93 },
  { id: "get-out", title: "Get Out", year: 2017, date: "2017-02-24", genres: ["Horror", "Mystery", "Thriller"], rating: 7.7, runtime: 104, overview: "A young African-American visits his white girlfriend's parents for the weekend, where his simmering uneasiness about their reception eventually reaches a boiling point.", crew: ["Jordan Peele"], cast: ["Daniel Kaluuya", "Allison Williams"], studio: "Blumhouse", popular: 72 },
  { id: "spiral-romance", title: "Past Lives", year: 2023, date: "2023-06-02", genres: ["Romance", "Drama"], rating: 7.8, runtime: 106, overview: "Nora and Hae Sung, two childhood friends, reunite in New York for one fateful week as they confront destiny and love.", crew: ["Celine Song"], cast: ["Greta Lee", "Teo Yoo"], studio: "A24", popular: 65 },
  { id: "godzilla-minus-one", title: "Godzilla Minus One", year: 2023, date: "2023-12-01", genres: ["Action", "Drama", "Sci-Fi"], rating: 7.7, runtime: 125, overview: "Post-war Japan is at its lowest point when a new crisis emerges in the form of a giant monster, baptized in the horrific power of the atomic bomb.", crew: ["Takashi Yamazaki"], cast: ["Ryunosuke Kamiki", "Minami Hamabe"], studio: "Toho", popular: 74 },
  { id: "the-quieter-hour", title: "Aftersun", year: 2022, date: "2022-10-21", genres: ["Drama"], rating: 7.6, runtime: 102, overview: "Sophie reflects on the shared joy and private melancholy of a holiday she took with her father twenty years earlier.", crew: ["Charlotte Wells"], cast: ["Paul Mescal", "Frankie Corio"], studio: "A24", popular: 58 },
  { id: "princess-mononoke", title: "Princess Mononoke", year: 1997, date: "1997-07-12", genres: ["Animation", "Anime", "Adventure", "Fantasy"], rating: 8.3, runtime: 134, overview: "On a journey to find the cure for a Tatarigami's curse, Ashitaka finds himself in the middle of a war between the forest gods and Tatara, a mining colony.", crew: ["Hayao Miyazaki"], cast: ["Yoji Matsuda", "Yuriko Ishida"], studio: "Studio Ghibli", popular: 76 },
  { id: "the-north-sea", title: "The Zone of Interest", year: 2023, date: "2023-12-15", genres: ["Drama", "History", "War"], rating: 7.4, runtime: 105, overview: "The commandant of Auschwitz and his wife strive to build a dream life for their family in a house beside the camp.", crew: ["Jonathan Glazer"], cast: ["Christian Friedel", "Sandra Hüller"], studio: "A24", popular: 55 },
  { id: "heat-1995", title: "Heat", year: 1995, date: "1995-12-15", genres: ["Crime", "Drama", "Thriller"], rating: 7.9, runtime: 170, overview: "A group of professional bank robbers start to feel the heat from police when they unknowingly leave a clue at their latest heist.", crew: ["Michael Mann"], cast: ["Al Pacino", "Robert De Niro"], studio: "Warner Bros.", popular: 68 },
  { id: "future-shock", title: "The Creator", year: 2023, date: "2023-09-29", genres: ["Sci-Fi", "Action", "Drama"], rating: 7.0, runtime: 133, overview: "When a rugged ex-soldier finds himself hunted by the very robots he once fought against, he discovers the weapon capable of ending the war.", crew: ["Gareth Edwards"], cast: ["John David Washington", "Madeleine Yuna Voyles"], studio: "20th Century", popular: 62 },
  { id: "dragon-tune", title: "How to Train Your Dragon", year: 2010, date: "2010-03-26", genres: ["Animation", "Family", "Adventure"], rating: 8.1, runtime: 98, overview: "A hapless young Viking who aspires to hunt dragons becomes the unlikely friend of a young dragon himself.", crew: ["Dean DeBlois"], cast: ["Jay Baruchel", "Gerard Butler"], studio: "DreamWorks", popular: 73 },
];

const SHOWS: LocalItem[] = [
  { id: "the-last-of-us", title: "The Last of Us", year: 2023, date: "2023-01-15", genres: ["Drama", "Sci-Fi", "Thriller"], rating: 8.7, runtime: 55, overview: "Twenty years after modern civilization has been destroyed, a hardened survivor is hired to smuggle a 14-year-old girl out of an oppressive quarantine zone.", seasons: [2, 9], cast: ["Pedro Pascal", "Bella Ramsey"], crew: ["Craig Mazin"], popular: 97, airing: true },
  { id: "breaking-bad", title: "Breaking Bad", year: 2008, date: "2008-01-20", genres: ["Drama", "Crime", "Thriller"], rating: 8.9, runtime: 49, overview: "A chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine with a former student.", seasons: [5, 13], cast: ["Bryan Cranston", "Aaron Paul"], crew: ["Vince Gilligan"], popular: 99 },
  { id: "attack-on-titan", title: "Attack on Titan", year: 2013, date: "2013-04-07", genres: ["Animation", "Anime", "Action", "Drama"], rating: 8.7, runtime: 24, overview: "After his hometown is destroyed, young Eren Jaeger vows to cleanse the earth of the giant humanoid Titans that have brought humanity to the edge of extinction.", seasons: [4, 12], cast: ["Yuki Kaji", "Marina Inoue"], crew: ["Tetsuro Araki"], popular: 95 },
  { id: "stranger-things", title: "Stranger Things", year: 2016, date: "2016-07-15", airing: true, genres: ["Drama", "Sci-Fi", "Horror"], rating: 8.6, runtime: 51, overview: "When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.", seasons: [4, 9], cast: ["Millie Bobby Brown", "Finn Wolfhard"], crew: ["The Duffer Brothers"], popular: 94 },
  { id: "the-bear", title: "The Bear", year: 2022, date: "2022-06-23", announced: true, genres: ["Drama", "Comedy"], rating: 8.5, runtime: 30, overview: "A young chef from the fine dining world returns to Chicago to run his family's sandwich shop.", seasons: [3, 10], cast: ["Jeremy Allen White", "Ayo Edebiri"], crew: ["Christopher Storer"], popular: 88 },
  { id: "arcane", title: "Arcane", year: 2021, date: "2021-11-06", airing: true, genres: ["Animation", "Action", "Adventure", "Drama"], rating: 8.7, runtime: 42, overview: "Amid the stark discord of twin cities Piltover and Zaun, two sisters fight on rival sides of a war between magic technologies and clashing convictions.", seasons: [2, 9], cast: ["Hailee Steinfeld", "Ella Purnell"], crew: ["Christian Linke"], popular: 91 },
  { id: "succession", title: "Succession", year: 2018, date: "2018-06-03", genres: ["Drama", "Comedy"], rating: 8.5, runtime: 58, overview: "The Roy family is known for controlling the biggest media and entertainment company in the world. However, their world changes when their father steps down from the company.", seasons: [4, 10], cast: ["Brian Cox", "Jeremy Strong"], crew: ["Jesse Armstrong"], popular: 82 },
  { id: "chernobyl", title: "Chernobyl", year: 2019, date: "2019-05-06", genres: ["Drama", "History", "Thriller"], rating: 8.7, runtime: 62, overview: "In April 1986, an explosion at the Chernobyl nuclear power plant becomes one of the world's worst man-made catastrophes.", seasons: [1, 5], cast: ["Jared Harris", "Stellan Skarsgård"], crew: ["Craig Mazin"], popular: 78 },
  { id: "dark", title: "Dark", year: 2017, date: "2017-12-01", genres: ["Sci-Fi", "Mystery", "Thriller"], rating: 8.4, runtime: 56, overview: "A family saga with a supernatural twist, set in a German town where the disappearance of two young children exposes the double lives and fractured relationships among four families.", seasons: [3, 8], cast: ["Louis Hofmann", "Lisa Vicari"], crew: ["Baran bo Odar"], popular: 80 },
  { id: "the-office", title: "The Office", year: 2005, date: "2005-03-24", genres: ["Comedy"], rating: 8.5, runtime: 22, overview: "A mockumentary on a group of typical office workers, where the workday consists of ego clashes, inappropriate behavior and tedium.", seasons: [9, 24], cast: ["Steve Carell", "Rainn Wilson"], crew: ["Greg Daniels"], popular: 86 },
  { id: "severance", title: "Severance", year: 2022, date: "2022-02-18", airing: true, genres: ["Thriller", "Drama", "Sci-Fi"], rating: 8.4, runtime: 48, overview: "Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives.", seasons: [2, 9], cast: ["Adam Scott", "Britt Lower"], crew: ["Dan Erickson"], popular: 89 },
  { id: "cowboy-bebop-anime", title: "Cowboy Bebop", year: 1998, date: "1998-04-03", genres: ["Animation", "Anime", "Action", "Sci-Fi"], rating: 8.6, runtime: 24, overview: "A futuristic bounty hunter crew travels the solar system on the spaceship Bebop, chasing criminals and their own pasts.", seasons: [1, 26], cast: ["Koichi Yamadera", "Megumi Hayashibara"], crew: ["Shinichiro Watanabe"], popular: 75 },
  { id: "frieren", title: "Frieren: Beyond Journey's End", year: 2023, date: "2023-09-29", airing: true, genres: ["Animation", "Anime", "Adventure", "Fantasy"], rating: 8.9, runtime: 24, overview: "After the party of heroes defeated the Demon King, the elf mage Frieren begins a slower journey to understand human life.", seasons: [1, 28], cast: ["Atsumi Tanezaki", "Kana Ichinose"], crew: ["Keiichiro Saito"], popular: 90 },
  { id: "andor", title: "Andor", year: 2022, date: "2022-09-21", announced: true, genres: ["Sci-Fi", "Drama", "Adventure"], rating: 8.4, runtime: 45, overview: "Cassian Andor embarks on a path that will turn him into a rebel hero in the early days of the rebellion.", seasons: [2, 12], cast: ["Diego Luna", "Stellan Skarsgård"], crew: ["Tony Gilroy"], popular: 84 },
  { id: "shogun", title: "Shōgun", year: 2024, date: "2024-02-27", genres: ["Drama", "History", "Adventure"], rating: 8.6, runtime: 60, overview: "In feudal Japan, an English navigator becomes both a pawn and a player in a battle for power.", seasons: [1, 10], cast: ["Hiroyuki Sanada", "Cosmo Jarvis"], crew: ["Justin Marks"], popular: 87 },
];

const GAMES: LocalItem[] = [
  { id: "hades", title: "Hades", year: 2020, date: "2020-09-17", genres: ["Action", "Roguelike", "RPG"], rating: 9.0, runtime: 0, overview: "Defy the god of the dead as you hack and slash out of the Underworld in this rogue-like dungeon crawler.", developer: "Supergiant Games", publisher: "Supergiant Games", platforms: ["PC", "Switch", "PS5", "Xbox"], playtime: 22, popular: 88 },
  { id: "elden-ring", title: "Elden Ring", year: 2022, date: "2022-02-25", genres: ["RPG", "Action", "Adventure"], rating: 9.2, runtime: 0, overview: "Rise, Tarnished, and be guided by grace to brandish the power of the Elden Ring and become an Elden Lord in the Lands Between.", developer: "FromSoftware", publisher: "Bandai Namco", platforms: ["PC", "PS5", "Xbox Series X|S"], playtime: 80, popular: 96 },
  { id: "baldurs-gate-3", title: "Baldur's Gate 3", year: 2023, date: "2023-08-03", genres: ["RPG", "Strategy", "Adventure"], rating: 9.4, runtime: 0, overview: "Gather your party and return to the Forgotten Realms in a story of fellowship, betrayal and untold power.", developer: "Larian Studios", publisher: "Larian Studios", platforms: ["PC", "PS5", "Xbox Series X|S"], playtime: 120, popular: 95 },
  { id: "zelda-totk", title: "The Legend of Zelda: Tears of the Kingdom", year: 2023, date: "2023-05-12", genres: ["Adventure", "Action", "RPG"], rating: 9.3, runtime: 0, overview: "An epic adventure across the land and skies of Hyrule awaits as you use new powers to build, fuse and explore.", developer: "Nintendo EPD", publisher: "Nintendo", platforms: ["Switch"], playtime: 90, popular: 93 },
  { id: "celeste", title: "Celeste", year: 2018, date: "2018-01-25", genres: ["Platformer", "Indie"], rating: 8.8, runtime: 0, overview: "Help Madeline survive her inner demons on her journey to the top of Celeste Mountain.", developer: "Maddy Makes Games", publisher: "Maddy Makes Games", platforms: ["PC", "Switch", "PS4"], playtime: 10, popular: 72 },
  { id: "disco-elysium", title: "Disco Elysium", year: 2019, date: "2019-10-15", genres: ["RPG", "Indie"], rating: 9.1, runtime: 0, overview: "An open-world RPG in which you play a detective with a unique skill system and a whole city block to interrogate.", developer: "ZA/UM", publisher: "ZA/UM", platforms: ["PC", "PS5", "Switch"], playtime: 35, popular: 70 },
  { id: "hollow-knight", title: "Hollow Knight", year: 2017, date: "2017-02-24", genres: ["Platformer", "Indie", "Adventure"], rating: 9.0, runtime: 0, overview: "Forge your own path in a vast ruined kingdom of insects and heroes.", developer: "Team Cherry", publisher: "Team Cherry", platforms: ["PC", "Switch", "PS4"], playtime: 30, popular: 74 },
  { id: "god-of-war-ragnarok", title: "God of War Ragnarök", year: 2022, date: "2022-11-09", genres: ["Action", "Adventure"], rating: 9.0, runtime: 0, overview: "Kratos and Atreus journey to each of the Nine Realms in search of answers as Asgardian forces prepare for a prophesied battle.", developer: "Santa Monica Studio", publisher: "Sony", platforms: ["PS5", "PS4", "PC"], playtime: 45, popular: 90 },
  { id: "stardew-valley", title: "Stardew Valley", year: 2016, date: "2016-02-26", genres: ["Simulation", "RPG", "Indie"], rating: 8.9, runtime: 0, overview: "You've inherited your grandfather's old farm plot. Armed with hand-me-down tools, you set out to build a new life.", developer: "ConcernedApe", publisher: "ConcernedApe", platforms: ["PC", "Switch", "Mobile"], playtime: 60, popular: 78 },
  { id: "cyberpunk-2077", title: "Cyberpunk 2077", year: 2020, date: "2020-12-10", genres: ["RPG", "Action", "Shooter"], rating: 8.3, runtime: 0, overview: "An open-world action-adventure story set in Night City, a megalopolis obsessed with power, glamour and body modification.", developer: "CD Projekt Red", publisher: "CD Projekt", platforms: ["PC", "PS5", "Xbox Series X|S"], playtime: 70, popular: 85 },
  { id: "portal-2", title: "Portal 2", year: 2011, date: "2011-04-19", genres: ["Puzzle", "Shooter"], rating: 9.2, runtime: 0, overview: "A first-person puzzle platformer that takes you through the dilapidated Aperture Science laboratories.", developer: "Valve", publisher: "Valve", platforms: ["PC", "PS3", "Xbox 360"], playtime: 12, popular: 66 },
  { id: "outer-wilds", title: "Outer Wilds", year: 2019, date: "2019-05-28", genres: ["Adventure", "Puzzle", "Indie"], rating: 9.0, runtime: 0, overview: "An open world mystery about a solar system trapped in an endless time loop.", developer: "Mobius Digital", publisher: "Annapurna Interactive", platforms: ["PC", "PS5", "Switch"], playtime: 18, popular: 62 },
  { id: "balatro", title: "Balatro", year: 2024, date: "2024-02-20", genres: ["Card", "Roguelike", "Indie"], rating: 8.9, runtime: 0, overview: "A hypnotically satisfying deckbuilder where you craft illegal poker hands and discover game-changing jokers.", developer: "LocalThunk", publisher: "Playstack", platforms: ["PC", "Switch", "Mobile"], playtime: 25, popular: 80 },
  { id: "silent-hill-2", title: "Silent Hill 2", year: 2001, date: "2001-09-24", genres: ["Horror", "Adventure"], rating: 8.9, runtime: 0, overview: "James Sunderland receives a letter from his deceased wife asking him to meet her in the foggy town of Silent Hill.", developer: "Team Silent", publisher: "Konami", platforms: ["PS2"], playtime: 9, popular: 55 },
  { id: "monster-hunter-wilds", title: "Monster Hunter Wilds", year: 2025, date: "2025-02-28", genres: ["Action", "RPG"], rating: 8.4, runtime: 0, overview: "Hunt ferocious beasts in a dynamic, ever-changing world alongside your companions and trusty Seikret.", developer: "Capcom", publisher: "Capcom", platforms: ["PC", "PS5", "Xbox Series X|S"], playtime: 55, popular: 89 },
];

const BY_TYPE: Record<MediaType, LocalItem[]> = {
  movie: MOVIES,
  tv: SHOWS,
  game: GAMES,
};

const DAY = 24 * 3600 * 1000;

function seasonCount(item: LocalItem): number {
  if (!item.seasons) return 0;
  return item.seasons[0] + (item.announced ? 1 : 0);
}

function episodeAirDate(item: LocalItem, season: number, index: number, count: number): string {
  const regular = item.seasons?.[0] ?? 0;
  if (item.announced && season === regular + 1) {
    // Announced season: premieres in ~5 weeks, then weekly.
    return new Date(Date.now() + (35 + index * 7) * DAY).toISOString().slice(0, 10);
  }
  if (item.airing && season === regular) {
    // Weekly drops centred on today so there is always something aired and upcoming.
    const offset = (index - Math.floor(count / 2)) * 7;
    return new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
  }
  const year = item.year + (season - 1);
  return `${year}-09-${String(Math.min(28, 1 + index * 2)).padStart(2, "0")}`;
}

function toNormalized(item: LocalItem, type: MediaType): NormalizedMedia {
  const seasons =
    type === "tv" && item.seasons
      ? Array.from({ length: seasonCount(item) }, (_, index) => ({
          seasonNumber: index + 1,
          name: `Season ${index + 1}`,
          episodeCount: item.seasons![1],
          airDate: episodeAirDate(item, index + 1, 0, 1),
          overview: `Season ${index + 1} of ${item.title}.`,
          posterUrl: null,
        }))
      : [];

  return {
    provider: "local",
    externalId: `local-${type}-${item.id}`,
    type,
    title: item.title,
    originalTitle: item.title,
    year: item.year,
    releaseDate: item.date,
    overview: item.overview,
    posterUrl: null,
    backdropUrl: null,
    trailerUrl: null,
    genres: item.genres,
    externalRating: item.rating,
    runtime: type === "game" ? null : item.runtime,
    popularity: item.popular,
    seasons,
    metadata: {
      director: type === "movie" ? item.crew?.[0] ?? null : null,
      creator: type === "tv" ? item.crew?.[0] ?? null : null,
      cast: item.cast ?? [],
      studios: item.studio ? [item.studio] : [],
      developers: type === "game" ? (item.developer ? [item.developer] : []) : [],
      publishers: type === "game" ? (item.publisher ? [item.publisher] : []) : [],
      platforms: type === "game" ? item.platforms ?? [] : [],
      averagePlaytime: type === "game" ? item.playtime ?? null : null,
      status: type === "tv" ? (item.airing || item.announced ? "Returning Series" : "Ended") : null,
      inProduction: type === "tv" ? Boolean(item.airing || item.announced) : false,
      language: "en",
      countries: [],
      source: "Built-in offline catalog",
    },
  };
}

/**
 * Offline fallback provider. Keeps the whole app usable (search, discovery,
 * tracking, stats) when no external metadata provider is configured.
 */
export class LocalProvider implements MediaProvider {
  id = "local";
  label = "Built-in catalog (offline)";
  supports: MediaType[] = ["movie", "tv", "game"];

  async isConfigured() {
    return true;
  }

  async search(query: string, type: MediaType): Promise<NormalizedMedia[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return BY_TYPE[type]
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.genres.some((genre) => genre.toLowerCase().includes(q)),
      )
      .slice(0, 20)
      .map((item) => toNormalized(item, type));
  }

  async getDetails(externalId: string, type: MediaType): Promise<NormalizedMedia | null> {
    const item = BY_TYPE[type].find((entry) => `local-${type}-${entry.id}` === externalId);
    if (!item) throw new ProviderError("Not found", "unavailable");
    return toNormalized(item, type);
  }

  async getDiscovery(kind: DiscoveryKind, type: MediaType): Promise<NormalizedMedia[]> {
    const pool = [...BY_TYPE[type]];
    if (kind === "upcoming") {
      const upcoming = pool
        .filter((item) => new Date(item.date).getTime() > Date.now())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      if (upcoming.length >= 4) return upcoming.map((item) => toNormalized(item, type));
      const future = pool.slice(0, 8).map((item, index) => {
        const date = new Date(Date.now() + (index + 1) * 26 * 24 * 3600 * 1000);
        return {
          ...item,
          date: date.toISOString().slice(0, 10),
          year: date.getUTCFullYear(),
          upcomingHint: true,
        } as LocalItem;
      });
      return future.map((item) => toNormalized(item, type));
    }
    if (kind === "trending") {
      return pool
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 18)
        .map((item) => toNormalized(item, type));
    }
    return pool
      .sort((a, b) => b.popular - a.popular)
      .slice(0, 18)
      .map((item) => toNormalized(item, type));
  }

  async getSeason(externalId: string, season: number): Promise<NormalizedEpisode[]> {
    const type: MediaType = "tv";
    const item = BY_TYPE.tv.find((entry) => `local-${type}-${entry.id}` === externalId);
    if (!item) throw new ProviderError("Not found", "unavailable");
    const count = item.seasons?.[1] ?? 8;
    return Array.from({ length: count }, (_, index) => ({
      season,
      episode: index + 1,
      name: `Episode ${index + 1}`,
      airDate: episodeAirDate(item, season, index, count),
      overview: `Episode ${index + 1} of season ${season} of ${item.title}.`,
      stillUrl: null,
      runtime: item.runtime,
      rating: null,
      guestCast: [],
      network: item.studio ?? null,
    }));
  }

  async testConnection() {
    return { ok: true, status: "connected" as const, message: "Built-in catalog is always available" };
  }
}
