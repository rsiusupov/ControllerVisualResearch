#!/usr/bin/env python3
"""Download controller images from game_controllers.xlsx into year-prefixed folders.

Wiki file pages are fetched as standard 1280px thumbnails. Wikimedia blocks bulk
downloads of full-size originals; files already smaller than 1280px are saved whole.
"""

import hashlib
import ssl
import time
import zipfile
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, unquote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / "data" / "source" / "game_controllers.xlsx"
OUT = ROOT / "images"
LOG = OUT / "_download_log.json"
THUMB_WIDTH = 1280

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
UA = "DiplomaDatasetImageFetcher/1.0 (educational research; mirroring cited controller photos)"
URL_SAFE = ";:@$!*(),/~"
DIRECT_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".tif", ".tiff", ".bmp"}


def col_letter(ref: str) -> str:
    return "".join(ch for ch in ref if ch.isalpha())


def cell_text(cell) -> str:
    inline = cell.find("m:is", NS)
    value = cell.find("m:v", NS)
    if inline is not None:
        return "".join(node.text or "" for node in inline.iter() if node.text)
    if value is not None and value.text:
        return value.text
    return ""


def load_rows():
    with zipfile.ZipFile(XLSX) as archive:
        root = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
    rows = []
    for row in root.findall("m:sheetData/m:row", NS):
        data = {}
        for cell in row.findall("m:c", NS):
            data[col_letter(cell.attrib.get("r", ""))] = cell_text(cell)
        if data.get("A") == "ID" or not data.get("A"):
            continue
        raw = data.get("AD", "").strip()
        urls = [part.strip() for part in raw.split(" ; ") if part.strip()] if raw else []
        year = str(int(float(data["B"]))) if data.get("B") else ""
        folder = data.get("AB", "").strip() or f"{year}_{data.get('D', 'unknown')}"
        rows.append({"year": year, "folder": folder, "name": data.get("D", ""), "urls": urls})
    return rows


def wiki_filename(page_url: str) -> tuple[str, str]:
    """Return (repo, filename). Semicolons are part of some Commons filenames."""
    host = "commons" if "commons.wikimedia.org" in page_url else "en"
    raw = page_url.split("/wiki/", 1)[1].split("?", 1)[0].split("#", 1)[0]
    if raw.startswith("File:"):
        raw = raw[5:]
    return host, unquote(raw)


def encoded_name(filename: str) -> str:
    return quote(filename, safe=URL_SAFE)


def file_urls(filename: str, repo: str) -> tuple[str, str]:
    digest = hashlib.md5(filename.encode("utf-8")).hexdigest()
    enc = encoded_name(filename)
    thumb = (
        f"https://thumb.wikimedia.org/wikipedia/{repo}/thumb/"
        f"{digest[0]}/{digest[:2]}/{enc}/{THUMB_WIDTH}px-{enc}"
    )
    original = f"https://upload.wikimedia.org/wikipedia/{repo}/{digest[0]}/{digest[:2]}/{enc}"
    return thumb, original


def safe_filename(name: str) -> str:
    name = name.replace("/", "_").replace("\x00", "").strip().strip(".")
    if not name:
        name = "image"
    if len(name) > 180:
        name = Path(name).stem[:150] + Path(name).suffix
    return name


def sniff_ext(data: bytes, content_type: str) -> str:
    if data.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return ".gif"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return ".webp"
    kind = content_type.split(";", 1)[0].strip().lower()
    return {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
    }.get(kind, "")


def fetch(url: str) -> tuple[bytes, str, int]:
    last_error = None
    for attempt in range(5):
        try:
            request = Request(url, headers={"User-Agent": UA, "Accept": "image/*,*/*"})
            with urlopen(request, timeout=90) as response:
                data = response.read()
                content_type = response.headers.get("Content-Type", "")
                status = response.status
            if not data or "text/html" in content_type.lower():
                raise RuntimeError(f"not an image ({content_type})")
            return data, content_type, status
        except HTTPError as exc:
            last_error = exc
            if exc.code in {404, 400}:
                raise
            if exc.code in {429, 503}:
                retry_after = exc.headers.get("Retry-After") if exc.headers else None
                wait = int(retry_after) if retry_after and str(retry_after).isdigit() else 10 * (attempt + 1)
                time.sleep(max(wait, 3))
                continue
            time.sleep(1.5 * (attempt + 1))
        except (URLError, TimeoutError, ssl.SSLError, RuntimeError) as exc:
            last_error = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(str(last_error))


