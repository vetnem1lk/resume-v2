# Body clips, UE side: AnimSequences to FBX, bones only (no mesh, no morphs). Each clip names its
# asset and the preview mesh to pin; a clip authored on another skeleton marks the mesh's skeleton
# compatible first, or the editor silently drops the preview mesh and exports nothing.
import json
import os

import unreal

JOB = json.loads(os.environ["S2_CLIPS_JOB"])        # {"out", "clips": {id: {"asset", "mesh"}}, "allow_skeleton_write"?}
OUT = JOB["out"]
# The compatible mark is the only write this job makes into the project, so it is allowed on one
# asset only: the skeleton the caller names here, which it has backed up before starting the editor.
ALLOW_SKELETON_WRITE = JOB.get("allow_skeleton_write")
os.makedirs(OUT, exist_ok=True)
# Assets copied in after the editor last scanned must be registered before they can be loaded.
unreal.AssetRegistryHelpers.get_asset_registry().scan_paths_synchronous(["/Game/Characters"], True)
eal = unreal.EditorAssetLibrary
lib = unreal.AnimationLibrary
result = {}

for name, spec in JOB["clips"].items():
    anim = eal.load_asset(spec["asset"])
    mesh = eal.load_asset(spec["mesh"])
    anim_skel = anim.get_editor_property("skeleton")
    mesh_skel = mesh.get_editor_property("skeleton")
    mesh_skel_path = mesh_skel.get_path_name()
    compat = anim_skel != mesh_skel
    if compat:
        if mesh_skel_path.split(".")[0] != ALLOW_SKELETON_WRITE:
            raise RuntimeError("clip %s needs a compatible-skeleton write to %s; the job allows %r"
                               % (name, mesh_skel_path, ALLOW_SKELETON_WRITE))
        mesh_skel.add_compatible_skeleton(anim_skel)            # one side is enough for the editor check
        eal.save_loaded_asset(mesh_skel)                        # the write the caller's backup covers
    anim.set_preview_skeletal_mesh(mesh)                        # reading the property back raises: assert on the export instead
    opt = unreal.FbxExportOption()
    for prop, val in (("export_morph_targets", False), ("export_preview_mesh", False), ("level_of_detail", False), ("collision", False),
                      ("vertex_color", False), ("map_skeletal_motion_to_root", False), ("export_local_time", True), ("force_front_x_axis", False),
                      ("ascii", False), ("bake_material_inputs", unreal.FbxMaterialBakeMode.DISABLED), ("export_source_mesh", False)):
        opt.set_editor_property(prop, val)                      # 5.8: bake_material_inputs is an enum, not a bool
    opt.set_editor_property("fbx_export_compatibility", unreal.FbxExportCompatibility.FBX_2020)
    out = f"{OUT}/{name}.fbx"
    task = unreal.AssetExportTask()
    for prop, val in (("object", anim), ("filename", out), ("options", opt), ("automated", True), ("prompt", False),
                      ("replace_identical", True), ("selected", False), ("use_file_archive", False), ("write_empty_files", False)):
        task.set_editor_property(prop, val)
    ok = unreal.Exporter.run_asset_export_task(task)
    length = float(lib.get_sequence_length(anim))
    frames = int(lib.get_num_frames(anim))
    keys = int(lib.get_num_keys(anim))
    result[name] = {"fbx": out, "ok": bool(ok), "bytes": os.path.getsize(out) if os.path.exists(out) else 0,
                    "length_s": length, "frames": frames, "keys": keys,
                    "fps": round((keys - 1) / length, 3) if length > 0 else 0.0,   # there is no get_frame_rate in 5.8
                    "root_motion": bool(anim.get_editor_property("enable_root_motion")),
                    "skeleton": anim_skel.get_path_name(), "mesh": mesh.get_path_name(),
                    "mesh_skeleton": mesh_skel_path, "compatible_skeleton_added": compat}
unreal.log("S2_RESULT " + json.dumps(result))
