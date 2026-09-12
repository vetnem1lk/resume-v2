# The shipped look: the _03 combine under the export hygiene, pruned to the shipped morph list, every
# object that shares one material and carries no shape keys JOINED (the draw-call gate depends on it),
# the idle baked ROTATION-ONLY with a measured ground-contact offset, exported as the float32 twin.
#   blender -b --factory-startup --python-exit-code 1 --python assemble.py -- <combine.fbx> <idle.fbx> <out_dir> <ship.json>
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from fbxlib import GEO, PLAIN, describe, frame_range, import_fbx, load_look, prune, write_json  # noqa: E402
from rig_parity import bake_rotation_only, parity  # noqa: E402

combine, idle_fbx, out_dir, ship_path = sys.argv[sys.argv.index("--") + 1:]
os.makedirs(out_dir, exist_ok=True)
with open(ship_path, encoding="utf-8") as fh:
    SHIP = set(json.load(fh))
FEET = ("ball_l", "ball_r", "foot_l", "foot_r")
# The shipped twin keeps its shape keys DENSE: gltf-transform's meshopt compresses them afterwards,
# and a sparse accessor would survive that pass uncompressed.
DENSE = {**PLAIN, "export_try_sparse_sk": False}
R = {"combine": combine, "idle": idle_fbx}

objs, arm = load_look(combine)
R["kept"] = prune(objs, SHIP)
meshes = [o for o in objs if o.type == 'MESH']

# Join by material: same single material, no shape keys (a morphed mesh would fold its vertices
# into one morph texture). UV layers were renamed UVMap in load_look, so the join adds no second set.
groups = {}
for o in meshes:
    names = tuple(s.material.name if s.material else None for s in o.material_slots)
    groups.setdefault(names, []).append(o)
joined = {}
for key, group in groups.items():
    if len(group) < 2 or len(key) != 1 or any(o.data.shape_keys for o in group):
        continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in group:
        o.select_set(True)
    target = group[0]
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.join()
    target.name = target.data.name = "SK_MECHANICGIRL_" + key[0].removeprefix("MAT_")
    joined[key[0]] = len(group)
R["joined"] = joined
assert len(bpy.data.objects) and all(len(o.data.uv_layers) == 1 for o in bpy.data.objects if o.type == 'MESH'), "a join created a second UV layer"

# The idle: import the clip rig, measure parity, bake rotation-only, then the contact offset.
before = set(bpy.data.objects)
before_actions = set(bpy.data.actions)
import_fbx(idle_fbx, fresh=False, anim_offset=0.0)
rig = next(o for o in bpy.data.objects if o not in before and o.type == 'ARMATURE')
R["parity"] = parity(arm, rig)
fr = frame_range(rig)
scene = bpy.context.scene
scene.frame_start, scene.frame_end = fr
R["matched"] = bake_rotation_only(arm, rig)
if arm.animation_data:
    arm.animation_data.action = None
bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.nla.bake(frame_start=fr[0], frame_end=fr[1], step=1, only_selected=False, visual_keying=True,
                 clear_constraints=True, use_current_action=True, bake_types={'POSE'})
baked = arm.animation_data.action
assert baked is not None, "the bake produced no action"
baked.name = "Idle"
baked.use_fake_user = True
for o in [o for o in bpy.data.objects if o not in before]:
    bpy.data.objects.remove(o, do_unlink=True)
# The clip rig's own imported action would export as a second animation (ACTIONS mode walks the
# datablocks, not the objects), so it leaves with the objects it came in with.
for a in [a for a in bpy.data.actions if a not in before_actions and a is not baked]:
    bpy.data.actions.remove(a)


# Ground contact: the lowest foot bone over the clip must sit where it sits in the rest pose.
def lowest_foot(frame=None):
    if frame is not None:
        scene.frame_set(frame)
        bpy.context.view_layer.update()
    return min((arm.matrix_world @ arm.pose.bones[n].head).z for n in FEET if n in arm.pose.bones)


rest = min((arm.matrix_world @ arm.data.bones[n].head_local).z for n in FEET if n in arm.data.bones)
lowest = min(lowest_foot(f) for f in range(fr[0], fr[1] + 1, 4))
offset = rest - lowest
arm.location.z += offset                                    # a constant on the armature node, not a keyed track
R["contact"] = {"rest_z": round(rest, 5), "lowest_z": round(lowest, 5), "offset": round(offset, 5), "frames": [fr[0], fr[1]], "fps": scene.render.fps}

base = os.path.join(out_dir, "look_ship24_base.glb")
# Float32 out of Blender: gltf-transform quantises, where the error is measured at 0.04 mm.
bpy.ops.export_scene.gltf(filepath=base, export_animations=True, **GEO, **DENSE)
R["base"] = describe(base)
assert R["base"]["joints"] == 108, R["base"]["joints"]
assert {a["name"] for a in R["base"]["animations"]} == {"Idle"}, R["base"]["animations"]
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, "look_ship24.blend"))
write_json(os.path.join(out_dir, "assemble.json"), R)
print("S4_ASSEMBLE_OK", out_dir)
