# Texture export, UE side: the used set of the shipped look to PNG at source resolution.
# export_assets picks TextureExporterPNG and writes <out>/Game/IdaFaber/Textures/.../<name>.PNG
# (the exporter spells the extension in upper case; the checks below match it case-insensitively).
import json
import os

import unreal

OUT = os.environ["S2_TEX_OUT"]                        # set by scripts/pipeline/textures.ts
ASSETS = [p for p in os.environ.get("S2_TEX_ASSETS", "").split(";") if p]
assert ASSETS, "S2_TEX_ASSETS is empty"
os.makedirs(OUT, exist_ok=True)
unreal.AssetToolsHelpers.get_asset_tools().export_assets(ASSETS, OUT)
written = {a: os.path.exists(os.path.join(OUT, a.lstrip("/") + ".png")) for a in ASSETS}
unreal.log("S2_RESULT " + json.dumps({"out": OUT, "written": written, "missing": [a for a, ok in written.items() if not ok]}))
