export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-outline-variant bg-surface pt-xl pb-lg mt-auto">
      <div className="max-w-[1440px] mx-auto px-lg flex flex-col md:flex-row justify-between items-center gap-md">
        <div className="text-label-caps font-label-caps font-bold text-on-surface">
          © {year} Gem Finder. Curated with precision.
        </div>
        <div className="flex flex-wrap gap-md items-center">
          <a className="font-body-md text-body-md text-secondary hover:text-primary transition-opacity" href="#">
            Privacy Policy
          </a>
          <a className="font-body-md text-body-md text-secondary hover:text-primary transition-opacity" href="#">
            Terms of Service
          </a>
          <a className="font-body-md text-body-md text-secondary hover:text-primary transition-opacity" href="#">
            Contact Support
          </a>
        </div>
      </div>
    </footer>
  );
}
