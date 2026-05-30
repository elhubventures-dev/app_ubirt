import { describe, expect, it } from "vitest";
import { mockApi } from "@/api/mockApi";

describe("mockApi", () => {
  it("returns feed items", async () => {
    const feed = await mockApi.getFeed();
    expect(Array.isArray(feed)).toBe(true);
    expect(feed.length).toBeGreaterThan(0);
  });

  it("adds a comment to a post", async () => {
    const postId = "post-1";
    const before = await mockApi.getComments(postId);
    await mockApi.addComment(postId, "Test comment");
    const after = await mockApi.getComments(postId);
    expect(after.length).toBe(before.length + 1);
    expect(after.at(-1)?.text).toBe("Test comment");
  });

  it("saves uploads as draft status", async () => {
    const upload = await mockApi.saveUpload({
      title: "Unit test upload",
      description: "Test description",
      category: "Product",
      visibility: "team",
    });
    expect(upload.status).toBe("draft");
  });
});
