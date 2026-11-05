"""Builds content/seed/vocabulary.json from the pipe-separated source files in content/."""
import json, re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
SRC = root / "content"
KIND = {"w": "word", "pv": "phrasal_verb", "id": "idiom", "co": "collocation", "fx": "fixed_expression", "ln": "linking", "wf": "word_formation", "cf": "confused"}
REG = {"N": "neutral", "F": "formal", "I": "informal", "A": "academic"}
LEGACY_CAT = {"adv": "academic", "acad": "academic", "bus": "business", "edu": "education", "sci": "science", "env": "environment", "pol": "politics", "psy": "health", "health": "health", "arts": "culture", "econ": "business", "media": "media", "law": "law", "rel": "relationships", "travel": "travel", "work": "work", "abstr": "academic", "formal": "formal"}
POS_KIND = {"phrasal verb": "phrasal_verb", "idiom": "idiom", "collocation": "collocation", "fixed expression": "fixed_expression"}
lst = lambda s: [x.strip() for x in s.split(";") if x.strip()]
out, seen = [], set()

def add(rec):
    key = (rec["term"].lower(), rec["kind"])
    if key in seen: return
    seen.add(key); out.append(rec)

# 1) legacy entries (data_full.txt) + supplement (pos, ipa, example_pl)
supp = {}
for line in (SRC / "supp1.txt").read_text().splitlines():
    t, pos, ipa, epl = line.split("|"); supp[t] = (pos, ipa, epl)
legacy = SRC / "legacy_full.txt"
sec = None
for line in legacy.read_text().splitlines():
    if line.startswith("#"): sec = line[1:].strip(); continue
    if "|" not in line: continue
    f = [x.strip() for x in line.split("|")]
    f += [""] * (10 - len(f))
    term, level, pl, definition, ex, syn, ant, col, reg = f[:9]
    note = f[9] if len(f) > 9 else ""
    pos, ipa, epl = supp[term]
    head = sec.split(":")[0]
    if head == "v": kind, cat = "word", LEGACY_CAT[sec.split(":")[1]]
    elif head == "pv": kind, cat = "phrasal_verb", "phrasal"
    elif head == "id": kind, cat = "idiom", "idioms"
    elif head == "co": kind, cat = "collocation", "collocations"
    elif head == "fx": kind, cat = "fixed_expression", "formal"
    elif head == "ln": kind, cat = "linking", "academic"
    else: raise SystemExit(sec)
    if pos == "phrase": pos = "fixed expression"
    add(dict(term=term, kind=kind, category=cat, pos=pos, ipa=ipa, level=level if level in ("B2", "C1", "C2") else "C1", translation_pl=pl, definition=definition or None,
             example=ex, example_pl=epl, collocations=lst(col), synonyms=lst(syn), antonyms=lst(ant), register=REG.get(reg, "neutral"), usage_note=note or None))

# 2) new batches vocab_*.txt
for p in sorted(SRC.glob("vocab_*.txt")):
    for n, line in enumerate(p.read_text().splitlines(), 1):
        if not line.strip() or line.startswith("#"): continue
        f = line.split("|")
        if len(f) != 15: raise SystemExit(f"{p.name}:{n}: {len(f)} fields")
        term, k, cat, pos, ipa, level, pl, d, ex, epl, col, syn, ant, reg, note = [x.strip() for x in f]
        add(dict(term=term, kind=KIND[k], category=cat, pos=pos, ipa=ipa, level=level, translation_pl=pl, definition=d or None, example=ex, example_pl=epl,
                 collocations=lst(col), synonyms=lst(syn), antonyms=lst(ant), register=reg if reg in REG.values() else "neutral", usage_note=note or None))

(SRC / "seed").mkdir(exist_ok=True)
(SRC / "seed" / "vocabulary.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
from collections import Counter
print(len(out), Counter(r["kind"] for r in out))
