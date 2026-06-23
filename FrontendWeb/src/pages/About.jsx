import { useState } from "react";

const TABS = [
  { id: "mission", label: "Mission" },
  { id: "how", label: "How it Works" },
  { id: "sources", label: "Data Sources" },
  { id: "credits", label: "Acknowledgments" },
];

const HOW_IT_WORKS_CARDS = [
  {
    icon: "location_searching",
    title: "Gem Recommendation",
    body: "The Gem recommendation presented as a list suggesting the place in 30 minutes slot, each slot maximize has 3 attractions, and the recommendation can be regiven by the filters application. The principle of the recommendation is that: currently open, busyness level < 40%, rating > 75th percentile, and no repetition attractions within the same day. Also if there is no suitable gems, the recommendation for that slot will leave empty.",
  },
  {
    icon: "tune",
    title: "Gem Period Selection",
    body: "The gem period selection display the time pattern for each 30 minutes of the attraction for today and tomorrow. From the chart, the close status are displayed in a nominal height. And the present time is spotted.  The different level of busyness is represent in different colour and height. The principle of the gem period selection is that: currently open, busyness level < 40%, rating > 75th percentile. And the gem period is highlighted in a very attractive colour.",

  },
  {
      icon: "map",
      title: "Heat Map Vitalisation",
      body: "The Busyness heat map displays attractions in Manhattan, each category displayed in different colour. And the black colour specifically represent the spot is closed. The three colors radiating from the place represent the level of busyness at that place. The slice bar can be dragged for today and tomorrow time selection, and the map will display the busyness status and opening status at that time.",

  },
];

const DATA_SOURCES = [
  {
    icon: "database",
    title: "Attraction Details",
    body: (
        <>
          Attractions Data Source: OSM POI, Pexels, synthetic data;<br />

          Attraction Basic Information: Using OSM POI data(category, location, place name). And recategorised;<br />
          Attraction Images: Fetching from Pexels, and falls back image when the image is not available;<br />
          Attraction Accessibility: Using OSM POI data;<br />
          Attractions Opening hours: using OSM POI data, backfill with synthetic data;<br />
          Attraction Ratings: Initial use synthetic data and adds the real in-app ratings on;<br />
          Attraction Checkins: No initial data, adds the real in-app interaction;
        </>
    ),
  },
  {
    icon: "cloud",
    title: "Weather & Forecast Feed",
    body: (
        <>
          Real-time, future, and Historical Weather Data: Open-Meteo API;<br/>

          Weather Data Source: Open-Meteo API;

        </>


    ),
  },
  {
    icon: "groups",
    title: "Machine Leaning",
    body: (
        <>
          Forecast of busyness levels (today and the following day): TLC Trip Record Data, Open-Meteo API;<br/>

          Machine Learning Data Source: Yellow Taxi Trip Records (whole 2025 year), Green Taxi Trip Records (whole 2025 year), High Volume For-Hire Vehicle Trip Records (whole 2025 year);
        </>


    ),
  },
];

function TabPanel({ children }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-lg shadow-[0_20px_50px_rgba(0,104,95,0.03)] border border-white">
      {children}
    </div>
  );
}

export default function About() {
  const [tab, setTab] = useState("mission");

  return (
    <main className="flex-grow max-w-[1024px] mx-auto w-full px-lg py-xl flex flex-col gap-lg">
      <header className="text-center">
        <h1 className="font-display-lg text-display-lg text-on-surface mb-xs">About Gem Finder</h1>
        <p className="font-body-lg text-body-lg text-secondary">
          Curating the quiet corners of Manhattan, rated and timed right.
        </p>
      </header>

      <div className="flex justify-center">
        <div className="inline-flex bg-surface-container-low rounded-full p-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={
                tab === t.id
                  ? "px-md py-xs rounded-full font-label-caps text-label-caps bg-white text-primary shadow-sm transition-all"
                  : "px-md py-xs rounded-full font-label-caps text-label-caps text-secondary hover:text-primary transition-all"
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "mission" && (
        <TabPanel>
          <div className="text-center mb-md">
            <h2 className="font-headline-lg text-headline-lg text-on-surface mb-sm">Discover the Undiscovered</h2>
            <div className="w-12 h-1 bg-primary mx-auto rounded-full" />
          </div>
          <div className="flex flex-col gap-md max-w-[640px] mx-auto text-left">
            <p className="font-body-lg text-body-lg text-secondary leading-relaxed">
              Gem Finder addresses a simple problem: how can users find time periods with high ratings
              but low busyness level, to have a better experience at the attractions they visit?
            </p>
            <p className="font-body-lg text-body-lg text-secondary leading-relaxed">
              Gem Finder focuses on high-value places and the right time to visit them. Compare that to
              most products on the market, which only tell you where a place is, or show you passive
              historical data.
            </p>
            <p className="font-body-lg text-body-lg text-secondary leading-relaxed">
              Gem Finder's core value lies in picking the right time period — when a highly rated
              attraction is open and at its least busy — and telling you the suitable time to go.
            </p>
            <p className="font-body-lg text-body-lg text-secondary leading-relaxed">
              Let's use Gem Finder to discover our gems and start exploring together!
            </p>
            <p className="font-body-lg text-body-lg text-secondary leading-relaxed pt-sm border-t border-outline-variant/30">

            </p>
          </div>
        </TabPanel>
      )}

      {tab === "how" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          {HOW_IT_WORKS_CARDS.map((card) => (
            <div
              key={card.title}
              className="bg-surface-container-lowest rounded-xl p-md shadow-[0_20px_50px_rgba(0,104,95,0.03)] border border-white hover:-translate-y-1 hover:border-primary/20 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-md text-primary">
                <span className="material-symbols-outlined text-[24px] icon-fill">{card.icon}</span>
              </div>
              <h3 className="font-headline-md text-headline-md text-on-surface mb-xs">{card.title}</h3>
              <p className="font-body-md text-body-md text-secondary">{card.body}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "sources" && (
        <TabPanel>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-md border-b border-outline-variant/30 pb-md">
            Core Data Integrations
          </h2>
          <ul className="flex flex-col gap-xs">
            {DATA_SOURCES.map((source) => (
              <li
                key={source.title}
                className="flex items-start gap-sm p-sm rounded-lg hover:bg-surface-container-low transition-colors"
              >
                <span className="material-symbols-outlined text-primary mt-1">{source.icon}</span>
                <div>
                  <h4 className="font-stats-numeric text-stats-numeric text-on-surface">{source.title}</h4>
                  <p className="font-body-md text-body-md text-secondary mt-1">{source.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </TabPanel>
      )}

      {tab === "credits" && (
        <TabPanel>
          <div className="text-center mb-md">
            <h2 className="font-headline-lg text-headline-lg text-on-surface mb-sm">The Great Thanks</h2>
            <div className="w-12 h-1 bg-primary mx-auto rounded-full" />
          </div>
          <p className="font-body-lg text-body-lg text-secondary leading-relaxed text-center">
            Gem Finder is a project for UCD Comp47360, and guidance by Alessio Ferrari, Mark Meng, Wanling Cai. Without the patient teaching and encouragement of the professors, this project would not have been possible. Finally, I would like to thank Professor Alessio again for his teaching and guidance this summer. And lastly, I also thank myself for my hard work and dedication.
          </p>
        </TabPanel>
      )}
    </main>
  );
}
