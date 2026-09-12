# How far a clip rig is from the look rig - rest lengths by bone name, then the baked translations -
# and the rotation-only bake the assemble uses: rotation keeps the look's limb lengths where a
# world-space COPY_TRANSFORMS would stamp the source rig's proportions onto it.
#   blender -b --factory-startup --python-exit-code 1 --python rig_parity.py -- <look.fbx> <clip.fbx> <out.json>
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from fbxlib import import_fbx, write_json  # noqa: E402

LOCATION = re.compile(r'pose\.bones\["([^"]+)"\]\.location')


def rest_lengths(arm):
    return {b.name: b.length for b in arm.data.bones}


def bone_world_z(arm, name):
    b = arm.data.bones.get(name)
    return float((arm.matrix_world @ b.head_local).z) if b else float("nan")


def parity(look, clip):
    a, b = rest_lengths(look), rest_lengths(clip)
    shared = sorted(set(a) & set(b))
    deltas = sorted(((abs(a[n] - b[n]) / max(a[n], 1e-6)), n) for n in shared)
    return {"shared": len(shared), "only_look": len(set(a) - set(b)), "only_clip": len(set(b) - set(a)),
            "median_rel_len_delta": round(deltas[len(deltas) // 2][0], 5) if deltas else 0.0,
            "worst_rel_len_delta": round(deltas[-1][0], 5) if deltas else 0.0, "worst_bone": deltas[-1][1] if deltas else "",
            "pelvis_z_look": round(bone_world_z(look, "pelvis"), 4), "pelvis_z_clip": round(bone_world_z(clip, "pelvis"), 4)}


def baked_translation_delta(clip):
    """What the rest pose cannot see and the bake mode turns on: every animated bone's first-frame
    local translation against the clip rig's OWN rest offset. Pinning the look's mesh makes the two
    rigs share a rest pose, but the baked translations stay the source rig's, so this is the number
    that decides rotation-only over copy-transforms."""
    ad = clip.animation_data
    cb = ad.action.layers[0].strips[0].channelbag(ad.action_slot)
    curves = [(m.group(1), f) for m, f in ((LOCATION.match(f.data_path), f) for f in cb.fcurves) if m]
    if not curves:
        return {"translated_bones": 0, "median_rel_translation_delta": 0.0, "worst_rel_translation_delta": 0.0, "worst_translated_bone": ""}
    bpy.context.scene.frame_set(int(min(kp.co[0] for _, f in curves for kp in f.keyframe_points)))
    deltas = []
    for name in sorted({n for n, _ in curves}):
        pb, bone = clip.pose.bones.get(name), clip.data.bones.get(name)
        if pb is None or bone is None or bone.parent is None:
            continue                                          # a rig-root bone has no offset to compare
        rest = (bone.head_local - bone.parent.head_local).length
        if rest < 1e-4:
            continue                                          # a bone sitting on its parent has no length to be off by
        deltas.append((abs((pb.head - pb.parent.head).length - rest) / rest, name))
    deltas.sort()
    return {"translated_bones": len(deltas),
            "median_rel_translation_delta": round(deltas[len(deltas) // 2][0], 5) if deltas else 0.0,
            "worst_rel_translation_delta": round(deltas[-1][0], 5) if deltas else 0.0,
            "worst_translated_bone": deltas[-1][1] if deltas else ""}


def bake_rotation_only(look, clip_rig, root_bones=("root", "pelvis")):
    """Rotation on every shared bone, translation on root and pelvis only; returns the match count."""
    names = {b.name for b in clip_rig.data.bones}
    matched = 0
    for pb in look.pose.bones:
        if pb.name not in names:
            continue
        rot = pb.constraints.new("COPY_ROTATION")
        rot.target, rot.subtarget = clip_rig, pb.name
        if pb.name in root_bones:
            loc = pb.constraints.new("COPY_LOCATION")
            loc.target, loc.subtarget = clip_rig, pb.name
        matched += 1
    assert matched >= 80, "only %d bones matched" % matched
    return matched


if __name__ == "__main__":
    look_fbx, clip_fbx, out = sys.argv[sys.argv.index("--") + 1:]
    look = next(o for o in import_fbx(look_fbx) if o.type == "ARMATURE")
    before = set(bpy.data.objects)
    import_fbx(clip_fbx, fresh=False, anim_offset=0.0)
    clip = next(o for o in bpy.data.objects if o not in before and o.type == "ARMATURE")
    write_json(out, {**parity(look, clip), **baked_translation_delta(clip)})
    print("S2_PARITY_OK", out)
