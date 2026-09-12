// A DetachedBindMode twin sharing the skeleton reflects across y = floorY; under the default
// bind mode the twin's own transform cancels and it renders on top of the original (measured).
import { AttachedBindMode, Bone, BufferGeometry, DetachedBindMode, Float32BufferAttribute, Matrix4, MeshBasicMaterial, Object3D, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3 } from 'three';
import { expect, test } from 'vitest';

function rig(): { original: SkinnedMesh; skeleton: Skeleton; geometry: BufferGeometry } {
  const root = new Bone(); root.position.set(0, 0, 0);
  const tip = new Bone(); tip.position.set(0, 1, 0); root.add(tip);
  const skeleton = new Skeleton([root, tip]);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([0.2, 2, 0], 3));
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute([1, 0, 0, 0], 4));
  geometry.setAttribute('skinWeight', new Float32BufferAttribute([1, 0, 0, 0], 4));
  const original = new SkinnedMesh(geometry, new MeshBasicMaterial());
  original.add(root);
  original.bind(skeleton, new Matrix4());
  return { original, skeleton, geometry };
}

test('the detached twin reflects; the attached twin does not', () => {
  const { original, skeleton, geometry } = rig();
  const world = new Object3D();
  world.add(original);
  skeleton.bones[0]!.rotation.z = 0.25;         // a pose, so the test is not the identity
  const twin = (mode: typeof AttachedBindMode | typeof DetachedBindMode): SkinnedMesh => {
    const t = new SkinnedMesh(geometry, new MeshBasicMaterial());
    t.bind(skeleton, original.bindMatrix);
    t.bindMode = mode;
    t.scale.y = -1;
    t.position.y = 0;                            // 2 * floorY with floorY = 0
    world.add(t);
    return t;
  };
  const detached = twin(DetachedBindMode);
  const attached = twin(AttachedBindMode);
  world.updateMatrixWorld(true);
  skeleton.update();
  const o = original.applyBoneTransform(0, new Vector3()).applyMatrix4(original.matrixWorld);
  const d = detached.applyBoneTransform(0, new Vector3()).applyMatrix4(detached.matrixWorld);
  const a = attached.applyBoneTransform(0, new Vector3()).applyMatrix4(attached.matrixWorld);
  expect(d.x).toBeCloseTo(o.x, 6);
  expect(d.z).toBeCloseTo(o.z, 6);
  expect(d.y).toBeCloseTo(-o.y, 6);
  expect(a.y).toBeCloseTo(o.y, 6);
});
