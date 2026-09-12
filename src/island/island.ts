// The scene island: the only chunk that imports three. Filled in by the island tasks; until then
// mounting is a no-op that proves the chunk pipeline (lazy import, budget, purity).
import { REVISION } from 'three';

export function mount(): void {
  void REVISION;
}
