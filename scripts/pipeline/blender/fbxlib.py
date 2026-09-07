# Shared Blender 5.2 helpers for the pipeline jobs: the verified ufbx import call, evaluated
# mesh statistics, bound bones, shape-key deltas in metres, image references, GLB JSON.
import json
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
