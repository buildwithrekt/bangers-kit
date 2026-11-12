"""Fetch REAL data for the slides from public JSON endpoints listed in the config.

Run from the project root:
    python3 <skill>/scripts/fetch_data.py [--config redesign.config.json]

Config ("data" section):
    "data": {
      "sources": [
        {
          "key": "top",                         # name of the list in the output
          "url": "https://example.com/api/items?sort=volume",
          "path": "items",                      # dot path to the array in the response ("" = the response is the array)
          "fields": ["id", "name", "symbol", "marketCap"],   # fields to keep; dot paths allowed, "quote.symbol" is saved as "quote_symbol"
          "limit": 20,
          "idField": "id",                      # used to name downloaded images
          "imageField": "image"                 # optional: download each item's image to assets/items/
        }
      ],
      "exclude": ["offensive name", "..."]      # case-insensitive substrings; matching items are dropped
    }

Writes system/real-data.json with a "_source" line (hosts + UTC timestamp). Standard library only.
Only use public endpoints the site itself calls in the browser. No auth bypass, no scraping behind a login.
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36"}
POLITE_SECONDS = 1.0


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read()


def dig(obj, path):
    """Follow a dot path through dicts and lists; returns None when missing."""
    if not path:
        return obj
    for part in path.split("."):
        if isinstance(obj, dict):
            obj = obj.get(part)
        elif isinstance(obj, list) and part.isdigit() and int(part) < len(obj):
            obj = obj[int(part)]
        else:
            return None
    return obj


def main():
    args = sys.argv[1:]
    cfg_path = args[args.index("--config") + 1] if "--config" in args else "redesign.config.json"
    if not os.path.exists(cfg_path):
        sys.exit("config not found: " + cfg_path)
    with open(cfg_path) as f:
        cfg = json.load(f)
    data_cfg = cfg.get("data") or {}
    sources = data_cfg.get("sources") or []
    if not sources:
        sys.exit('no "data.sources" in config: nothing to fetch')
    exclude = [s.lower() for s in data_cfg.get("exclude") or []]

    os.makedirs("system", exist_ok=True)
    os.makedirs("assets/items", exist_ok=True)
    hosts = sorted({urllib.parse.urlparse(s["url"]).netloc or "local file" for s in sources})
    out = {"_source": ", ".join(hosts) + ", fetched " + time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime())}
    images = {}

    for src in sources:
        key = src["key"]
        try:
            rows = dig(json.loads(get(src["url"])), src.get("path", ""))
        except Exception as e:  # report and continue: a missing list must be visible, never silently faked
            print("FAIL", key, src["url"], e)
            out[key] = []
            continue
        if not isinstance(rows, list):
            print("FAIL", key, "path did not resolve to a list")
            out[key] = []
            continue
        kept = []
        for row in rows:
            item = {f.replace(".", "_"): dig(row, f) for f in src.get("fields") or list(row.keys())}
            label = " ".join(str(v) for v in item.values() if isinstance(v, str)).lower()
            if any(x in label for x in exclude):
                continue
            img_url = dig(row, src["imageField"]) if src.get("imageField") else None
            if img_url and str(img_url).startswith("http"):
                ident = re.sub(r"[^A-Za-z0-9_-]", "", str(dig(row, src.get("idField", "id")) or len(images)))[:16]
                fn = "assets/items/" + ident + ".img"  # browsers sniff the type, the extension does not matter
                if img_url not in images:
                    try:
                        with open(fn, "wb") as fh:
                            fh.write(get(img_url))
                        images[img_url] = fn
                        time.sleep(0.2)
                    except Exception as e:
                        images[img_url] = None
                        print("img fail", ident, e)
                item["img"] = images[img_url]
            kept.append(item)
            if len(kept) >= int(src.get("limit", 20)):
                break
        out[key] = kept
        print("==", key, len(kept), "items")
        for item in kept[:8]:
            print("  ", json.dumps(item, ensure_ascii=False)[:160])
        time.sleep(POLITE_SECONDS)

    with open("system/real-data.json", "w") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    print("wrote system/real-data.json |", out["_source"])


if __name__ == "__main__":
    main()
