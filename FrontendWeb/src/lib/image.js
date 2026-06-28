// AttractionDTO.imagePath is a relative path, e.g. "images/park/dante-park.jpg",
// and needs to be prefixed with the backend's static asset root (not the /api
// prefix, the site root). For example if the backend runs at http://localhost:8080,
// the actual image URL is http://localhost:8080/images/park/dante-park.jpg
const apiBaseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";
const assetBaseURL =
  import.meta.env.VITE_ASSET_BASE_URL || apiBaseURL.replace(/\/api\/?$/, "");
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&q=80";

export function resolveImage(imagePath) {
  if (!imagePath) return FALLBACK_IMAGE;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  const normalizedBase = assetBaseURL.replace(/\/$/, "");
  const normalizedPath = imagePath.replace(/^\//, "");
  return `${normalizedBase}/${normalizedPath}`;
}
