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