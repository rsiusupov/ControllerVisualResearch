#!/usr/bin/env python3
"""Save controller photos named {slug}-{year}-{NN} under public/images/{category}.

Reads the catalog built from data/source/controllers_all.xlsx. Controllers that
already have local files (the games set) are left alone. Each remaining row
keeps at most 10 images:

- a Commons File page becomes that one image
- a Commons search or category page, or a Wikipedia article, contributes up to 10
- a search or category with no image files falls back to the row's Wikipedia source
- "нет изображения" and an empty image cell stay empty
"""

import hashlib
import json
import re
import ssl
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, unquote, urlencode, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "data" / "controllers.json"
OUT = ROOT / "public" / "images"
LOG = ROOT / "data" / "image-fetch-log.json"
THUMB_WIDTH = 1280
MAX_IMAGES = 10
UA = "DiplomaDatasetImageFetcher/1.0 (educational research; mirroring cited controller photos)"
URL_SAFE = ";:@$!*(),/~"
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".tif", ".tiff"}
SKIP_EXT = {".svg", ".pdf", ".djvu", ".ogg", ".ogv", ".webm", ".mp3", ".mid", ".stl", ".html"}

NOISE = (
    "ambox", "question_book", "commons-logo", "wiktionary", "wikibooks", "wikiquote",
    "edit-clear", "oojs_ui", "symbol_support_vote", "folder_hexagonal", "speaker_icon",
    "disambiguation", "crystal_clear", "nuvola", "padlock-", "semi-protection",
    "wiki_letter", "red_pog", "green_pog", "blue_pog", "gnome-", "text-html",
    "symbol_question", "information_icon", "icon_edit",
)


def year_token(year_number):
    if year_number is None:
        return "undated"
    if year_number < 0:
        return f"bce{abs(int(year_number))}"
    return str(int(year_number))


def kind_of(url: str) -> str:
    text = (url or "").strip()
    low = text.lower()
    if not text or low in {"—", "-", "н/д", "n/a", "none", "нет"}:
        return "empty"
    if "нет изображения" in low or low.startswith("нет "):
        return "none"
    if "/wiki/file:" in low:
        return "wiki-file"
    if "/wiki/category:" in low:
        return "wiki-category"
    if "index.php?search=" in low or "special:mediasearch" in low or "special:search" in low:
        return "wiki-search"
    if "wikipedia.org/wiki/" in low or "commons.wikimedia.org/wiki/" in low and "/wiki/file:" not in low and "/wiki/category:" not in low:
        if "wikipedia.org/wiki/" in low:
            return "wiki-article"
    if low.startswith("http"):
        path = urlparse(text.split()[0]).path.lower()
        if any(path.endswith(ext) for ext in IMAGE_EXT):
            return "direct"
        return "page"
    return "text"


def http_url(url: str) -> str:
    return url.strip().split()[0]


def wiki_title(url: str) -> str:
    raw = unquote(http_url(url).split("/wiki/", 1)[1].split("?", 1)[0].split("#", 1)[0])
    return raw.replace(" ", "_")


def search_query(url: str) -> str:
    parsed = urlparse(http_url(url))
    values = parse_qs(parsed.query)
    return (values.get("search") or values.get("searchquery") or [""])[0].strip()


def file_urls(filename: str, repo: str) -> tuple[str, str]:
    filename = filename.replace(" ", "_")
    digest = hashlib.md5(filename.encode("utf-8")).hexdigest()
    enc = quote(filename, safe=URL_SAFE)
    thumb = (
        f"https://thumb.wikimedia.org/wikipedia/{repo}/thumb/"
        f"{digest[0]}/{digest[:2]}/{enc}/{THUMB_WIDTH}px-{enc}"
    )
    original = f"https://upload.wikimedia.org/wikipedia/{repo}/{digest[0]}/{digest[:2]}/{enc}"
    return thumb, original


def sniff_ext(data: bytes, content_type: str) -> str:
    if data.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return ".gif"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return ".webp"
    if data.startswith(b"II*\x00") or data.startswith(b"MM\x00*"):
        return ".tif"
    kind = content_type.split(";", 1)[0].strip().lower()
    return {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "image/tiff": ".tif",
    }.get(kind, "")


