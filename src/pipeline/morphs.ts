// The ARKit blendshape vocabulary the head ships, and the keep-list tiers the budget is priced at.
export const ARKIT_52: readonly string[] = [
  'eyeBlinkLeft', 'eyeLookDownLeft', 'eyeLookInLeft', 'eyeLookOutLeft', 'eyeLookUpLeft', 'eyeSquintLeft', 'eyeWideLeft',
  'eyeBlinkRight', 'eyeLookDownRight', 'eyeLookInRight', 'eyeLookOutRight', 'eyeLookUpRight', 'eyeSquintRight', 'eyeWideRight',
  'jawForward', 'jawLeft', 'jawRight', 'jawOpen', 'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthLeft', 'mouthRight',
  'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight', 'mouthDimpleLeft', 'mouthDimpleRight',
  'mouthStretchLeft', 'mouthStretchRight', 'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper',
  'mouthPressLeft', 'mouthPressRight', 'mouthLowerDownLeft', 'mouthLowerDownRight', 'mouthUpperUpLeft', 'mouthUpperUpRight',
  'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
  'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight', 'noseSneerLeft', 'noseSneerRight', 'tongueOut',
];

export const EYE_LOOK: readonly string[] = ARKIT_52.filter((n) => n.startsWith('eyeLook'));

// D7 list read literally: "jawOpen, mouthSmileL/R, mouthFrownL/R, mouthFunnel, eyeBlinkL/R, eyeWideL/R,
// eyeSquintL/R, browInnerUp, browDownL mirrored" = 15 names (the spec's "14" undercounts by one).
export const KEEP_SPEC: readonly string[] = [
  'jawOpen', 'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight', 'mouthFunnel',
  'eyeBlinkLeft', 'eyeBlinkRight', 'eyeWideLeft', 'eyeWideRight', 'eyeSquintLeft', 'eyeSquintRight',
  'browInnerUp', 'browDownLeft', 'browDownRight',
];
export const KEEP_18: readonly string[] = [...KEEP_SPEC, 'mouthPucker', 'mouthStretchLeft', 'mouthStretchRight'];
export const KEEP_24: readonly string[] = [...KEEP_18, 'browOuterUpLeft', 'browOuterUpRight', 'cheekSquintLeft', 'cheekSquintRight', 'noseSneerLeft', 'noseSneerRight'];
export const TIERS: Record<string, readonly string[]> = { spec15: KEEP_SPEC, keep18: KEEP_18, keep24: KEEP_24, all52: ARKIT_52 };
