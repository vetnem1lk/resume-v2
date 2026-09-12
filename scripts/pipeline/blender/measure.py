# Measurement exports of the shipped look: import the _03 combine, apply the export hygiene the
# real pipeline will apply (IK cull, one UV name, no colour attributes), prune morphs to a tier,
# export EXT-meshopt GLBs; bake the body clips by name-keyed constraint (v1 recipe) and export.
#   blender -b --factory-startup --python-exit-code 1 --python measure.py -- <combine.fbx> <clips_dir> <out_dir> <tiers.json>
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from fbxlib import GEO, MESHOPT, PLAIN, describe, frame_range, import_fbx, load_look, prune, write_json  # noqa: E402

combine, clips_dir, out_dir, tiers_path = sys.argv[sys.argv.index("--") + 1:]
os.makedirs(out_dir, exist_ok=True)
with open(tiers_path, encoding="utf-8") as fh:
    TIERS = json.load(fh)                                   # {"spec15": [...], "keep18": [...], ...}
R = {"combine": combine, "exports": {}, "clips": {}}

for tier, keep in [("spec15", TIERS["spec15"]), ("keep18", TIERS["keep18"]), ("keep24", TIERS["keep24"]), ("all52", None)]:
    objs, arm = load_look(combine)
    kept = prune(objs, set(keep) if keep else None)
    base = os.path.join(out_dir, f"geo_{tier}_base.glb")
    comp = os.path.join(out_dir, f"geo_{tier}.glb")
    bpy.ops.export_scene.gltf(filepath=base, export_animations=False, **GEO, **PLAIN)
    bpy.ops.export_scene.gltf(filepath=comp, export_animations=False, **GEO, **MESHOPT)
    R["exports"][tier] = {"kept": kept, "base": describe(base), "meshopt": describe(comp)}
    assert R["exports"][tier]["meshopt"]["joints"] == R["exports"][tier]["base"]["joints"]
    assert "ik_hand_gun" not in {b.name for b in arm.data.bones if b.use_deform}


def bake_clip(arm, fbx_path, clip_name):
    """Name-keyed COPY_TRANSFORMS bake (v1 b1_clips.py): the clip rig and the look rig share bone names."""
    before = set(bpy.data.objects)
    before_actions = set(bpy.data.actions)
    import_fbx(fbx_path, fresh=False, anim_offset=0.0)
    new = [o for o in bpy.data.objects if o not in before]
    rig = next(o for o in new if o.type == 'ARMATURE')
    fr = frame_range(rig)
    scene = bpy.context.scene
    scene.frame_start, scene.frame_end = fr
    names = {b.name for b in rig.data.bones}
    matched = 0
    for pb in arm.pose.bones:
        if pb.name in names:
            con = pb.constraints.new('COPY_TRANSFORMS')
            con.target, con.subtarget = rig, pb.name
            matched += 1
    assert matched >= 100, f"{clip_name}: only {matched} bones matched"
    if arm.animation_data:
        arm.animation_data.action = None
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.nla.bake(frame_start=scene.frame_start, frame_end=scene.frame_end, step=1, only_selected=False,
                     visual_keying=True, clear_constraints=True, use_current_action=True, bake_types={'POSE'})
    baked = arm.animation_data.action
    assert baked is not None and baked not in before_actions, f"{clip_name}: bake produced no action"
    baked.name = clip_name
    baked.use_fake_user = True

    def sig(frame):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        return [v for pb in arm.pose.bones for v in pb.matrix.translation[:]]
    s, e = scene.frame_start, scene.frame_end
    amp = 0.0 if e == s else max(abs(a - b) for a, b in zip(sig(s), sig((s + e) // 2)))
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    for a in [a for a in bpy.data.actions if a not in before_actions and a is not baked]:
        bpy.data.actions.remove(a)
    return {"frames": [fr[0], fr[1]], "matched": matched, "amplitude": round(amp, 5), "fps": scene.render.fps}


objs, arm = load_look(combine)
prune(objs, set(TIERS["spec15"]))
for clip in ["Idle", "Pose_01", "Pose_02", "Walk_Fwd", "Run_Fwd"]:
    R["clips"][clip] = bake_clip(arm, os.path.join(clips_dir, clip + ".fbx"), clip)
    if clip in ("Idle", "Walk_Fwd", "Run_Fwd"):
        assert R["clips"][clip]["amplitude"] > 1e-4, f"{clip}: static pose after bake"
if arm.animation_data:
    arm.animation_data.action = None
# One export covers every baked action, at whatever frame rate the last import left in the scene: a
# clip authored at another rate would silently re-time all the others. The rates are already recorded.
rates = {c["fps"] for c in R["clips"].values()} | {bpy.context.scene.render.fps}
assert len(rates) == 1, f"clip frame rates disagree with each other or with the scene: {sorted(rates)}"
clips_glb = os.path.join(out_dir, "clips_spec15.glb")
bpy.ops.export_scene.gltf(filepath=clips_glb, export_animations=True, **GEO, **MESHOPT)
R["clips_glb"] = describe(clips_glb)
assert {a["name"] for a in R["clips_glb"]["animations"]} == {"Idle", "Pose_01", "Pose_02", "Walk_Fwd", "Run_Fwd"}, R["clips_glb"]["animations"]
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, "look_spec15_clips.blend"))
write_json(os.path.join(out_dir, "measure.json"), R)
print("S2_MEASURE_OK", out_dir)
