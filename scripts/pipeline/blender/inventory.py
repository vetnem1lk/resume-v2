# Inventory of the FBX package: one Blender process, one fresh scene per file, one JSON per file.
#   blender -b --factory-startup --python-exit-code 1 --python inventory.py -- <out_dir> <fbx> [<fbx> ...]
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from fbxlib import armature_report, bound_bones, import_fbx, material_images, mesh_stats, shape_key_report, write_json  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:]
assert len(argv) >= 2, "usage: -- <out_dir> <fbx> [<fbx> ...]"
out_dir, paths = argv[0], argv[1:]
os.makedirs(out_dir, exist_ok=True)


def file_key(path):
    """'SK_MechanicGirl_03.fbx' for combines, 'SeparatedMesh/<name>.fbx' for modules."""
    parent = os.path.basename(os.path.dirname(path))
    return f"{parent}/{os.path.basename(path)}" if parent == "SeparatedMesh" else os.path.basename(path)


for path in paths:
    t0 = time.perf_counter()
    new = import_fbx(path)
    dg = bpy.context.evaluated_depsgraph_get()
    arms = [o for o in new if o.type == 'ARMATURE']
    assert len(arms) <= 1, f"{path}: {len(arms)} armatures"
    report = {"file": file_key(path), "import_s": round(time.perf_counter() - t0, 3),
              "armature": armature_report(arms[0]) if arms else None, "meshes": {}}
    for o in sorted((o for o in new if o.type == 'MESH'), key=lambda o: o.name):
        e = mesh_stats(o, dg)
        e["bound_bones"] = bound_bones(o)
        e["shape_keys"] = shape_key_report(o)
        e["images"] = [img for s in o.material_slots for img in material_images(s.material)]
        report["meshes"][o.name] = e
    write_json(os.path.join(out_dir, os.path.splitext(os.path.basename(path))[0] + ".json"), report)

print("S2_INVENTORY_DONE", len(paths))
