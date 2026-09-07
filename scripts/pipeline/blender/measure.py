# Measurement exports of the shipped look: import the _03 combine, apply the export hygiene the
# real pipeline will apply (IK cull, one UV name, no colour attributes), prune morphs to a tier,
# export EXT-meshopt GLBs; bake the body clips by name-keyed constraint (v1 recipe) and export.
#   blender -b --factory-startup --python-exit-code 1 --python measure.py -- <combine.fbx> <clips_dir> <out_dir> <tiers.json>
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from fbxlib import glb_json, import_fbx, write_json  # noqa: E402

combine, clips_dir, out_dir, tiers_path = sys.argv[sys.argv.index("--") + 1:]
os.makedirs(out_dir, exist_ok=True)
with open(tiers_path, encoding="utf-8") as fh:
    TIERS = json.load(fh)                                   # {"spec15": [...], "keep18": [...], ...}
IK = {"ik_foot_root", "ik_foot_l", "ik_foot_r", "ik_hand_root", "ik_hand_gun", "ik_hand_l", "ik_hand_r"}
R = {"combine": combine, "exports": {}, "clips": {}}

GEO = dict(export_format='GLB', export_apply=False, export_image_format='NONE', export_yup=True, export_texcoords=True,
           export_normals=True, export_tangents=False, export_vertex_color='NONE', export_attributes=False, export_extras=False,
           export_morph=True, export_morph_normal=False, export_morph_tangent=False, export_morph_animation=True,
           export_morph_reset_sk_data=True, export_try_omit_sparse_sk=False,
           export_skins=True, export_influence_nb=4, export_all_influences=False, export_def_bones=True, export_leaf_bone=False,
           export_rest_position_armature=True, export_animation_mode='ACTIONS', export_force_sampling=True, export_frame_step=1,
           export_frame_range=False, export_sampling_interpolation_fallback='LINEAR', export_optimize_animation_size=True,
           export_bake_animation=False, export_draco_mesh_compression_enable=False)
MESHOPT = dict(export_meshopt_compression_enable=True, export_meshopt_extension='EXT_meshopt_compression', export_try_sparse_sk=False)
PLAIN = dict(export_meshopt_compression_enable=False, export_try_sparse_sk=True)


def load_look():
    new = import_fbx(combine)
    arm = next(o for o in new if o.type == 'ARMATURE')
    for a in list(bpy.data.actions):
        bpy.data.actions.remove(a)
    used = {vg.name for o in new if o.type == 'MESH' for vg in o.vertex_groups}
    assert not (IK & used), f"IK bones carry weights: {IK & used}"
    for b in arm.data.bones:
        if b.name in IK:
            b.use_deform = False
    for o in new:
        if o.type != 'MESH':
            continue
        o.data.name = o.name                      # glTF meshes take the datablock name, and weights tracks bind by it
        for uv in o.data.uv_layers:               # one UV name -> TEXCOORD_0 comes from the diffuse set everywhere
            uv.name = "UVMap" if uv == o.data.uv_layers[0] else uv.name
        for c in list(o.data.color_attributes):
            o.data.color_attributes.remove(c)
    return new, arm


def prune(objs, keep):
    kept = {}
    for o in objs:
        if o.type != 'MESH' or not o.data.shape_keys:
            continue
        names = [k.name for k in o.data.shape_keys.key_blocks if k != o.data.shape_keys.reference_key]
        if keep is not None:
            for k in list(o.data.shape_keys.key_blocks):
                if k != o.data.shape_keys.reference_key and k.name not in keep:
                    o.shape_key_remove(k)
            if len(o.data.shape_keys.key_blocks) == 1:
                o.shape_key_clear()
        kept[o.name] = [k.name for k in o.data.shape_keys.key_blocks if k != o.data.shape_keys.reference_key] if o.data.shape_keys else []
        if keep is None:
            kept[o.name] = names
    return kept


