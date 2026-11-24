import { describe, expect, it } from "vitest";
import { contentForModule } from "./moduleContent";

describe("current module content", () => {
  const items = [
    { id: "video-1", module_id: "module-1" },
    { id: "video-2", module_id: "module-2" },
    { id: "material-2", module_id: "module-2" },
    { id: "exam-1", module_id: "module-1" },
    { id: "exam-2", module_id: "module-2" },
    { id: "legacy", module_id: null },
  ];
  it("shows only module 1 videos and its assessment", () => {
    expect(contentForModule(items, "module-1").map((x) => x.id)).toEqual(["video-1", "exam-1"]);
  });
  it("switches all content to module 2 without duplicates", () => {
    expect(contentForModule(items, "module-2").map((x) => x.id)).toEqual(["video-2", "material-2", "exam-2"]);
  });
  it("does not mix legacy content or empty modules with other modules", () => {
    expect(contentForModule(items, null).map((x) => x.id)).toEqual(["legacy"]);
    expect(contentForModule(items, "module-3")).toEqual([]);
  });
});
import { lockedModuleIds } from "./moduleContent";
describe("module sequence", () => {
  const mods = [{ id: "m1" }, { id: "m2" }, { id: "m3" }];
  const lessons = [{ id: "a", module_id: "m1" }, { id: "b", module_id: "m2" }, { id: "c", module_id: "m3" }];
  it("module 2 stays locked while module 1 exam is not passed", () => {
    expect([...lockedModuleIds(mods, lessons, ["m1"], [], () => true)]).toEqual(["m2", "m3"]);
  });
  it("passing module 1 exam unlocks only module 2", () => {
    expect([...lockedModuleIds(mods, lessons, ["m1", "m2"], ["m1"], () => true)]).toEqual(["m3"]);
  });
  it("unwatched videos keep the next module locked", () => {
    expect([...lockedModuleIds(mods, lessons, [], [], (id) => id !== "a")]).toEqual(["m2", "m3"]);
  });
});
