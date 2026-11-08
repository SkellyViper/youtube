# Fern (@fern-tv) — Public Catalog Inventory (metadata level)

Snapshot date: 2026-11-08. Compiled with WebSearch/WebFetch only (35 web calls). No videos were watched; nothing below is a visual observation. Every row is backed by a fetched page or search result; nothing was invented.

Channel identity (confirmed by multiple sources):
- Name: **fern** — handle `@fern-tv` — channel ID `UCODHrzPMGbNv67e84WDZhQQ` (YouTube RSS feed author URL; vidiq; vidanalyze)
- Bio as recorded by CreatorDB: "Armchair documentaries, almost weekly. Made by @Simplicissimus. Occasional voice-overs by @hoog-youtube"
- 147 public videos, 5.66M subscribers, 728M views as of 2026-11-08 (vidiq)

---

## 1. Method and coverage honesty statement

### What was done
| Source | Result |
|---|---|
| `youtube.com/@fern-tv/videos` and the 4 `watch?v=` pages | HTML returned only nav/footer + `<title>`; no ytInitialData survived the fetcher. Usable only to read the page title (= video title). |
| `youtube.com/oembed?url=...` for 5 IDs | Worked. Confirms title + `author_name: fern` + `author_url: https://www.youtube.com/@fern-tv` for each ID. |
| `youtube.com/feeds/videos.xml?channel_id=UCODHrzPMGbNv67e84WDZhQQ` | Worked. Official Atom feed: the 15 newest uploads with exact IDs, ISO publish timestamps and view counts. Authoritative. |
| `thetvdb.com/series/fern/allseasons/official` | Worked. Fan-maintained episode index, 147 episodes S2023E01–S2026E43 with air dates and one-line descriptions. Count matches vidiq's 147. Spot-checked ~20 dates against RSS/vidiq/rosetta: all matched. Titles sometimes differ from current YouTube titles (fern re-titles videos; TVDB appears to keep one version). No IDs. |
| `vidiq.com/youtube-stats/channel/UCODHrzPMGbNv67e84WDZhQQ` | Worked. Channel stats + top-5 videos with IDs and dates + latest video. |
| `rosetta.to/u/fern-tv` (+ `/topic/cybersecurity`) | Worked. 25 videos (Nov 2025–May 2026) with IDs (from thumbnail URLs), dates, views, 3 durations. IDs cross-checked: `wLFY_Zu_O08` matches oembed. |
| `creatordb.app/creatorstats/fern-tv/` | Worked. Bio text, country NL, 5 recent titles (no IDs). |
| `vidanalyze.com/channel/fern-tv/videos` | Stats only; video list broken on their side. |
| `watchfern.com/`, `/about`, `/jobs` | Worked. `/about` is the richest studio source (full team roster). `/jobs` currently lists no roles, so no software requirements were obtainable there. |
| `de.wikipedia.org/wiki/Simplicissimus_(YouTube-Kanal)` | Worked. Founding history, funk period, Electrify ownership, fern stats as of 2026-08-27. |
| `gist.ly` summary of "The Truth About fern" (`TlioXObelHU`) | Worked (third-party AI summary of fern's own video — treat as secondary). Process facts, hours per video, founders' history. |
| `pluggedin.com/youtube-reviews/fern/` (2026-04-17) | Worked. Topic list, "armchair documentaries", self-made animations, creators "David, Jonas, Elmer". |
| `businessoftv.substack.com` (2025-03-05) | Worked. Older stats (2.3M subs). |
| `pulse.bot` (Dexerto repost, GEN private-equity story) | Failed twice (socket closed). Facts about it below come from search snippets only. |
| `blenderartists.org` thread | Worked but contains no claim about fern's tools (only a fan wanting to imitate fern in Blender). |
| 6 WebSearch queries | Found channel ID, TVDB, rosetta, one mirror ID (`WyQ7z8BMwwk`), Electrify/GEN coverage, a secondary article claiming Blender. No Reddit title lists or playlists surfaced. |

### What could not be accessed
- YouTube's own HTML (channel page, playlists, video descriptions, durations, exact view counts beyond the RSS 15 and vidiq top 5).
- Any primary statement by fern about **software/tools**. Neither watchfern.com nor the Simplicissimus/fern pages name Blender, Cinema 4D, After Effects, Unreal, etc. The only "Blender" claim is a secondary blog (sigmastory.in) with no citation — recorded below as unverified.
- Per-video animation approach. Only three videos have a stated approach in any fetched source (TVDB descriptions: "animated reconstruction" for the Trump shooting; "reconstruction" for the Charlie Kirk shooting; on-the-ground crew for the Wakhan Corridor video per fern's own origin video). Everything else is marked `unknown`.
- Shorts, members-only, unlisted or deleted videos; the pre-2023 history of the channel (created 2020-09-24, possibly as the earlier English channel "reasy") is not visible in any list.

### Coverage estimate
- **Titles + dates: ~100% of the 147 public long-form videos** (TVDB 147 = vidiq 147; fan-maintained, cross-checked on ~20 entries with zero date mismatches). Title wording may differ from the current YouTube title for an unknown fraction (observed on 11 of 43 videos in 2026 where two sources existed).
- **Watch IDs: 47 of 147 (~32%)**: 15 from the official RSS feed, 5 from vidiq, 25 from rosetta (24 new), 2 from oembed (Xbox, Truth About fern), 1 from a third-party mirror (banks heist, unverified).
- **Priority IDs: 4 of 4 confirmed** as fern uploads with dates (see table; all four via oembed + TVDB, three additionally via RSS/vidiq/rosetta).
- Topic column is **inferred from title/description**, not stated by fern.

---

## 2. Studio facts with sources

| Fact | Detail | Source |
|---|---|---|
| Origin | fern "Born in 2023"; founded by the team behind **Simplicissimus** (German channel) and **Hoog** (Dutch animator channel). Hoog has stepped away except for occasional voice-over. | https://www.watchfern.com/about |
| Founders | **Jonas** and **David** (co-founders), met in high school in Germany; studied in Amsterdam; founded Simplicissimus 2.0 on 2015-04-12. | https://de.wikipedia.org/wiki/Simplicissimus_(YouTube-Kanal); gist.ly summary of `TlioXObelHU` |
| Third core member | **Elmer** (creator of Hoog / "Hook") joined 2022, "brought 3D storytelling expertise", later stepped back from core team; remains primary voice-over. Pluggedin names the trio as "David, Jonas, and Elmer". | gist.ly summary of `TlioXObelHU`; https://www.pluggedin.com/youtube-reviews/fern/ |
| Name | "fern" = German *Fernweh* + *Fernsehen*. | gist.ly summary of `TlioXObelHU` |
| Precursor channels | reasy / Reezey (English, 2019-08-23 to 2020-01-16, 6 videos, ~99k subs) replaced by fern. Simplicissimus was part of German public broadcaster network **funk** 2019-10-06 to 2022-05-15, left for independence. | de.wikipedia (Kanäle section); gist.ly |
| YouTube channel created | 2020-09-24 (channel object); first fern video 2023-07-11 ("How a Pilot Hijacked a Plane"). | vidiq; TVDB S2023E01; gist.ly ("launched July 11, 2023") |
| Location | Office in **Amsterdam, Netherlands**; team spread across Europe. Stats sites list country NL. | watchfern.com/about; creatordb; vidiq |
| Team size | "Around 100 people work across the channels and podcast" (fern + Simplicissimus + podcast). Founders' own video: "roughly 60 employees and freelancers". Simplicissimus alone: 32 employees. | watchfern.com/about; gist.ly; de.wikipedia citing simpli.de |
| Team composition (fern roster) | Leadership: David & Jonas (Co-Founders), Paul Lühnsdorf & Cristian Kiesling (Executive Producers), Chris Varga & Jonas Rump (Senior Editors-in-Chief), Lucie Schöner (Jr EiC), Mona Schier (Senior Producer), **Nikki Zeinar (Head of Design)**. Art Directors: Nora Friese, **Thomas Overbeeke (Art Director & Senior 3D Animator)**, Marcel Becker-Neu, Lucas Bardic, Philipp. **Gereon Wahle: Writer & Set Designer**. **Alejandro Castellanos Paz: 3D Thumbnail Designer**. **3D animation: Lenz Schöler (Senior) + 10 3D Animators** (Mel Wagner, Leonard Flohr, Sidney Heaney, Aziz Dereli, Lucas Göhr, Nil Tomm, Nikolai Nordmann, Ben Sommerhäuser, Killian van Basten, Victor Schroers). **2D motion design: 12 designers** (Mathias Hawk, Marlene Sandmann, Long Huy Dao, Jakob Werner, Dennis Gajdek, Konne Fuchs, Leo Sebastian Jung, Lex Mittermiller, Max Pregler, Eddy Klaus, Jakob Schöne, Tim Verhaert). **Video editors: 10**. Writers ~12, Researcher, Translators, Reporter (Valentin Macke). Narrators: Elmer, Don, Marcel (Simpli). **Fact-checking: Pascale Müller (Head) + 4 fact-checkers**. Audio: Leo Wang (Sound Designer), Studio Soma (Audio Engineers). Production Coordinator: Vera Hartlieb. | https://www.watchfern.com/about |
| Stated production process | "Began with animation to visualize complex information; since added investigative on-the-ground reporting and in-person interviews." Founders' video: **500–1,000 labor hours per video**; ~30 projects in parallel; research days–weeks then months (expert interviews, on-the-ground reporting); script passes editor-in-chief + fact-checking; **post-production (animation, music, sound design) takes 2–4 months**. Dark-web/hacking investigations established the visual identity incl. "mystery board" 3D thumbnails. | watchfern.com/about; gist.ly summary of `TlioXObelHU` |
| Software / tools | **Not stated anywhere primary.** watchfern.com, simpli.de, Wikipedia and the jobs page name no software. One secondary blog (sigmastory.in, "Fern Proves High-End 3D Animation...") asserts "3D animations and spatial reconstructions built in Blender" without citation — **unverified**. The roster split (11 "3D Animators", 12 "2D Motion Designers", 1 "3D Thumbnail Designer", 1 "Set Designer") is the only hard evidence of a 3D + 2D pipeline. | watchfern.com/about; watchfern.com/jobs (empty); sigmastory.in (via search snippet) |
| Style self-description | "Armchair documentaries, almost weekly." Pluggedin: channel "makes its own animations to reenact events", most videos have "a distinctly animated intro sequence and music", narrator reads quotes aloud. | creatordb bio; pluggedin.com review 2026-04-17 |
| Partners / clients shown | BBC, Veritasium, New York Times, OCCRP, Dossier, The Examination, WP. "Select projects are made with established outlets to bring their reporting to life." Simplicissimus collaborations: SWR ("Putins Bären", Feb 2024, Russian hackers), Die Zeit (fake-shop investigation, Nov 2024). | watchfern.com; de.wikipedia |
| Business / ownership | Revenue = AdSense + sponsors; third pillar "Roots" (newsletter/community) launching. **Electrify Video Partners** partnership since Jan 2025 (handles HR/legal back office, brings Netflix/BBC-background production staff). de.wikipedia: Electrify holds **majority stakes** in Simplicissimus and fern since 2025-01-01. Electrify is backed by PE fund Capital D ($85M, Sept 2023). April 2026: viral GEN video on private equity buying YouTube channels; Dexerto (2026-04-19) reports co-founder Jonas asserting editorial independence. | watchfern.com/about; gist.ly; de.wikipedia; electrify.video news; tubefilter/tech.eu 2023; pulse.bot/Dexerto (snippet only) |
| Awards | "Honored with several creative awards" (unnamed). Founders' video calls the Wakhan Corridor documentary (crew sent to Afghanistan) award-winning. | watchfern.com/about; gist.ly |
| Podcast | German-language podcast *Unfassbar* (launched Oct 2024, hosts Jonas, Marcel, Janne), Spotify. | watchfern.com/about; de.wikipedia |
| Growth datapoints | 2025-03: 2.3M subs / 150M views (Business of TV). 2026-08-27: 5.29M / 584M / 137 videos (de.wikipedia). 2026-11-08: 5.66M / 728M / 147 videos (vidiq). Most-viewed: "Mapping the Trump Shooting" 22.0M; "The Kids Who Hacked The CIA" 20.3M. | businessoftv; de.wikipedia; vidiq |
| Behind-the-scenes video | **"The Truth About fern"** — `https://www.youtube.com/watch?v=TlioXObelHU` — 2026-07-22 — fern's own account of how the channel makes videos and what is next (oembed confirms channel; TVDB S2026E28; content via gist.ly summary). | oembed; TVDB; gist.ly |

---

## 3. Catalog table (sorted by date)

Legend — **Topic** (inferred from title/TVDB description): CYB = cybersecurity/hacking, TECH = technology/engineering/design, HIST = history, INV = investigative/business exposé, NET = internet culture, CRIME = true crime, GEO = geopolitics, OTHER.
**Anim** = animation approach *as stated by a source*; `unk` = unknown (channel-level fact: a 3D + 2D team exists, see §2).
**Src**: RSS = official YouTube Atom feed (ID+date+views exact); TVDB = thetvdb.com episode index (title+date); VQ = vidiq (ID+date+views); RO = rosetta.to (ID+date+views); OE = YouTube oembed (title+channel); MIR = third-party mirror (unverified ID); PI = pluggedin review (topic).
Where the TVDB title differs from a title seen on YouTube-derived sources, the YouTube-side title is listed first and the TVDB variant in parentheses.

| Date | Title | ID / URL | Topic | Anim | Relevance for AI/cyber 3D-reenactment channel | Src |
|---|---|---|---|---|---|---|
| 2023-07-11 | How a Pilot Hijacked a Plane | unknown | OTHER (aviation/crime) | unk | Launch video (Germanwings 9525); baseline for the earliest fern look, likely cockpit/physical reenactment subject | TVDB, PI |
| 2023-07-19 | Putin's Hidden Bunkers | unknown | GEO | unk | Early architectural/underground-space subject | TVDB |
| 2023-07-25 | Why McDonald's Is Better in Europe | unknown | OTHER (business) | unk | Low relevance; consumer explainer | TVDB |
| 2023-08-06 | Germany: The Dark Secrets of the Super Rich | unknown | INV/HIST | unk | Early investigative-history format | TVDB |
| 2023-08-13 | The Strange Design of American Toilets | unknown | TECH (design) | unk | Early product/design explainer | TVDB |
| 2023-08-20 | The Hunt for the King of the Dark Web | gq01C2kjMiM | CYB | unk | First cyber breakout (16.9M views); defines early dark-web visual identity | VQ, TVDB |
| 2023-08-27 | The Netherlands is a Giant City | unknown | OTHER (urbanism) | unk | Maps/spatial subject | TVDB |
| 2023-09-14 | How Sweden Is Becoming Insanely Rich | unknown | OTHER (economics) | unk | Low relevance | TVDB |
| 2023-09-21 | How Coca-Cola Is Killing Mexico | unknown | INV | unk | Early on-location-style investigation subject | TVDB |
| 2023-09-28 | The McDonald's Glass Scandal | unknown | INV | unk | Low relevance | TVDB |
| 2023-10-08 | Why North Korea Is Hiding This Hotel | unknown | GEO | unk | Architecture-centric 3D subject | TVDB |
| 2023-10-22 | Australia's Secret Chernobyl | unknown | HIST/INV | unk | Environmental-disaster reenactment subject | TVDB |
| 2023-11-09 | The Hunt for America's Deadliest Hitman | unknown | CRIME | unk | First "The Hunt for..." manhunt format | TVDB |
| 2023-11-22 | How This Couch Broke IKEA | unknown | OTHER (business) | unk | Low relevance | TVDB |
| 2023-12-03 | Exposing a $140,000,000 Scam | unknown | INV | unk | Scam-exposé format (Healy pt 1) | TVDB |
| 2023-12-10 | The Most Evil Medicine In The World | unknown | INV | unk | Healy pt 2; two-part investigation | TVDB |
| 2023-12-20 | Shell's Biggest Marketing Scam | unknown | INV | unk | Corporate exposé | TVDB |
| 2023-12-28 | How Kim Jong Un Travels | unknown | GEO | unk | Vehicle/logistics 3D subject | TVDB |
| 2024-01-16 | Why the World's Biggest Aquarium Broke | unknown | TECH | unk | Engineering-failure reconstruction subject | TVDB |
| 2024-01-28 | The Dirty Business Behind Caffeine | unknown | INV | unk | Low relevance | TVDB |
| 2024-02-04 | What Faking Cancer Looks Like | unknown | CRIME | unk | Based on a BBC podcast; outlet collaboration | TVDB |
| 2024-02-11 | Why Europe Has No Hollywood | unknown | OTHER (culture) | unk | Low relevance | TVDB |
| 2024-02-23 | Why German Sounds So Aggressive | unknown | OTHER (culture) | unk | Low relevance | TVDB |
| 2024-03-06 | /stol/: The Worst Place on the Internet | unknown | NET | unk | Internet-forum culture (2014 Fappening leak); screen-world depiction | TVDB |
| 2024-03-17 | **The Kids Who Hacked The CIA** | **PmtFtWVrxFE** | CYB | unk | **Priority #1.** 20.3M views; teen hackers vs CIA; the archetypal fern hacker story | OE, VQ, TVDB |
| 2024-03-31 | Hitler's Insane Train | unknown | HIST | unk | Megastructure 3D subject | TVDB |
| 2024-04-09 | The Biggest Fraud on TV | unknown | CRIME | unk | Quiz-show fraud; low cyber relevance | TVDB |
| 2024-04-19 | The Hunt for Ted Bundy | unknown | CRIME | unk | Manhunt format | TVDB, PI |
| 2024-04-30 | How Communists Made Unbreakable Glass | unknown | HIST/TECH | unk | Material-science explainer | TVDB |
| 2024-05-06 | The Bizarre World of North Korean Influencers | unknown | NET/GEO | unk | Online-culture + propaganda | TVDB |
| 2024-05-23 | The Evil Design of Mercedes Tower | unknown | TECH (architecture) | unk | Architecture 3D subject | TVDB |
| 2024-05-31 | Trump's Favorite Prison | unknown | GEO | unk | CECOT; institutional-interior subject | TVDB |
| 2024-06-09 | How a CIA Base Works | unknown | OTHER (intelligence) | unk | Facility walkthrough subject | TVDB |
| 2024-06-24 | The Hunt for Europe's Most Wanted Criminal | unknown | CRIME | unk | Manhunt format | TVDB |
| 2024-07-03 | Inside China's Torture Camps for Teens | unknown | INV | unk | Institutional exposé | TVDB |
| 2024-07-14 | The Weirdest Hoax on the Internet | unknown | NET | unk | Internet-culture story | TVDB |
| 2024-07-16 | Mapping the Trump Shooting | aVA7aXOH1pk | INV (news) | **Animated reconstruction** (TVDB description) | Most-viewed fern video (22.0M); published 3 days after event; proves a fast 3D-reconstruction pipeline | VQ, TVDB |
| 2024-07-21 | The Plans to Assassinate Hitler | unknown | HIST | unk | Historical reenactment | TVDB |
| 2024-07-30 | The $2.1 Billion McDonald's Machine | unknown | TECH/business | unk | Self-order kiosks; UI/tech-product subject | TVDB |
| 2024-08-08 | The Game That Stole $130,000,000 | unknown | NET/INV | unk | Video-game scam; digital-economy story | TVDB |
| 2024-08-14 | How the CIA Stole a Russian Submarine | unknown | HIST | unk | Project Azorian; large mechanical 3D subject | TVDB |
| 2024-09-01 | The McDonald's Monopoly Scam | unknown | CRIME | unk | Fraud story | TVDB |
| 2024-09-08 | Is Wikipedia Secretly Rich? | unknown | NET | unk | Internet-institution explainer | TVDB |
| 2024-09-15 | The Worst Hotel in Las Vegas | unknown | OTHER | unk | Low relevance | TVDB |
| 2024-09-23 | **The Kids Who Hacked Xbox** | **LZkl0_9xFOU** | CYB | unk | **Priority #2.** Teen hackers vs game studios; hardware + corporate-intrusion story | OE, TVDB |
| 2024-09-30 | Inside Japan's Secret Torture Lab | unknown | HIST | unk | Unit 731; dark-history reenactment | TVDB, PI |
| 2024-10-06 | How a Hacker Saved the Internet | unknown | CYB | unk | "Master key to internet servers" thwarted; abstract infrastructure visualization problem | TVDB |
| 2024-10-15 | The ancient computer that simply shouldn't exist | unknown | HIST/TECH | unk | Antikythera-type mechanism; 3D artifact reconstruction subject | TVDB |
| 2024-10-25 | A New Ocean Is Forming in Africa | unknown | OTHER (science) | unk | Geological maps subject | TVDB |
| 2024-11-01 | What will Trump's second term look like? | unknown | OTHER (politics) | unk | Low relevance | TVDB |
| 2024-11-10 | Why German Cities Look Ugly | unknown | OTHER (urbanism) | unk | Low relevance | TVDB |
| 2024-11-17 | The CIA's Scariest Weapon | unknown | TECH/intelligence | unk | Weapon-mechanism 3D subject | TVDB |
| 2024-11-24 | What Was on Bin Laden's Hard Drive? | unknown | TECH/intelligence | unk | Digital-forensics subject | TVDB |
| 2024-12-01 | Europe's Strangest Unsolved Crime | unknown | CRIME | unk | Oury Jalloh case; cell-reconstruction subject | TVDB |
| 2024-12-08 | ANØM: The Most Genius FBI Operation | unknown | CYB | unk | Encrypted-phone sting (Operation Trojan Shield); device + network story | TVDB |
| 2024-12-22 | How America Destroyed Iran's Nuclear Program | unknown | CYB | unk | **Stuxnet**; malware with physical consequences, closest analog to AI/cyber-physical explainers | TVDB |
| 2024-12-30 | South Korea Is a Dystopia | unknown | GEO/economics | unk | Low relevance | TVDB |
| 2025-01-05 | How This Woman Exposed Wall Street | unknown | INV | unk | Whistleblower story | TVDB |
| 2025-01-11 | How Hackers Stole $1,000,000,000 From Banks | WyQ7z8BMwwk (unverified, via mirror) | CYB | unk | Carbanak-type bank intrusion; 14:11 long per mirror | MIR, TVDB |
| 2025-01-19 | The Genius Design of Narco Submarines | unknown | TECH/CRIME | unk | Vehicle cutaway 3D subject | TVDB |
| 2025-01-28 | The Largest Weapon Ever Built | unknown | HIST/TECH | unk | Mechanical 3D subject | TVDB |
| 2025-02-09 | How to Escape North Korea | unknown | GEO | unk | Route/maps subject | TVDB |
| 2025-02-21 | The Biggest Nuke in History | unknown | HIST | unk | Tsar Bomba; large-scale VFX subject | TVDB |
| 2025-03-03 | The World's Craziest Prison Escape | unknown | CRIME | unk | Physical-action reenactment subject | TVDB |
| 2025-03-12 | The World's Most Dangerous Woman | unknown | GEO | unk | Kim Yo-jong profile | TVDB |
| 2025-03-19 | The Forgotten Attack on the Twin Towers | unknown | HIST | unk | 1993 WTC bombing reconstruction | TVDB |
| 2025-03-26 | The Insane Story of Japan's Chernobyl | unknown | HIST/TECH | unk | Nuclear-accident reconstruction | TVDB |
| 2025-04-01 | The Most Genius Cannabis Scam Ever | unknown | INV | unk | Online investment fraud | TVDB |
| 2025-04-13 | How an Ancient Mummy Changed History | unknown | HIST | unk | Low relevance | TVDB |
| 2025-04-17 | The Hunt for America's Smartest Killer | wkVygetgeRY | CRIME | unk | Unabomber; 12.95M views; manhunt format | VQ, TVDB |
| 2025-04-29 | The Kid Who Ruled 33% of the World | unknown | HIST | unk | Low relevance | TVDB |
| 2025-05-04 | The Hacker Who Destroyed Hollywood | unknown | CYB/NET | unk | Kim Dotcom / Megaupload; internet-era crime | TVDB |
| 2025-05-12 | The Taco Bell Art Heist | unknown | CRIME | unk | Low relevance | TVDB |
| 2025-05-20 | The Biggest Sabotage in History | unknown | GEO | unk | Nord Stream; undersea 3D subject | TVDB |
| 2025-05-25 | How Were the Pyramids Actually Built? | unknown | HIST | unk | Engineering reconstruction | TVDB |
| 2025-06-05 | The Hunt for El Chapo | unknown | CRIME | unk | Manhunt format | TVDB |
| 2025-06-11 | The Hunt for the Holocaust Architect | unknown | HIST | unk | Eichmann manhunt | TVDB |
| 2025-06-17 | How the CIA uses animals to spy | unknown | HIST/intelligence | unk | Low relevance | TVDB |
| 2025-06-22 | The Man Who Saved the World | unknown | HIST | unk | Cold War decision story | TVDB |
| 2025-06-29 | The Most Dangerous ISS Mission | unknown | TECH (space) | unk | Spacecraft 3D subject | TVDB |
| 2025-07-11 | Russia's Most Wanted Hackers (TVDB alt: The Hunt for Russia's Hacker Elite) | unknown | CYB | unk | Fancy Bear / Cozy Bear; state-sponsored APT story | TVDB |
| 2025-07-18 | How Trump Is Secretly Making $2.600.000.000 | unknown | INV (crypto) | unk | Crypto-finance investigation | TVDB |
| 2025-07-22 | The Kid Who Hacked the Pentagon (and paid with his life) | unknown | CYB | unk | Jonathan James; 1990s-era hacking reenactment | TVDB |
| 2025-07-27 | Why Fentanyl Is So Easy to Smuggle | unknown | INV | unk | Logistics/maps subject | TVDB |
| 2025-08-05 | The Most Secret Building in Manhattan | unknown | TECH/intelligence | unk | NSA hub (33 Thomas St); architecture + surveillance | TVDB |
| 2025-08-10 | The Indian Genius Nobody Understands | unknown | HIST | unk | Low relevance | TVDB |
| 2025-08-17 | The Bizarre Kidnapping of Aldi's CEO | unknown | CRIME | unk | Low relevance | TVDB |
| 2025-08-24 | Why You Should Never Go to North Sentinel Island | unknown | OTHER | unk | Low relevance | TVDB |
| 2025-08-31 | How a Minecraft Scammer Stole $16,500,000 | unknown | CYB/NET | unk | 2020 Twitter/X account hijack; social-engineering story | TVDB |
| 2025-09-07 | Putin's Secret Sons | unknown | GEO | unk | Low relevance | TVDB |
| 2025-09-12 | The Hunt for the Charlie Kirk Shooter | unknown | INV (news) | **Reconstruction of the attack** (TVDB description) | Second rapid-turnaround reconstruction (2 days after event) | TVDB, PI |
| 2025-09-21 | The Most Evil Secret Police in History | unknown | HIST | unk | Stasi; surveillance-state story | TVDB |
| 2025-09-29 | How Egypt is Flooding the Desert | unknown | GEO/TECH | unk | Satellite/maps subject | TVDB |
| 2025-10-08 | Camp 14: The Most Horrible Place in North Korea | unknown | GEO | unk | Camp reconstruction subject | TVDB |
| 2025-10-12 | The Mutated Animals of Chernobyl | unknown | OTHER (science) | unk | Low relevance | TVDB, PI |
| 2025-10-18 | The Family That Broke News | unknown | INV (business) | unk | Murdoch; low relevance | TVDB |
| 2025-10-29 | The Dumb Design of Modern Cars | unknown | TECH (design) | unk | Product-design explainer | TVDB |
| 2025-11-04 | How Meth Is Killing Europe | K4E1u3_S1p8 | INV | unk | Drug-trade investigation; 2.9M | RO, TVDB |
| 2025-11-12 | **How an FBI Agent Infiltrated the KKK** | **wLFY_Zu_O08** | INV/CRIME | unk | **Priority #3.** 15.75M views; undercover human story — strongest candidate for character-driven physical reenactment | OE, VQ, RO, TVDB |
| 2025-11-21 | How a Cult Took Over Fiji | zVgj3dFjWhs | INV | unk | Grace Road cult; 3.1M | RO, TVDB, PI |
| 2025-11-27 | The Insane Waterpark That Killed 6 People | tpn8_ZpQ-Ho | OTHER | unk | Physical-accident reconstruction subject; 2.4M | RO, TVDB |
| 2025-12-07 | How Peter Thiel Is Destroying Democracy | TP7Z_Eqxhxk | TECH/politics | unk | Tech-billionaire profile; 2.6M | RO, TVDB |
| 2025-12-14 | We Investigated China's Secret Highway | LAPcW7OAv98 | INV | **On-the-ground crew in Afghanistan** (per fern's origin video, as summarized) | Wakhan Corridor; described as award-winning; prime example of real footage + animation mix; 3.7M | RO, TVDB, gist.ly |
| 2025-12-23 | The Hunt for the Lost Communist Console | 78vWO2SCfEk | TECH/HIST | unk | Retro-hardware subject; 1.2M | RO, TVDB |
| 2026-01-04 | How Cocaine Is Destroying Europe | ydnpyYEhP30 | INV | unk | Drug-trade investigation; 2.1M | RO, TVDB |
| 2026-01-11 | Why Otto Warmbier Didn't Survive North Korea | yXdzKqhEA9M | GEO | unk | 5.7M | RO, TVDB |
| 2026-01-20 | The $1 Billion Coca-Cola Machine | -a29Ygyzc2c | TECH/business | unk | Freestyle machine collecting user data; product-tech + data story; 3.7M | RO, TVDB, PI |
| 2026-01-25 | Disneyland's Most Preventable Tragedy | Q7pgDmR-pWg | OTHER | unk | Ride-accident reconstruction subject; 2.4M | RO, TVDB |
| 2026-02-05 | Why the U.S. President Is Almost Impossible to Kill | -1DvXSsWKLI | OTHER (security) | unk | Security-systems explainer; 3.7M | RO, TVDB |
| 2026-02-15 | The Only Nazi Hitler Feared | VKXQnBlzqzs | HIST | unk | Heydrich assassination reenactment; 4.1M | RO, TVDB |
| 2026-02-26 | The Most Mysterious Drug in the World (TVDB: The Strangest Drug Ever Studied) | hhjhU5MXZOo | OTHER (science) | unk | DMT; abstract/neuro visualization; 2.9M | RO, TVDB |
| 2026-03-02 | How Iran's Leader Was Killed | _SH-lINJoZQ | GEO (news) | unk | Fast-turnaround news reconstruction; 7.1M | RO, TVDB, PI |
| 2026-03-09 | The Strange Attack on Flight 103 (TVDB: The 13-Year Investigation Into Flight 103) | TjBc7kD5ffM | INV/HIST | unk | Lockerbie; forensic-investigation reconstruction; 2.3M | RO, TVDB |
| 2026-03-14 | Why everyone hates Lego now | dSgwNvydXhI | OTHER (business) | unk | Low relevance; 2.8M | RO, TVDB |
| 2026-03-22 | The Craziest Bank Robbery of all Time (TVDB: The Bank Heist of the Century) | PSHQ_MuxxNw | CRIME | unk | Västberga helicopter heist; physical-action reenactment; 3.8M | RO, TVDB |
| 2026-03-29 | The Most Dangerous Job in Crime | H33dcy-2r_U | INV | unk | Cocaine couriers; 2.2M | RO, TVDB |
| 2026-04-05 | The Hunt for the First Dark Web King | j7vnAq3_TVs | CYB | unk | Silk Road / corrupt agents; compare to 2023 dark-web video for style evolution; 1.7M | RO, TVDB |
| 2026-04-12 | Who Will Rule North Korea Next? (TVDB: The World's Deadliest Child) | 9ABD2t4K2wQ | GEO | unk | 1.6M | RO, TVDB |
| 2026-04-19 | The Tragic Story of the Air India Survivor (TVDB: How One Man Survived Air India 171) | uI8oJYmCaz0 | OTHER (aviation) | unk | Crash reconstruction subject; 1.2M | RO, TVDB |
| 2026-04-26 | Facebook's Most Dangerous Product | SOQynHuWPeI | TECH/CYB | unk | Onavo VPN data harvesting; app-UI + data-flow visualization; 21:16; 1.3M | RO, TVDB |
| 2026-05-03 | The World's Deadliest Company | MqCk9APctNk | INV | unk | China Tobacco; 30:02; 1.2M | RO, TVDB |
| 2026-05-10 | The CIA's Most Valuable Spy | unknown | HIST/intelligence | unk | Operation Rubicon (Crypto AG); cryptography-history story | TVDB |
| 2026-05-18 | The Hunt for America's Weirdest Killer | 5ZqolNRkxvM | CRIME | unk | Zodiac; 41:25 (longest known); 2.7M (creatordb) | RO, TVDB, creatordb |
| 2026-05-24 | The Insane Story of Serbia's Human Slaughterhouse | unknown | CRIME/INV | unk | 3.3M (creatordb) | TVDB, creatordb |
| 2026-06-03 | The Dark Web's New Deadliest Drug | unknown | INV (dark web) | unk | Nitazenes via dark web; 2.9M (creatordb) | TVDB, creatordb |
| 2026-06-10 | How to Escape Auschwitz | unknown | HIST | unk | Pilecki; historical reenactment | TVDB |
| 2026-06-19 | How Israel Kills Journalists | unknown | INV | unk | Open-source/forensic investigation | TVDB |
| 2026-06-24 | The World's (Almost) Invincible Leader | unknown | GEO | unk | Putin security; low relevance | TVDB |
| 2026-06-30 | The Kid Who Hacked America | unknown | CYB | unk | Kevin Mitnick; 2.5M (creatordb); recent hacker-biography format | TVDB, creatordb |
| 2026-07-08 | Inside the Dark World of Poker Cheating | unknown | INV | unk | 1.9M (creatordb) | TVDB, creatordb |
| 2026-07-15 | Why Africa Hates McDonald's | unknown | OTHER (business) | unk | Low relevance | TVDB |
| 2026-07-22 | **The Truth About fern** | **TlioXObelHU** | OTHER (meta) | self-referential | fern's own behind-the-scenes on process, team and future; essential watch for method, not style | OE, TVDB, gist.ly |
| 2026-07-29 | Hansa: The Infiltration of the Dark Web | V6d8Yy7Ji68 | CYB | unk | Operation Bayonet (Dutch police); 5.05M; recent dark-web look | RSS, TVDB |
| 2026-08-05 | Exposing a $1,900,000,000 Pharma Company | Eo0JQLIG6hA | INV | unk | 3.7M | RSS, TVDB |
| 2026-08-12 | The Insane Hunt for China's Biggest Scammer (TVDB: How China's Biggest Scammer Got Caught) | a4EcjsnM6ro | INV (crypto) | unk | Crypto fraud manhunt; 3.2M | RSS, TVDB |
| 2026-08-19 | The Unsolved Murder in Room 1046 | zy6ZN1qM3sY | CRIME | unk | Hotel-room reconstruction subject; 6.3M | RSS, TVDB |
| 2026-08-26 | McDonald's Darkest Secret (TVDB: The $1 Billion McDonald's Box) | 65hjeAq6Oq0 | OTHER (business) | unk | 3.0M; low relevance | RSS, TVDB |
| 2026-09-02 | **The Death of Educational Content on YouTube** | **-Gnrp_caPvo** | NET / AI | unk | **Priority #4.** 11.4M views; AI-generated copycat channels — directly on-topic for an AI explainer channel | OE, RSS, TVDB |
| 2026-09-09 | The FBI's Most Valuable Agent (TVDB: The FBI Agent Who Infiltrated the Mafia) | hK8kzWOBi-U | CRIME | unk | Donnie Brasco; undercover reenactment; 7.8M | RSS, TVDB |
| 2026-09-16 | Why El Mencho Was So Hard to Catch (TVDB: How the World's Most Dangerous Drug Lord Was Caught) | d61n1isTfeo | CRIME | unk | 9.1M | RSS, TVDB |
| 2026-09-23 | The Most Disgusting Influencer Campaign of 2026 | WOOwVvYoq5I | NET/INV | unk | Polymarket influencer campaign; 10.8M; internet-culture investigation | RSS, TVDB |
| 2026-10-02 | The Scariest Building in Europe | 4zxG_oUxBg4 | TECH (architecture) | unk | 3.2M; architecture-centric | RSS, TVDB |
| 2026-10-07 | The Strangest Place on the Internet | dU7gCt-7kKk | NET | unk | 4chan history; 4.4M | RSS, TVDB |
| 2026-10-14 | The Most Feared Kids on the Internet | 88itHnh8eMI | CYB | unk | Teen hacking crews; newest cyber upload; 2.2M | RSS, TVDB |
| 2026-10-21 | The Stoner Kids Dealing Guns to the Army | JN_d89-FEKk | CRIME | unk | 2.4M | RSS, TVDB |
| 2026-10-28 | NATO's Plan If Russia Attacks Tomorrow (TVDB: How Would a War With Russia Unfold?) | kp0jkUqVuok | GEO | unk | Hypothetical scenario; maps/strategy visualization; 4.8M | RSS, TVDB |
| 2026-11-06 | How the Internet Exposed a $10,000,000 Scam (TVDB: How the Internet Uncovered a Massive Pokémon Fraud) | oc8G53Tbsvs | NET/INV | unk | Newest upload; online sleuthing; 2.6M in 2 days | RSS, TVDB |

Totals: 147 rows (18 in 2023, 39 in 2024, 47 in 2025, 43 in 2026 to date). No videos with unknown dates were found, so the "unknown dates last" rule did not apply.

### Priority confirmations
| ID | Title (oembed) | Channel (oembed) | Date | Date sources |
|---|---|---|---|---|
| PmtFtWVrxFE | The Kids Who Hacked The CIA | fern (@fern-tv) | 2024-03-17 | vidiq, TVDB |
| LZkl0_9xFOU | The Kids Who Hacked Xbox | fern (@fern-tv) | 2024-09-23 | TVDB (title match) |
| wLFY_Zu_O08 | How an FBI Agent Infiltrated the KKK | fern (@fern-tv) | 2025-11-12 | vidiq, rosetta, TVDB |
| -Gnrp_caPvo | The Death of Educational Content on YouTube | fern (@fern-tv) | 2026-09-02 (17:13 UTC) | RSS, TVDB |

---

## 4. Candidate list for visual inspection (25)

Chosen to span launch-era vs. current style, cybersecurity, technology, physical/character reenactment, investigative, and real-footage + 3D mixes. IDs marked "unknown" must be located on the channel's Videos tab by title.

| # | Date | Title | ID | Why inspect |
|---|---|---|---|---|
| 1 | 2023-07-11 | How a Pilot Hijacked a Plane | unknown | Launch video; establishes the day-one look and how a cockpit/physical event was handled before the team scaled |
| 2 | 2023-08-20 | The Hunt for the King of the Dark Web | gq01C2kjMiM | First cyber hit (16.9M); the origin of the dark-web/hacker visual identity the founders say defined fern |
| 3 | 2024-03-06 | /stol/: The Worst Place on the Internet | unknown | How fern renders forums, leaks and screen-worlds — the hardest problem for internet/AI topics |
| 4 | 2024-03-17 | The Kids Who Hacked The CIA | PmtFtWVrxFE | Priority; the archetypal teen-hacker reenactment, 20.3M views |
| 5 | 2024-07-16 | Mapping the Trump Shooting | aVA7aXOH1pk | Stated animated reconstruction, shipped 3 days after the event; shows the 3D + real footage pipeline at speed |
| 6 | 2024-09-23 | The Kids Who Hacked Xbox | LZkl0_9xFOU | Priority; hardware + corporate-intrusion story, mid-2024 style |
| 7 | 2024-10-06 | How a Hacker Saved the Internet | unknown | Abstract internet-infrastructure threat made visual — directly analogous to AI-safety explainers |
| 8 | 2024-12-08 | ANØM: The Most Genius FBI Operation | unknown | Devices, encrypted apps, global sting — product/UI + map storytelling |
| 9 | 2024-12-22 | How America Destroyed Iran's Nuclear Program | unknown | Stuxnet: malware with physical consequences, the best cyber-physical reenactment analog in the catalog |
| 10 | 2025-01-11 | How Hackers Stole $1,000,000,000 From Banks | WyQ7z8BMwwk (verify) | Bank-intrusion story; ~14 min; check how corporate interiors and money flows are staged |
| 11 | 2025-07-11 | Russia's Most Wanted Hackers | unknown | State APT groups — how faceless hacker collectives are depicted |
| 12 | 2025-07-22 | The Kid Who Hacked the Pentagon (and paid with his life) | unknown | 1990s-era hacking; period hardware and a tragic character arc |
| 13 | 2025-08-05 | The Most Secret Building in Manhattan | unknown | NSA surveillance hub — architecture-driven 3D with a data/surveillance theme |
| 14 | 2025-08-31 | How a Minecraft Scammer Stole $16,500,000 | unknown | Social-engineering / account-takeover story; how phone screens and chat are visualized |
| 15 | 2025-09-12 | The Hunt for the Charlie Kirk Shooter | unknown | Second stated "reconstruction"; compare rapid-news pipeline to #5 one year later |
| 16 | 2025-11-12 | How an FBI Agent Infiltrated the KKK | wLFY_Zu_O08 | Priority; undercover human drama, 15.75M — the clearest test of character-driven physical reenactment |
| 17 | 2025-12-14 | We Investigated China's Secret Highway | LAPcW7OAv98 | Real on-the-ground footage from Afghanistan mixed with animation; described as award-winning |
| 18 | 2026-01-20 | The $1 Billion Coca-Cola Machine | -a29Ygyzc2c | Consumer tech product + data-collection angle; product-level 3D |
| 19 | 2026-04-05 | The Hunt for the First Dark Web King | j7vnAq3_TVs | Silk Road; compare side-by-side with #2 for 2.5 years of style evolution on the same subject class |
| 20 | 2026-04-26 | Facebook's Most Dangerous Product | SOQynHuWPeI | Data privacy / app telemetry; 21:16; how invisible data flows are shown |
| 21 | 2026-05-10 | The CIA's Most Valuable Spy | unknown | Operation Rubicon / Crypto AG — cryptography history, machines + documents |
| 22 | 2026-06-30 | The Kid Who Hacked America | unknown | Kevin Mitnick biography; most recent full hacker-biography format (2.5M) |
| 23 | 2026-07-22 | The Truth About fern | TlioXObelHU | fern's own process/team reveal; watch for pipeline, studio and tool glimpses that no text source provides |
| 24 | 2026-07-29 | Hansa: The Infiltration of the Dark Web | V6d8Yy7Ji68 | Dutch police dark-web takeover; current-year cyber look (5.05M) |
| 25 | 2026-09-02 | The Death of Educational Content on YouTube | -Gnrp_caPvo | Priority; AI slop/copycat channels — the single most on-topic video for an AI explainer channel (11.4M) |
| 26 | 2026-10-14 | The Most Feared Kids on the Internet | 88itHnh8eMI | Newest cyber upload; the current baseline look to benchmark against |

(26 listed; #10 is optional if the mirror-sourced ID does not resolve.)

---

## Source URLs

- Channel RSS (authoritative for last 15): https://www.youtube.com/feeds/videos.xml?channel_id=UCODHrzPMGbNv67e84WDZhQQ
- Channel: https://www.youtube.com/@fern-tv — https://www.youtube.com/channel/UCODHrzPMGbNv67e84WDZhQQ
- Episode index (fan-maintained): https://thetvdb.com/series/fern/allseasons/official
- Stats: https://vidiq.com/youtube-stats/channel/UCODHrzPMGbNv67e84WDZhQQ — https://vidanalyze.com/channel/fern-tv/videos — https://creatordb.app/creatorstats/fern-tv/
- Video index with IDs (Nov 2025–May 2026): https://rosetta.to/u/fern-tv — https://rosetta.to/u/fern-tv/topic/cybersecurity
- Studio: https://www.watchfern.com/ — https://www.watchfern.com/about — https://www.watchfern.com/jobs — https://simpli.de/ueber-uns/
- Background: https://de.wikipedia.org/wiki/Simplicissimus_(YouTube-Kanal) — https://www.pluggedin.com/youtube-reviews/fern/ — https://businessoftv.substack.com/p/youtube-documentary-channels-tv-producers
- Fern's own origin/process video (via summary): https://www.youtube.com/watch?v=TlioXObelHU — https://gist.ly/youtube-summarizer/the-origin-story-of-fern-behind-the-scenes
- Ownership/PE: https://www.electrify.video/news/electrify-expands-into-investigative-journalism-with-partnership-in-leading-documentary-channels — https://tech.eu/2023/09/22/electrify-video-partners-raises-85m-from-capital-d-for-youtube-channel-investment/ — https://www.pulse.bot/creator-economy/news/fern-responds-to-private-equity-backlash-after-gens-viral-youtube-expose-ac7843ec-988d-49d7-a875-50aeae86b823/ (not fetchable at time of writing) — https://earlygame.com/de/news/entertainment/simplicissimus-verkauft-inhaber-reagieren-auf-kritik
- Unverified tool claim (Blender): https://sigmastory.in/fern-proves-high-end-3d-animation-and-documentaries-are-the-future-of-youtube/
- Mirror used for one ID: https://yt.chop.dev/en/v/WyQ7z8BMwwk