def fetch(url: str, accept: str) -> tuple[bytes, str]:
    last_error = None
    for attempt in range(6):
        try:
            request = Request(url, headers={"User-Agent": UA, "Accept": accept})
            with urlopen(request, timeout=60) as response:
                data = response.read()
                content_type = response.headers.get("Content-Type", "")
            return data, content_type
        except HTTPError as exc:
            last_error = exc
            if exc.code in {404, 400, 401, 403}:
                raise
            if exc.code == 429:
                retry_after = exc.headers.get("Retry-After") if exc.headers else None
                wait = int(retry_after) if retry_after and str(retry_after).isdigit() else 8 * (attempt + 1)
                time.sleep(max(wait, 3))
                continue
            time.sleep(1.5 * (attempt + 1))
        except (URLError, TimeoutError, ssl.SSLError, TimeoutError) as exc:
            last_error = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(str(last_error))


def fetch_json(url: str):
    data, content_type = fetch(url, "application/json")
    if "json" not in content_type and not data.startswith(b"{") and not data.startswith(b"["):
        raise RuntimeError(f"not json ({content_type})")
    return json.loads(data.decode("utf-8"))


def api(host: str, params: dict):
    params = {"format": "json", "formatversion": "2", **params}
    url = f"https://{host}/w/api.php?{urlencode(params)}"
    return fetch_json(url)


def noisy(title: str) -> bool:
    low = title.lower()
    if any(bit in low for bit in NOISE):
        return True
    ext = Path(low).suffix
    return ext in SKIP_EXT


def download_named(filename: str, repo: str) -> tuple[bytes, str]:
    repos = [repo, "en" if repo == "commons" else "commons"]
    errors = []
    for candidate in repos:
        thumb, original = file_urls(filename, candidate)
        try:
            data, content_type = fetch(thumb, "image/*,*/*")
            if data and "text/html" not in content_type.lower():
                return data, content_type
        except HTTPError as exc:
            if exc.code in {400, 404}:
                try:
                    data, content_type = fetch(original, "image/*,*/*")
                    if data and "text/html" not in content_type.lower() and sniff_ext(data, content_type):
                        return data, content_type
                except Exception as orig_exc:
                    errors.append(f"{candidate} original: {orig_exc}")
                    continue
            errors.append(f"{candidate} thumb: {exc}")
        except Exception as exc:
            errors.append(f"{candidate}: {exc}")
    raise RuntimeError("; ".join(errors) or "download failed")


def article_images(url: str) -> list[str]:
    page = http_url(url)
    host = urlparse(page).netloc or "en.wikipedia.org"
    title = wiki_title(page)
    endpoint = f"https://{host}/api/rest_v1/page/media-list/{quote(title, safe='')}"
    try:
        payload = fetch_json(endpoint)
    except HTTPError as exc:
        if exc.code != 404:
            raise
        resolved = api(host, {"action": "query", "titles": title, "redirects": "1"})
        pages = resolved.get("query", {}).get("pages", [])
        target = pages[0]["title"].replace(" ", "_") if pages and "missing" not in pages[0] else ""
        if not target or target == title:
            return []
        payload = fetch_json(f"https://{host}/api/rest_v1/page/media-list/{quote(target, safe='')}")
    found = []
    for item in payload.get("items", []):
        if item.get("type") != "image":
            continue
        title = item.get("title") or ""
        if noisy(title) or not item.get("showInGallery"):
            continue
        src = ""
        for candidate in item.get("srcset") or []:
            src = candidate.get("src") or src
        if not src:
            continue
        if src.startswith("//"):
            src = "https:" + src
        found.append(src)
        if len(found) >= MAX_IMAGES:
            break
    return found


def search_files(query: str) -> list[str]:
    if not query:
        return []
    limited = f"filemime:image/jpeg OR filemime:image/png OR filemime:image/gif OR filemime:image/webp {query}"
    payload = api("commons.wikimedia.org", {
        "action": "query",
        "list": "search",
        "srsearch": limited,
        "srnamespace": "6",
        "srlimit": str(MAX_IMAGES),
    })
    titles = []
    for hit in payload.get("query", {}).get("search", []):
        title = hit.get("title") or ""
        if title.startswith("File:") and not noisy(title):
            titles.append(title[5:])
    return titles[:MAX_IMAGES]


