# Body clips, UE side: the pack's own clips on SKEL_UE5_F to FBX, bones only (no mesh, no
# morphs). The preview mesh is pinned so the exporter always resolves one.
import json
import os

import unreal

CLIPS = {"Idle": "AS_UE5_MF_Idle", "Pose_01": "AS_Pose_F_01", "Pose_02": "AS_Pose_F_02", "Walk_Fwd": "AS_UE5_MF_Walk_Fwd", "Run_Fwd": "AS_UE5_MF_Run_Fwd"}
ROOT = "/Game/IdaFaber/Demo/Animations/Girl/"
MESH = "/Game/IdaFaber/Meshes/Girl/SK_MechanicGirl_03"
OUT = os.environ["S2_CLIPS_OUT"]                      # set by scripts/pipeline/clips.ts
os.makedirs(OUT, exist_ok=True)
eal = unreal.EditorAssetLibrary
mesh = eal.load_asset(MESH)
result = {}
for name, asset in CLIPS.items():
    anim = eal.load_asset(ROOT + asset)
    anim.set_preview_skeletal_mesh(mesh)
    opt = unreal.FbxExportOption()
    for prop, val in (("export_morph_targets", False), ("export_preview_mesh", False), ("level_of_detail", False), ("collision", False),
                      ("vertex_color", False), ("map_skeletal_motion_to_root", False), ("export_local_time", True), ("force_front_x_axis", False),
                      ("ascii", False), ("bake_material_inputs", unreal.FbxMaterialBakeMode.DISABLED), ("export_source_mesh", False)):
        opt.set_editor_property(prop, val)                                 # 5.8: bake_material_inputs is an enum, not a bool
    opt.set_editor_property("fbx_export_compatibility", unreal.FbxExportCompatibility.FBX_2020)
    out = f"{OUT}/{name}.fbx"
    task = unreal.AssetExportTask()
    for prop, val in (("object", anim), ("filename", out), ("options", opt), ("automated", True), ("prompt", False),
                      ("replace_identical", True), ("selected", False), ("use_file_archive", False), ("write_empty_files", False)):
        task.set_editor_property(prop, val)
    unreal.Exporter.run_asset_export_task(task)
    result[name] = {"fbx": out, "bytes": os.path.getsize(out) if os.path.exists(out) else 0,
                    "length_s": float(unreal.AnimationLibrary.get_sequence_length(anim)), "frames": int(unreal.AnimationLibrary.get_num_frames(anim))}
unreal.log("S2_RESULT " + json.dumps(result))
