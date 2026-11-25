import { rerankWithAi } from "../client/ai";
import { indexedDbStore } from "../store";
import { EMPTY_SNAPSHOT, LocalRepo } from "./local";

/** Your own wardrobe: IndexedDB on this device, starts empty, AI re-rank when available. */
export function mineRepo(): LocalRepo {
  return new LocalRepo({
    kind: "mine",
    store: indexedDbStore("mine"),
    seed: async () => structuredClone(EMPTY_SNAPSHOT),
    rerank: rerankWithAi,
  });
}