def category_files(url: str) -> list[str]:
    title = wiki_title(http_url(url))
    if not title.lower().startswith("category:"):
        title = "Category:" + title
    titles = members(title, "file")
    if len(titles) < MAX_IMAGES:
        for sub in members(title, "subcat")[:4]:
            titles.extend(members(sub, "file"))
            if len(titles) >= MAX_IMAGES:
                break
    names = []
    seen = set()
    for item in titles:
        if not item.startswith("File:"):
            continue
        filename = item[5:]
        key = filename.lower()
        if key in seen or noisy(filename):
            continue
        if Path(filename).suffix.lower() not in IMAGE_EXT:
            continue
        seen.add(key)
        names.append(filename)
        if len(names) >= MAX_IMAGES:
            break
    return names


def members(title: str, cmtype: str) -> list[str]:
    payload = api("commons.wikimedia.org", {
        "action": "query",
        "list": "categorymembers",
        "cmtitle": title,
        "cmtype": cmtype,
        "cmlimit": "20",
    })
    return [item.get("title") or "" for item in payload.get("query", {}).get("categorymembers", [])]


def og_image(url: str) -> list[str]:
    try:
        data, content_type = fetch(http_url(url), "text/html,application/xhtml+xml")
    except Exception:
        return []
    if "html" not in content_type.lower() and b"<html" not in data[:500].lower():
        return []
    text = data.decode("utf-8", "ignore")
    match = re.search(
        r'<meta[^>]+(?:property|name)=["\']og:image(?::url)?["\'][^>]+content=["\']([^"\']+)',
        text,
        re.I,
    )
    if not match:
        match = re.search(
            r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']og:image(?::url)?["\']',
            text,
            re.I,
        )
    if not match:
        return []
    image = match.group(1).strip()
    if image.startswith("//"):
        image = "https:" + image
    return [image] if image.startswith("http") else []


def resolve(record: dict) -> tuple[list[dict], str]:
    """Return download jobs and a short note about where they came from."""
    jobs = []
    note = "none"
    source = next((url for url in record.get("sourceUrls") or [] if kind_of(url) == "wiki-article"), "")

    def add_file(filename: str, repo: str = "commons"):
        if len(jobs) >= MAX_IMAGES or noisy(filename):
            return
        jobs.append({"mode": "file", "filename": filename, "repo": repo})

    def add_url(url: str):
        if len(jobs) >= MAX_IMAGES:
            return
        jobs.append({"mode": "url", "url": url})

    for raw in record.get("imageUrls") or []:
        if len(jobs) >= MAX_IMAGES:
            break
        kind = kind_of(raw)
        if kind in {"empty", "none", "text"}:
            note = kind
            continue
        if kind == "wiki-file":
            host = "commons" if "commons.wikimedia.org" in raw else "en"
            add_file(wiki_title(raw).split(":", 1)[-1], "commons" if host == "commons" else "en")
            note = "wiki-file"
        elif kind == "direct":
            add_url(http_url(raw))
            note = "direct"
        elif kind == "wiki-article":
            for url in article_images(raw):
                add_url(url)
            note = "wiki-article"
        elif kind == "wiki-search":
            for filename in search_files(search_query(raw)):
                add_file(filename)
            note = "wiki-search"
            if not jobs and source:
                for url in article_images(source):
                    add_url(url)
                note = "search-fallback-article"
        elif kind == "wiki-category":
            for filename in category_files(raw):
                add_file(filename)
            note = "wiki-category"
            if not jobs and source:
                for url in article_images(source):
                    add_url(url)
                note = "category-fallback-article"
        elif kind == "page":
            for url in og_image(raw):
                add_url(url)
            note = "og-image"
    if not jobs and note in {"wiki-search", "wiki-category"} and source:
        for url in article_images(source):
            add_url(url)
        note = "fallback-article"
    return jobs[:MAX_IMAGES], note if jobs else (note if note in {"empty", "none"} else "unresolved")


