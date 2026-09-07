# Face proof, Blender side: import the UE FBX, prove the shape-key f-curves arrived normalised,
# export a glTF with a 'weights' channel, prove it in the GLB JSON, write the verdict.
#   blender -b --factory-startup --python-exit-code 1 --python face_proof.py -- <fbx> <glb> <report.json> <morph,...>
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from fbxlib import glb_json, import_fbx, key_fcurves, write_json  # noqa: E402

fbx, glb, report_path, morphs = sys.argv[sys.argv.index("--") + 1:]
morphs = morphs.split(",")
R = {"fbx": fbx, "checks": {}}

new = import_fbx(fbx, anim_offset=0.0)
heads = [o for o in new if o.type == 'MESH' and o.data.shape_keys and any(k.name == "jawOpen" for k in o.data.shape_keys.key_blocks)]
assert len(heads) == 1, f"expected one morph mesh with jawOpen, got {[o.name for o in heads]}"
ob = heads[0]
names = [k.name for k in ob.data.shape_keys.key_blocks]
R["checks"]["shape_keys"] = len(names) - 1
assert len(names) - 1 == 52, f"head should carry 52 keys, got {len(names) - 1}"

fcs = key_fcurves(ob)
R["checks"]["fcurves"] = len(fcs)
assert fcs, "no shape-key f-curves: the UE export wrote no blend-shape curves (export_preview_mesh / metadata)"
for m in morphs:
    path = f'key_blocks["{m}"].value'
    assert path in fcs, f"missing curve {path}; have {sorted(fcs)[:6]}"
    vals = fcs[path][:, 1]
    assert len(vals) > 2, f"{m}: {len(vals)} keys"
    assert 0.9 <= vals.max() <= 1.001, f"{m}: peak {vals.max()} (100 = not normalised)"
    assert vals.min() >= -0.001, f"{m}: min {vals.min()}"
    R["checks"][m] = {"keys": int(len(vals)), "peak": float(vals.max())}

ad = ob.data.shape_keys.animation_data
assert ad.action_slot is not None, "action_slot missing: exporter would write no animation"
fr = ad.action.curve_frame_range
bpy.context.scene.frame_start, bpy.context.scene.frame_end = int(fr[0]), int(fr[1])
R["checks"]["frame_range"] = [int(fr[0]), int(fr[1])]
R["checks"]["fps"] = bpy.context.scene.render.fps

bpy.ops.export_scene.gltf(
    filepath=glb, export_format='GLB', export_apply=False, export_image_format='NONE',
    export_yup=True, export_texcoords=True, export_normals=True, export_tangents=False,
    export_vertex_color='NONE', export_attributes=False, export_extras=False,
    export_morph=True, export_morph_normal=False, export_morph_tangent=False, export_morph_animation=True,
    export_morph_reset_sk_data=True, export_try_sparse_sk=True, export_try_omit_sparse_sk=False,
    export_skins=True, export_influence_nb=4, export_all_influences=False, export_def_bones=False,
    export_leaf_bone=False, export_rest_position_armature=True,
    export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True, export_frame_step=1,
    export_frame_range=False, export_sampling_interpolation_fallback='LINEAR', export_optimize_animation_size=True,
    export_bake_animation=False, export_draco_mesh_compression_enable=False, export_meshopt_compression_enable=False)

j = glb_json(glb)
morph_meshes = [m for m in j["meshes"] if m.get("extras", {}).get("targetNames")]
assert morph_meshes, "no mesh carries extras.targetNames"
for m in morph_meshes:
    tn = m["extras"]["targetNames"]
    for p in m["primitives"]:
        assert len(p.get("targets", [])) == len(tn), f"{m.get('name')}: targets {len(p.get('targets', []))} != names {len(tn)}"
    assert len(m.get("weights", [])) == len(tn)
head_mesh = next(m for m in morph_meshes if "jawOpen" in m["extras"]["targetNames"])
chans = [(ai, c) for ai, a in enumerate(j.get("animations", [])) for c in a["channels"] if c["target"]["path"] == "weights"]
assert chans, "no 'weights' channel in the GLB"
ai, c = chans[0]
smp = j["animations"][ai]["samplers"][c["sampler"]]
n_in, n_out = j["accessors"][smp["input"]]["count"], j["accessors"][smp["output"]]["count"]
assert smp.get("interpolation", "LINEAR") == "LINEAR", smp
assert n_out == n_in * len(head_mesh["extras"]["targetNames"]), (n_in, n_out)
R["checks"]["glb"] = {"bytes": os.path.getsize(glb), "animations": [a.get("name") for a in j["animations"]],
                      "weights_channels": len(chans), "keyframes": n_in, "targets": len(head_mesh["extras"]["targetNames"]),
                      # The head exports as one glTF mesh of several material primitives, each a separate
                      # three.js geometry carrying all 52 targets: morph VRAM follows the sum, not the first.
                      "head_primitives": len(head_mesh["primitives"]),
                      "head_position_count": sum(j["accessors"][p["attributes"]["POSITION"]]["count"] for p in head_mesh["primitives"]),
                      "mesh_names": [m.get("name") for m in morph_meshes]}
R["verdict"] = "yes"
write_json(report_path, R)
print("S2_FACE_PROOF_OK", glb)
