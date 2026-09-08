# Face proof, UE side: a synthetic ARKit animation on the idle clip, exported to FBX with the
# blend-shape (DeformPercent) curves that Blender turns into shape-key f-curves.
import json
import os

import unreal

SKEL = "/Game/IdaFaber/Meshes/Girl/SKEL_UE5_F"
SRC = "/Game/IdaFaber/Demo/Animations/Girl/AS_UE5_MF_Idle"
DST = "/Game/IdaFaber/Demo/Animations/Girl/AS_ARKit_FaceProof"
HEAD = "/Game/IdaFaber/Meshes/Girl/Separated/SK_MECHANICGIRL_HEAD"
WANTED = ["jawOpen", "eyeBlinkLeft", "eyeBlinkRight", "mouthSmileLeft"]
OUT = os.environ["S2_FACE_FBX"]                       # set by scripts/pipeline/face-proof.ts

eal = unreal.EditorAssetLibrary
lib = unreal.AnimationLibrary
head = eal.load_asset(HEAD)
skel = eal.load_asset(SKEL)
assert head.get_editor_property("skeleton") == skel, "head is not bound to SKEL_UE5_F"

morphs = [str(n) for n in head.get_all_morph_target_names()]
by_lower = {m.lower(): m for m in morphs}
curves = [by_lower[w.lower()] for w in WANTED if w.lower() in by_lower]
assert len(curves) == 4, f"proof morphs missing on the head: {WANTED} vs {morphs[:8]}..."

if eal.does_asset_exist(DST):
    assert eal.delete_asset(DST), "could not delete the previous proof clip"
anim = eal.duplicate_asset(SRC, DST)
assert anim is not None, "duplicate_asset returned None"
length = float(lib.get_sequence_length(anim))           # 4.333 s, 130 frames at 30 fps
assert length > 2.5, length

for name in curves:
    lib.add_curve(anim, name, unreal.RawCurveTrackTypes.RCT_FLOAT, False)
for i, name in enumerate(curves):                        # staggered 0 -> 1 -> 0 humps inside the clip
    t0 = 0.25 * i
    lib.add_float_curve_keys(anim, name, [0.0, t0 + 0.3, t0 + 1.0, t0 + 1.7, length], [0.0, 0.0, 1.0, 0.0, 0.0])

for name in curves:                                      # REQUIRED in 5.8: both FBX morph paths read this
    lib.add_curve_meta_data(skel, name, True)
    lib.set_curve_meta_data_morph_target(skel, name, True)
anim.set_preview_skeletal_mesh(head)                     # else FindCompatibleMesh() picks an arbitrary module
eal.save_asset(DST)
eal.save_asset(SKEL)

opt = unreal.FbxExportOption()
opt.set_editor_property("export_morph_targets", True)
opt.set_editor_property("export_preview_mesh", True)     # default False: without it no blend-shape curves
opt.set_editor_property("level_of_detail", False)
opt.set_editor_property("collision", False)
opt.set_editor_property("vertex_color", False)
opt.set_editor_property("map_skeletal_motion_to_root", False)
opt.set_editor_property("export_local_time", True)
opt.set_editor_property("force_front_x_axis", False)
opt.set_editor_property("ascii", False)
opt.set_editor_property("fbx_export_compatibility", unreal.FbxExportCompatibility.FBX_2020)
opt.set_editor_property("bake_material_inputs", unreal.FbxMaterialBakeMode.DISABLED)  # 5.8: an enum, not a bool
opt.set_editor_property("export_source_mesh", False)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
task = unreal.AssetExportTask()
task.set_editor_property("object", anim)
task.set_editor_property("filename", OUT)
task.set_editor_property("options", opt)
task.set_editor_property("automated", True)              # without it the options object is ignored
task.set_editor_property("prompt", False)
task.set_editor_property("replace_identical", True)
task.set_editor_property("selected", False)
task.set_editor_property("use_file_archive", False)
task.set_editor_property("write_empty_files", False)
unreal.Exporter.run_asset_export_task(task)              # return value is not a success signal

unreal.log("S2_RESULT " + json.dumps({
    "fbx": OUT, "exists": os.path.exists(OUT), "bytes": os.path.getsize(OUT) if os.path.exists(OUT) else 0,
    "curves": curves, "length_s": length,
    "meta": [str(n) for n in lib.get_curve_meta_data_names(skel)],
}))