def has_local_images(record: dict) -> bool:
    folder = OUT / record["categorySlug"] / record["slug"]
    if not folder.is_dir():
        return False
    token = year_token(record.get("yearNumber"))
    prefix = f"{record['slug']}-{token}-"
    return any(path.is_file() and path.stat().st_size > 500 and path.name.startswith(prefix) for path in folder.iterdir())


def write_images(record: dict, blobs: list[tuple[bytes, str]]) -> list[str]:
    token = year_token(record.get("yearNumber"))
    folder = OUT / record["categorySlug"] / record["slug"]
    folder.mkdir(parents=True, exist_ok=True)
    saved = []
    index = 1
    for data, content_type in blobs:
        ext = sniff_ext(data, content_type)
        if not ext:
            continue
        dest = folder / f"{record['slug']}-{token}-{index:02d}{ext}"
        dest.write_bytes(data)
        saved.append(str(dest.relative_to(ROOT)))
        index += 1
    return saved


def download_job(job: dict) -> tuple[bytes, str]:
    if job["mode"] == "file":
        return download_named(job["filename"], job["repo"])
    data, content_type = fetch(job["url"], "image/*,*/*")
    if not data or "text/html" in content_type.lower() or not sniff_ext(data, content_type):
        raise RuntimeError(f"not an image ({content_type})")
    return data, content_type


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--category", action="append", default=[])
    args = parser.parse_args()

    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    previous = json.loads(LOG.read_text(encoding="utf-8")) if LOG.exists() else {"done": {}}
    done = previous.get("done", {})
    selected = []
    for record in catalog["controllers"]:
        if args.category and record["categorySlug"] not in args.category:
            continue
        if record["id"] in done or has_local_images(record):
            continue
        selected.append(record)
    if args.limit:
        selected = selected[: args.limit]
    print(f"pending={len(selected)} already={len(done)}", flush=True)

    saved_files = 0
    with_images = 0
    empty = 0
    failures = 0

    def worker(record):
        jobs, note = resolve(record)
        blobs = []
        errors = []
        for job in jobs:
            try:
                blobs.append(download_job(job))
            except Exception as exc:
                errors.append(str(exc)[:240])
        paths = write_images(record, blobs)
        return {
            "id": record["id"],
            "category": record["categorySlug"],
            "note": note,
            "resolved": len(jobs),
            "saved": paths,
            "errors": errors,
        }

    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {pool.submit(worker, record): record for record in selected}
        finished = 0
        for future in as_completed(futures):
            record = futures[future]
            finished += 1
            try:
                result = future.result()
            except Exception as exc:
                failures += 1
                done[record["id"]] = {"note": "error", "saved": [], "errors": [str(exc)[:240]]}
                print(f"FAIL {record['id']} :: {exc}", flush=True)
                continue
            if result["saved"] or not result["errors"]:
                done[result["id"]] = {
                    "note": result["note"],
                    "saved": result["saved"],
                    "errors": result["errors"],
                }
            saved_files += len(result["saved"])
            if result["saved"]:
                with_images += 1
            else:
                empty += 1
            if result["errors"]:
                failures += len(result["errors"])
            if finished % 20 == 0 or finished == len(selected):
                LOG.write_text(json.dumps({"done": done}, ensure_ascii=False), encoding="utf-8")
                print(
                    f"{finished}/{len(selected)} with_images={with_images} files={saved_files} empty={empty}",
                    flush=True,
                )

    LOG.write_text(json.dumps({"done": done}, ensure_ascii=False), encoding="utf-8")
    by_cat = {}
    for record in catalog["controllers"]:
        info = done.get(record["id"])
        if not info:
            continue
        bucket = by_cat.setdefault(record["categorySlug"], {"controllers": 0, "files": 0, "empty": 0})
        bucket["controllers"] += 1
        bucket["files"] += len(info.get("saved") or [])
        if not info.get("saved"):
            bucket["empty"] += 1
    print(json.dumps({"new_files": saved_files, "with_images": with_images, "empty": empty, "by_category": by_cat}, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    main()
