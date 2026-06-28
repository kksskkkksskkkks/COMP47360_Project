import { useState } from "react";

// Privacy Policy / Terms of Service / Contact Support don't have real pages
// behind them yet — they used to be <a href="#"> links, which still "jumps"
// the page (scrolls to top) on click even though there's nowhere to go.
// These are plain buttons instead, so clicking gives a quick press-pulse
// for feedback without any navigation or scroll happening.
function FooterLink({ children }) {
  const [pulseCount, setPulseCount] = useState(0);

  return (
    <button
      type="button"
      onClick={() => setPulseCount((c) => c + 1)}
      className="font-body-md text-body-md text-secondary hover:text-primary transition-colors"
    >
      <span key={pulseCount} className={pulseCount > 0 ? "animate-click-pulse" : "inline-block"}>
        {children}
      </span>
    </button>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-outline-variant bg-surface pt-xl pb-lg mt-auto">
      <div className="max-w-[1440px] mx-auto px-lg flex flex-col md:flex-row justify-between items-center gap-md">
        <div className="text-label-caps font-label-caps font-bold text-on-surface">
          © {year} Gem Finder. Curated with precision.
        </div>
        <div className="flex flex-wrap gap-md items-center">
          <FooterLink>Privacy Policy</FooterLink>
          <FooterLink>Terms of Service</FooterLink>
          <FooterLink>Contact Support</FooterLink>
        </div>
      </div>
    </footer>
  );
}
