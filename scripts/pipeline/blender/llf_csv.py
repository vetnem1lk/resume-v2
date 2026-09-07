# Live Link Face CSV -> shape-key f-curves, no add-on. Header: Timecode, BlendShapeCount, then
# 52 ARKit names (lowerCamelCase) + 9 head/eye rotation channels (never shape keys, skipped).
#   blender -b --factory-startup --python-exit-code 1 --python llf_csv.py -- <fbx> <take.csv|selftest> <fps>
import csv
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from fbxlib import import_fbx, key_fcurves  # noqa: E402

ARKIT = ["eyeBlinkRight", "eyeLookDownRight", "eyeLookInRight", "eyeLookOutRight", "eyeLookUpRight", "eyeSquintRight", "eyeWideRight",
         "eyeBlinkLeft", "eyeLookDownLeft", "eyeLookInLeft", "eyeLookOutLeft", "eyeLookUpLeft", "eyeSquintLeft", "eyeWideLeft",
         "jawForward", "jawRight", "jawLeft", "jawOpen", "mouthClose", "mouthFunnel", "mouthPucker", "mouthRight", "mouthLeft",
         "mouthSmileRight", "mouthSmileLeft", "mouthFrownRight", "mouthFrownLeft", "mouthDimpleRight", "mouthDimpleLeft",
         "mouthStretchRight", "mouthStretchLeft", "mouthRollLower", "mouthRollUpper", "mouthShrugLower", "mouthShrugUpper",
         "mouthPressRight", "mouthPressLeft", "mouthLowerDownRight", "mouthLowerDownLeft", "mouthUpperUpRight", "mouthUpperUpLeft",
         "browDownRight", "browDownLeft", "browInnerUp", "browOuterUpRight", "browOuterUpLeft",
         "cheekPuff", "cheekSquintRight", "cheekSquintLeft", "noseSneerRight", "noseSneerLeft", "tongueOut"]
ROT = ["HeadYaw", "HeadPitch", "HeadRoll", "LeftEyeYaw", "LeftEyePitch", "LeftEyeRoll", "RightEyeYaw", "RightEyePitch", "RightEyeRoll"]


def load_llf_csv(ob, path, fps, frame_start=1):
    key = ob.data.shape_keys
    blocks = key.key_blocks
    with open(path, newline="") as fh:
        rows = [r for r in csv.reader(fh) if r]
    hdr, rows = rows[0], rows[1:]
    assert hdr[0] == "Timecode" and hdr[1] == "BlendShapeCount", hdr[:2]
    lower = {k.name.lower(): k.name for k in blocks}
    cols = {i: lower.get(n.strip().lower()) for i, n in enumerate(hdr[2:], start=2)}
    matched = [n for n in cols.values() if n]
    assert len(matched) >= 50, f"only {len(matched)} columns matched shape keys"
    key.animation_data_clear()
    saved = {k.name: k.value for k in blocks}
    for frame, row in enumerate(rows, start=frame_start):
        for i, sk in cols.items():
            if sk:
                blocks[sk].value = float(row[i])
                key.keyframe_insert(data_path=f'key_blocks["{sk}"].value', frame=frame)
    for k in blocks:
        k.value = saved[k.name]
    ad = key.animation_data
    cb = ad.action.layers[0].strips[0].channelbag(ad.action_slot)
    for fc in cb.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
    scene = bpy.context.scene
    scene.render.fps = fps
    scene.frame_start, scene.frame_end = frame_start, frame_start + len(rows) - 1
    return matched, len(rows)


fbx, csv_path, fps = sys.argv[sys.argv.index("--") + 1:]
fps = int(fps)
new = import_fbx(fbx)
ob = next(o for o in new if o.type == 'MESH' and o.data.shape_keys and any(k.name == "jawOpen" for k in o.data.shape_keys.key_blocks))

if csv_path == "selftest":                                   # synthetic 63-column take, 90 frames, jawOpen hump
    csv_path = os.path.join(os.path.dirname(fbx), "llf_selftest.csv")
    with open(csv_path, "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["Timecode", "BlendShapeCount", *ARKIT, *ROT])
        for f in range(90):
            vals = [0.0] * 61
            vals[ARKIT.index("jawOpen")] = round(min(f, 89 - f) / 44.5, 4)
            w.writerow([f"10:00:{f // 30:02d}:{f % 30:02d}.000", 61, *vals])

matched, frames = load_llf_csv(ob, csv_path, fps)
fcs = key_fcurves(ob)
jaw = fcs['key_blocks["jawOpen"].value']
assert len(jaw) == frames and jaw[:, 1].max() > 0.9, (len(jaw), jaw[:, 1].max())
print("S2_LLF_OK", len(matched), "curves", frames, "frames")
