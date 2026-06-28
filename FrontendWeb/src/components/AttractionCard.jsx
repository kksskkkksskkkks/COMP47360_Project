import { Link } from "react-router-dom";
import { resolveImage } from "../lib/image";

// wheelchair: 2 = fully accessible, 1 = limited access, 0 = not accessible
export const WHEELCHAIR = { NO: 0, LIMITED: 1, YES: 2 };

// Same tier colors as the busyness chart / heat map glow, so "quiet" /
// "moderate" / "busy" mean the same color everywhere in the app.
function levelColor(level) {
  if (level <= 2) return "#00685F"; // emerald — quiet (1-2)
  if (level <= 3) return "#D97706"; // gold — moderate (3)
  return "#f26a4b"; // coral — busy (4-5)
}

export function CrowdBars({ level, isOpen }) {
  // Closed locations don't have a meaningful "how busy is it" — show all
  // five bars in the same light, unfilled tint used by the "Quiet" tier,
  // instead of coloring them by level.
  if (isOpen === false) {
    return (
      <div className="flex gap-[2px]">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="w-2 h-4 rounded-full" style={{ background: "#00685F33" }} />
        ))}
      </div>
    );
  }

  if (level == null) {
    return <span className="text-secondary text-[12px]">--</span>;
  }
  const color = levelColor(level);
  return (
    <div className="flex gap-[2px]">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="w-2 h-4 rounded-full"
          style={{ background: i <= level ? color : `${color}33` }}
        />
      ))}
    </div>
  );
}

// Shared card used on the list page and the recommendations timeline.
// `isOpen`/`busynessLevel` aren't on every attraction shape (AttractionDTO vs
// RecommendedAttractionDTO), so they're passed in explicitly rather than read
// off `attraction` directly.
export default function AttractionCard({ attraction, isOpen, busynessLevel }) {
  const a = attraction;
  return (
    <Link
      to={`/gems/${a.id}`}
      className="bg-surface-container-lowest rounded-xl overflow-hidden border border-transparent hover:border-primary/20 cursor-pointer flex flex-col h-full shadow-[0_10px_40px_rgba(0,104,95,0.04)] hover:-translate-y-1 hover:shadow-[0_15px_50px_rgba(0,104,95,0.08)] transition-all duration-300"
    >
      <div className="relative h-[200px] overflow-hidden">
        <img alt={a.name} className="w-full h-full object-cover" src={resolveImage(a.imagePath)} />
        <div className="absolute top-sm right-sm bg-surface-container-lowest/90 backdrop-blur-sm px-xs py-base rounded-full flex items-center gap-base">
          <span className="material-symbols-outlined icon-fill text-[16px] text-[#F59E0B]">star</span>
          <span className="font-stats-numeric text-[14px] text-on-surface font-semibold">
            {a.avgRating != null ? a.avgRating.toFixed(1) : "--"}
          </span>
        </div>
        {a.category && (
          <div className="absolute top-sm left-sm bg-primary/90 backdrop-blur-sm px-xs py-base rounded-full">
            <span className="font-label-caps text-[10px] uppercase text-on-primary tracking-wider">
              {a.category}
            </span>
          </div>
        )}
      </div>

      <div className="p-md flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-xs">
          <h2 className="font-headline-md text-headline-md text-on-surface line-clamp-1">{a.name}</h2>
          {a.wheelchair === WHEELCHAIR.YES && (
            <span className="material-symbols-outlined text-secondary text-[20px]" title="Fully accessible">
              accessible
            </span>
          )}
          {a.wheelchair === WHEELCHAIR.LIMITED && (
            <span className="material-symbols-outlined text-secondary/60 text-[20px]" title="Limited accessibility">
              accessible
            </span>
          )}
        </div>

        <div className="mt-auto space-y-sm">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-label-caps uppercase text-secondary">Crowd Level</span>
            <CrowdBars level={busynessLevel} isOpen={isOpen} />
          </div>
          <div className="flex items-center gap-xs">
            <div className={`w-2 h-2 rounded-full ${isOpen ? "bg-primary" : "bg-secondary"}`} />
            <span
              className={`font-body-md text-[13px] font-medium ${
                isOpen ? "text-primary-container" : "text-secondary"
              }`}
            >
              {isOpen == null ? "Status unknown" : isOpen ? "Open Now" : "Closed"}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
