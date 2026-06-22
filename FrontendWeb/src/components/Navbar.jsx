import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/", label: "Discover" },
  { to: "/heatmap", label: "Heat Map" },
  { to: "/gems", label: "Gems" },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const { user } = useAuth();

  return (
    <nav className="fixed top-0 w-full z-[2000] bg-white/80 backdrop-blur-md shadow-[0_10px_30px_rgba(0,104,95,0.04)]">
      <div className="flex justify-between items-center max-w-[1440px] mx-auto px-lg h-[80px]">
        <Link to="/" className="text-headline-md font-headline-md font-bold text-primary">
          Gem Finder
        </Link>

        <div className="hidden md:flex space-x-md items-center">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={
                pathname === link.to
                  ? "text-primary border-b-2 border-primary pb-1 font-label-caps text-label-caps uppercase tracking-widest"
                  : "text-secondary hover:text-primary transition-colors font-label-caps text-label-caps uppercase tracking-widest hover:bg-surface-container-low px-sm py-xs rounded-full transition-all duration-300"
              }
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center space-x-sm">
          <button className="p-xs rounded-full text-secondary hover:text-primary hover:bg-surface-container-low transition-all duration-300">
            <span className="material-symbols-outlined">notifications</span>
          </button>

          {user ? (
            <Link
              to="/profile"
              className={
                pathname === "/profile"
                  ? "w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-caps text-label-caps uppercase border-2 border-primary-fixed-dim hover:opacity-90 transition-opacity"
                  : "w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-caps text-label-caps uppercase border-2 border-surface-container-highest hover:opacity-90 transition-opacity"
              }
              title="Profile"
            >
              {user.username?.[0]?.toUpperCase() || "U"}
            </Link>
          ) : (
            <Link
              to="/login"
              className="px-sm py-[8px] rounded-full bg-primary text-on-primary text-label-caps font-label-caps uppercase hover:opacity-90 transition-opacity"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