def download_wiki(filename: str, repo: str) -> tuple[bytes, str]:
    repos = [repo, "en" if repo == "commons" else "commons"]
    errors = []
    for candidate in repos:
        thumb, original = file_urls(filename, candidate)
        try:
            data, content_type, _ = fetch(thumb)
            return data, content_type
        except HTTPError as exc:
            if exc.code == 400:
                try:
                    data, content_type, _ = fetch(original)
                    return data, content_type
                except Exception as orig_exc:
                    errors.append(f"{candidate} original: {orig_exc}")
                    continue
            if exc.code != 404:
                errors.append(f"{candidate} thumb: {exc}")
                continue
            errors.append(f"{candidate} missing")
        except Exception as exc:
            errors.append(f"{candidate}: {exc}")
    raise RuntimeError("; ".join(errors) or "download failed")


def main() -> None:
    import json

    rows = load_rows()
    jobs = []
    for row in rows:
        for index, page_url in enumerate(row["urls"], start=1):
            job = {**row, "index": index, "page_url": page_url}
            if "/wiki/File:" in page_url or "/wiki/file:" in page_url:
                repo, filename = wiki_filename(page_url)
                job["kind"] = "wiki"
                job["repo"] = repo
                job["filename"] = safe_filename(filename)
                job["source_name"] = filename
            elif Path(page_url.split("?", 1)[0]).suffix.lower() in DIRECT_EXT:
                job["kind"] = "direct"
                job["filename"] = safe_filename(unquote(page_url.split("?", 1)[0].rstrip("/").split("/")[-1]))
            else:
                job["kind"] = "bad"
                job["error"] = "unsupported url"
            jobs.append(job)

    OUT.mkdir(parents=True, exist_ok=True)
    pending = []
    skipped = 0
    failures = []
    used: set[tuple[str, str]] = set()
    for job in jobs:
        if job["kind"] == "bad":
            failures.append({"folder": job["folder"], "page_url": job["page_url"], "error": job["error"]})
            continue
        folder = OUT / job["folder"]
        folder.mkdir(parents=True, exist_ok=True)
        filename = job["filename"]
        key = (job["folder"], filename.lower())
        if key in used:
            stem, suffix = Path(filename).stem, Path(filename).suffix
            filename = f"{stem}_{job['index']}{suffix}"
            key = (job["folder"], filename.lower())
        used.add(key)
        dest = folder / filename
        job["dest"] = dest
        if dest.exists() and dest.stat().st_size > 1000:
            skipped += 1
            continue
        pending.append(job)

    print(f"links={len(jobs)} pending={len(pending)} already={skipped} bad={len(failures)}", flush=True)
    saved = skipped
    new_bytes = 0

    def worker(job):
        if job["kind"] == "wiki":
            data, content_type = download_wiki(job["source_name"], job["repo"])
        else:
            data, content_type, _ = fetch(job["page_url"])
        ext = sniff_ext(data, content_type)
        dest = job["dest"]
        if ext and dest.suffix.lower() != ext:
            dest = dest.with_suffix(ext)
            job["dest"] = dest
        dest.write_bytes(data)
        return len(data)

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(worker, job): job for job in pending}
        for future in as_completed(futures):
            job = futures[future]
            try:
                size = future.result()
                saved += 1
                new_bytes += size
                if saved % 25 == 0 or saved == len(jobs):
                    print(f"saved {saved}/{len(jobs)} ({new_bytes / 1_048_576:.1f} MiB new)", flush=True)
            except Exception as exc:
                failures.append({"folder": job["folder"], "page_url": job["page_url"], "error": str(exc)})
                print(f"FAIL {job['folder']} :: {exc}", flush=True)

    missing = []
    for job in pending:
        dest = job["dest"]
        candidates = list(dest.parent.glob(dest.stem + ".*"))
        if not any(path.is_file() and path.stat().st_size > 1000 for path in candidates):
            missing.append({"folder": job["folder"], "page_url": job["page_url"]})

    report = {
        "image_links": len(jobs),
        "saved_or_already_present": saved,
        "thumb_width": THUMB_WIDTH,
        "failures": failures,
        "missing_files": missing,
    }
    LOG.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    folders = [path for path in OUT.iterdir() if path.is_dir()]
    print(
        f"done saved={saved} links={len(jobs)} folders={len(folders)} "
        f"failures={len(failures)} missing={len(missing)}",
        flush=True,
    )


if __name__ == "__main__":
    main()
