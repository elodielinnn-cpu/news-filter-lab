import csv
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from html import unescape
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen
from xml.etree import ElementTree
from zoneinfo import ZoneInfo

rules = json.loads(Path("rules.json").read_text(encoding="utf-8"))
output = Path("results")
output.mkdir(exist_ok=True)

def matches(pattern, text):
    return re.search(r"(?<![A-Za-z])(?:" + pattern + ")", text, re.I)

def clean(text):
    return " ".join(re.sub("<[^>]+>", " ", unescape(text)).split())

def fetch(source):
    name, address = source
    try:
        request = Request(address, headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(request, timeout=15) as response:
            root = ElementTree.fromstring(response.read(5_000_000))
        entries = root.findall(".//item") or root.findall(".//{*}entry")
        rows = []
        for entry in entries[:35]:
            link = entry.find("{*}link")
            if link is None:
                continue
            parts = urlsplit(link.get("href") or link.text or "")
            if parts.scheme not in ("http", "https") or not parts.hostname:
                continue
            url = urlunsplit((parts.scheme, parts.netloc, parts.path.rstrip("/"), "", ""))
            title = clean(entry.findtext("{*}title", ""))
            description = clean(entry.findtext("{*}description") or entry.findtext("{*}summary", ""))
            date = entry.findtext("{*}pubDate") or entry.findtext("{*}published") or entry.findtext("{*}updated", "")
            if title:
                rows.append((name, date, title, url, description))
        return name, rows, "" if rows else "未读到文章"
    except (OSError, ValueError, ElementTree.ParseError) as error:
        return name, [], str(error)

def classify(source, title, description):
    if re.search(rules["exclude_title"], title, re.I):
        return "排除", "", "标题命中排除规则", title
    for sentence in [title, *re.split(r"(?<=[.!?。！？])\s*|[\r\n]+", description)]:
        for category, (context, product) in rules["business"].items():
            if matches(context, sentence) and matches(product, sentence) and matches(rules["event"], sentence):
                return "入选", category, "应用场景、硬件与变化同句匹配", sentence
            if not (matches(rules["commercial"], sentence) and matches(rules["change"], sentence)):
                continue
            if matches(rules["competitor"], sentence) and matches(context, sentence) and matches(product, sentence):
                return "入选", category, "竞对重叠业务发生经营变化", sentence
            if matches(rules["customer"], source + " " + sentence) and matches(context, sentence):
                return "入选", category, "客户相关终端或业务发生经营变化", sentence
    return "排除", "", "公开摘要没有匹配到具体业务变化", ""

def enrich(item):
    source, date, title, url, description = item
    decision = classify(source, title, description)
    if decision[0] == "入选" or decision[2] == "标题命中排除规则":
        return item, decision
    if not any(matches(context, title + " " + description)
               for context, _ in rules["business"].values()):
        return item, decision
    try:
        request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(request, timeout=7) as response:
            page = response.read(1_500_000).decode("utf-8", errors="replace")
        article = re.search(r"<article\b[^>]*>(.*?)</article>", page, re.I | re.S)
        if not article:
            return item, decision
        paragraphs = re.findall(r"<p\b[^>]*>(.*?)</p>", article[1], re.I | re.S)
        body = "\n".join(clean(paragraph) for paragraph in paragraphs[:60])
        return item, classify(source, title, description + "\n" + body)
    except (OSError, ValueError):
        return item, ("跳过", "", "正文读取失败", "")

def safe(value):
    return "'" + value if value.startswith(("=", "+", "-", "@", "\t", "\r")) else value

with ThreadPoolExecutor(max_workers=5) as pool:
    feeds = list(pool.map(fetch, rules["sources"].items()))
for source, items, error in feeds:
    print(f"{source}: {len(items)} {error}", file=sys.stderr)
if not any(items for _, items, _ in feeds):
    raise SystemExit("所有来源均无文章")

seen_path = output / "seen.json"
seen = set(json.loads(seen_path.read_text())) if seen_path.exists() else set()
new_items = []
for _, items, _ in feeds:
    for item in items:
        if item[3] not in seen:
            seen.add(item[3])
            new_items.append(item)
rows = []
with ThreadPoolExecutor(max_workers=8) as pool:
    for item, decision in pool.map(enrich, new_items):
        source, date, title, url, _ = item
        result, category, reason, evidence = decision
        if result == "跳过":
            seen.discard(url)
        rows.append((result, category, title, source, date, reason, evidence, url))
with (output / "latest.csv").open("w", encoding="utf-8-sig", newline="") as file:
    writer = csv.writer(file)
    writer.writerow(["结果", "业务", "标题", "来源", "发布时间", "原因", "原句", "链接"])
    writer.writerows([safe(field) for field in row] for row in sorted(rows, key=lambda row: row[0] != "入选"))
seen_path.write_text(json.dumps(sorted(seen), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
now = datetime.now(ZoneInfo("Asia/Shanghai"))
status = f"{now:%Y-%m-%d %H:%M:%S} 北京时间｜新增 {len(rows)}｜入选 {sum(row[0] == '入选' for row in rows)}"
(output / "status.txt").write_text(status + "\n", encoding="utf-8")
print(status)
