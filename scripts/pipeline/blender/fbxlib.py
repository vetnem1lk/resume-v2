# Shared Blender 5.2 helpers for the pipeline jobs: the verified ufbx import call, the export
# hygiene of the shipped look and its glTF flag sets, evaluated mesh statistics, bound bones,
# shape-key deltas in metres, image references, GLB JSON.
import json
import os
import struct

import bpy
import numpy as np

IMPORT_KW = dict(global_scale=1.0, use_custom_normals=True, ignore_leaf_bones=False, validate_meshes=True,
                 use_anim=True, anim_offset=0.0, import_subdivision=False, import_colors='SRGB',
                 mtl_name_collision_mode='MAKE_UNIQUE', use_custom_props=True, use_custom_props_enum_as_string=True)


def import_fbx(path, fresh=True, **overrides):
    """Optionally a fresh empty scene, then one ufbx import. Returns the new objects."""
    if fresh:
        bpy.ops.wm.read_factory_settings(use_empty=True)
    before = set(bpy.data.objects)
    bpy.ops.wm.fbx_import(filepath=path, **{**IMPORT_KW, **overrides})
    return [o for o in bpy.data.objects if o not in before]


# Bones the pack rig carries for IK only: never deform, never a glTF joint.
IK = {"ik_foot_root", "ik_foot_l", "ik_foot_r", "ik_hand_root", "ik_hand_gun", "ik_hand_l", "ik_hand_r"}

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


def load_look(combine):
    """Import the combine and apply the export hygiene: IK bones undeformed, mesh datablocks named
    after their objects, one UV name, no colour attributes. Returns (new objects, armature)."""
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
    """Cut every mesh's shape keys down to the keep list (None = keep all); returns what survived."""
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
    """What an exported GLB carries, read back from its own JSON chunk."""
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


def frame_range(obj):
    """Action.curve_frame_range walks the legacy f-curve list and segfaults on a Blender 5 slotted
    action: read the range from the object's own slot channelbag instead."""
    ad = obj.animation_data
    assert ad and ad.action and ad.action_slot, "the imported clip carries no slotted action"
    cb = ad.action.layers[0].strips[0].channelbag(ad.action_slot)
    spans = [f.range() for f in cb.fcurves if f.keyframe_points]
    assert spans, "the imported clip carries no keyframes"
    return int(min(s[0] for s in spans)), int(max(s[1] for s in spans))


def mesh_stats(obj, dg):
    me = obj.data
    ev = obj.evaluated_get(dg)
    m = ev.to_mesh()
    m.calc_loop_triangles()
    tris, ev_verts = len(m.loop_triangles), len(m.vertices)
    ev.to_mesh_clear()
    return {"verts": len(me.vertices), "edges": len(me.edges), "loops": len(me.loops), "polys": len(me.polygons),
            "eval_tris": tris, "eval_verts": ev_verts,
            "uv_layers": [u.name for u in me.uv_layers],
            "color_attributes": [(c.name, c.domain, c.data_type) for c in me.color_attributes],
            "material_slots": [s.name for s in obj.material_slots],
            "modifiers": [(md.type, md.name) for md in obj.modifiers]}


def bound_bones(obj):
    """Vertex groups with any weight > 0 (no foreach fast path exists for weights in 5.2)."""
    used = set()
    for v in obj.data.vertices:
        for g in v.groups:
            if g.weight > 0.0:
                used.add(g.group)
    return [obj.vertex_groups[i].name for i in sorted(used)]


def armature_report(arm):
    bones = arm.data.bones
    return {"bone_count": len(bones), "deform_count": sum(1 for b in bones if b.use_deform),
            "bones": [(b.name, b.parent.name if b.parent else None, b.use_deform) for b in bones]}


def shape_key_report(obj):
    """Per key: max / mean delta vs Basis in METRES (world 3x3 = 0.01 * Rx(90), norm-preserving),
    moved-vertex count above 0.01 mm. Deltas are centimetres in mesh-local space."""
    key = obj.data.shape_keys
    if key is None:
        return []
    basis = key.reference_key
    n = len(basis.points)
    unit = np.array(obj.matrix_world.to_3x3(), dtype=np.float64)
    base = np.empty(n * 3, dtype=np.float32)
    basis.points.foreach_get("co", base)
    buf = np.empty(n * 3, dtype=np.float32)
    out = []
    for k in key.key_blocks:
        if k == basis:
            continue
        k.points.foreach_get("co", buf)
        d = (buf.astype(np.float64) - base).reshape(n, 3) @ unit.T
        mag = np.linalg.norm(d, axis=1) if n else np.zeros(0)
        out.append({"name": k.name,
                    "max_delta_m": float(mag.max()) if n else 0.0,
                    "mean_delta_m": float(mag.mean()) if n else 0.0,
                    "moved_verts": int((mag > 1e-5).sum()),
                    "relative_key": k.relative_key.name if k.relative_key else None,
                    "mute": k.mute})
    return out


def material_images(mat):
    """(image name, basename, unresolved, colourspace) per TEX_IMAGE node; the paths are dead vendor paths."""
    if not mat or not mat.node_tree:
        return []
    return [(n.image.name, bpy.path.basename(n.image.filepath), tuple(n.image.size) == (0, 0), n.image.colorspace_settings.name)
            for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image]


def key_fcurves(obj):
    """Shape-key f-curves of an imported clip, scoped to the Key's own slot (Blender 5 slotted actions)."""
    key = obj.data.shape_keys
    ad = key.animation_data if key else None
    if not (ad and ad.action and ad.action_slot):
        return {}
    assert len(ad.action.layers) == 1 and len(ad.action.layers[0].strips) == 1, "unexpected action layout"
    cb = ad.action.layers[0].strips[0].channelbag(ad.action_slot)
    if cb is None:
        return {}
    out = {}
    for f in cb.fcurves:
        n = len(f.keyframe_points)
        buf = np.empty(n * 2, dtype=np.float64)
        f.keyframe_points.foreach_get("co", buf)
        out[f.data_path] = buf.reshape(n, 2)
    return out


def glb_json(path):
    with open(path, "rb") as fh:
        d = fh.read()
    assert d[:4] == b"glTF", path
    off = 12
    while off < len(d):
        ln, ty = struct.unpack_from("<II", d, off)
        if ty == 0x4E4F534A:
            return json.loads(d[off + 8:off + 8 + ln].decode("utf-8"))
        off += 8 + ln
    raise AssertionError("no JSON chunk in " + path)


def write_json(path, data):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=1, ensure_ascii=False, default=str)
