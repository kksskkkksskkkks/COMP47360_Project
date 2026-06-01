"""
NYC TLC 2025 Full-Year Bulk Data Download Script
Downloads Yellow, Green, and High Volume FHV taxi trip data
"""

import urllib.request
import os
import time
from pathlib import Path

# ── Configuration ─────────────────────────────────────
BASE_URL = "https://d37ci6vzurychx.cloudfront.net/trip-data"
OUTPUT_DIR = Path("./tlc_2025")   # Download to tlc_2025 folder in current directory
YEAR = 2025
MONTHS = range(1, 13)             # Months 1 through 12

DATASETS = {
    "yellow": "yellow_tripdata",
    "green":  "green_tripdata",
    "hvfhv":  "fhvhv_tripdata",   # High Volume FHV (Uber/Lyft)
}

# Store each type in its own subdirectory
# ── Utility Functions ─────────────────────────────────

def format_size(bytes_: int) -> str:
    for unit in ["B", "KB", "MB", "GB"]:
        if bytes_ < 1024:
            return f"{bytes_:.1f} {unit}"
        bytes_ /= 1024
    return f"{bytes_:.1f} TB"


def download_file(url: str, dest: Path) -> bool:
    """Download a single file. Returns True on success. Skips if file already exists."""
    if dest.exists():
        print(f"  ⏭  Already exists, skipping: {dest.name}")
        return True

    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(".tmp")

    try:
        print(f"  ⬇  Downloading: {dest.name}", end="", flush=True)
        start = time.time()

        def reporthook(block, block_size, total):
            downloaded = block * block_size
            if total > 0:
                pct = min(downloaded / total * 100, 100)
                print(f"\r  ⬇  Downloading: {dest.name}  {pct:.0f}%  ({format_size(downloaded)}/{format_size(total)})", end="", flush=True)

        urllib.request.urlretrieve(url, tmp, reporthook)
        tmp.rename(dest)
        elapsed = time.time() - start
        print(f"\r  ✅ Done: {dest.name}  ({format_size(dest.stat().st_size)}, {elapsed:.1f}s)")
        return True

    except Exception as e:
        print(f"\r  ❌ Failed: {dest.name}  Error: {e}")
        if tmp.exists():
            tmp.unlink()
        return False


# ── Main Flow ─────────────────────────────────────────

def main():
    print(f"NYC TLC {YEAR} Bulk Data Download")
    print(f"Output directory: {OUTPUT_DIR.resolve()}\n")

    results = {"success": [], "failed": [], "skipped": []}

    for dtype, prefix in DATASETS.items():
        print(f"\n{'='*50}")
        print(f"📁 {dtype.upper()} ({prefix})")
        print(f"{'='*50}")

        for month in MONTHS:
            filename = f"{prefix}_{YEAR}-{month:02d}.parquet"
            url = f"{BASE_URL}/{filename}"
            dest = OUTPUT_DIR / dtype / filename

            already_exists = dest.exists()
            success = download_file(url, dest)

            if already_exists:
                results["skipped"].append(filename)
            elif success:
                results["success"].append(filename)
            else:
                results["failed"].append(filename)

    # ── Summary ───────────────────────────────────────
    print(f"\n{'='*50}")
    print("📊 Download Summary")
    print(f"{'='*50}")
    print(f"  ✅ Succeeded: {len(results['success'])} file(s)")
    print(f"  ⏭  Skipped:   {len(results['skipped'])} file(s) (already exist)")
    print(f"  ❌ Failed:    {len(results['failed'])} file(s)")

    if results["failed"]:
        print("\nFailed files:")
        for f in results["failed"]:
            print(f"  - {f}")

    # Calculate total local disk usage
    total_size = sum(
        f.stat().st_size
        for f in OUTPUT_DIR.rglob("*.parquet")
        if f.exists()
    )
    print(f"\n💾 Total local disk usage: {format_size(total_size)}")
    print("\nDone!")


if __name__ == "__main__":
    main()