def describe(path):
    j = glb_json(path)
    # three.js allocates one morph texture per PRIMITIVE, so the POSITION count of every primitive
    # of every morphed mesh is what the VRAM sum needs - never the Blender vertex count.
    morphed = [{"name": m.get("name"), "targets": len(m["extras"]["targetNames"]),
                "positions": [j["accessors"][p["attributes"]["POSITION"]]["count"] for p in m["primitives"]]}
               for m in j["meshes"] if m.get("extras", {}).get("targetNames")]
    heads = [m for m in j["meshes"] if "jawOpen" in (m.get("extras", {}).get("targetNames") or [])]
    head_pos = sum(j["accessors"][p["attributes"]["POSITION"]]["count"] for p in heads[0]["primitives"]) if heads else None
    return {"bytes": os.path.getsize(path), "meshes": len(j["meshes"]), "materials": len(j.get("materials", [])),
            "joints": len(j["skins"][0]["joints"]) if j.get("skins") else 0, "head_position_count": head_pos,
            "head_prims": len(heads[0]["primitives"]) if heads else 0, "morphed": morphed,
            "head_targets": len(heads[0]["extras"]["targetNames"]) if heads else 0,
            "targets": {m.get("name"): len(m["extras"]["targetNames"]) for m in j["meshes"] if m.get("extras", {}).get("targetNames")},
            "animations": [{"name": a.get("name"), "channels": len(a["channels"])} for a in j.get("animations", [])],
            "extensionsRequired": j.get("extensionsRequired", [])}


for tier, keep in [("spec15", TIERS["spec15"]), ("keep18", TIERS["keep18"]), ("keep24", TIERS["keep24"]), ("all52", None)]:
    objs, arm = load_look()
    kept = prune(objs, set(keep) if keep else None)
    base = os.path.join(out_dir, f"geo_{tier}_base.glb")
    comp = os.path.join(out_dir, f"geo_{tier}.glb")
    bpy.ops.export_scene.gltf(filepath=base, export_animations=False, **GEO, **PLAIN)
    bpy.ops.export_scene.gltf(filepath=comp, export_animations=False, **GEO, **MESHOPT)
    R["exports"][tier] = {"kept": kept, "base": describe(base), "meshopt": describe(comp)}
    assert R["exports"][tier]["meshopt"]["joints"] == R["exports"][tier]["base"]["joints"]
    assert "ik_hand_gun" not in {b.name for b in arm.data.bones if b.use_deform}


def frame_range(obj):
    """Action.curve_frame_range walks the legacy f-curve list and segfaults on a Blender 5 slotted
    action: read the range from the object's own slot channelbag instead."""
    ad = obj.animation_data
    assert ad and ad.action and ad.action_slot, "the imported clip carries no slotted action"
    cb = ad.action.layers[0].strips[0].channelbag(ad.action_slot)
    spans = [f.range() for f in cb.fcurves if f.keyframe_points]
    assert spans, "the imported clip carries no keyframes"
    return int(min(s[0] for s in spans)), int(max(s[1] for s in spans))


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


objs, arm = load_look()
prune(objs, set(TIERS["spec15"]))
for clip in ["Idle", "Pose_01", "Pose_02", "Walk_Fwd", "Run_Fwd"]:
    R["clips"][clip] = bake_clip(arm, os.path.join(clips_dir, clip + ".fbx"), clip)
    if clip in ("Idle", "Walk_Fwd", "Run_Fwd"):
        assert R["clips"][clip]["amplitude"] > 1e-4, f"{clip}: static pose after bake"
if arm.animation_data:
    arm.animation_data.action = None
clips_glb = os.path.join(out_dir, "clips_spec15.glb")
bpy.ops.export_scene.gltf(filepath=clips_glb, export_animations=True, **GEO, **MESHOPT)
R["clips_glb"] = describe(clips_glb)
assert {a["name"] for a in R["clips_glb"]["animations"]} == {"Idle", "Pose_01", "Pose_02", "Walk_Fwd", "Run_Fwd"}, R["clips_glb"]["animations"]
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, "look_spec15_clips.blend"))
write_json(os.path.join(out_dir, "measure.json"), R)
print("S2_MEASURE_OK", out_dir)
