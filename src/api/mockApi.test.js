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

  it("returns wallet balance and transactions", async () => {
    const balance = await mockApi.getWalletBalance();
    const transactions = await mockApi.getTransactions();

    expect(typeof balance).toBe("number");
    expect(balance).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(transactions)).toBe(true);
    expect(transactions.length).toBeGreaterThan(0);
    expect(transactions[0]).toHaveProperty("coins");
  });

  it("returns trending tags and public profile", async () => {
    const tags = await mockApi.getTrendingTags();
    const profile = await mockApi.getPublicProfile("creator");

    expect(Array.isArray(tags)).toBe(true);
    expect(tags.length).toBeGreaterThan(0);
    expect(tags[0].startsWith("#")).toBe(true);
    expect(profile).toBeTruthy();
    expect(profile.username).toBe("creator");
    expect(Array.isArray(profile.posts)).toBe(true);
  });
});
