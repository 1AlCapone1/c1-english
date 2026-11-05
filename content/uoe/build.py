import importlib, json, pathlib, sys
here = pathlib.Path(__file__).parent; sys.path.insert(0, str(here))
out = []
for m in ["mc_cloze", "open_cloze", "word_formation", "kwt"]: out += importlib.import_module(m).EXS
(here.parent / "seed" / "exercises_uoe.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
print(len(out))
