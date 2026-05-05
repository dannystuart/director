import { test, expect } from "@playwright/test";

const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  smallMobile: { width: 320, height: 568 },
  tablet: { width: 834, height: 1194 },
  tabletLandscape: { width: 1024, height: 768 },
  desktop: { width: 1280, height: 800 },
} as const;

test.describe("Landing page responsive - Mobile", () => {
  test.use({ viewport: VIEWPORTS.mobile });

  test("all content fits within viewport width (no horizontal overflow)", async ({
    page,
  }) => {
    await page.goto("/");
    const body = page.locator("body");
    const bodyBox = await body.boundingBox();
    expect(bodyBox).toBeTruthy();
    // scrollWidth should not exceed viewport
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(VIEWPORTS.mobile.width + 1);
  });

  test("hero title is visible and sized down", async ({ page }) => {
    await page.goto("/");
    const title = page.locator(".hero-title");
    await expect(title).toBeVisible();
    const box = await title.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(VIEWPORTS.mobile.width);
  });

  test("hero subtitle fits within viewport", async ({ page }) => {
    await page.goto("/");
    const subtitle = page.locator(".hero-subtitle");
    await expect(subtitle).toBeVisible();
    const box = await subtitle.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(VIEWPORTS.mobile.width + 1);
  });

  test("bookmarklet button is full width", async ({ page }) => {
    await page.goto("/");
    const btn = page.locator(".cmd-button");
    await expect(btn).toBeVisible();
    const btnBox = await btn.boundingBox();
    const containerBox = await page.locator(".container").boundingBox();
    // Button should span most of the container width
    expect(btnBox!.width).toBeGreaterThan(containerBox!.width * 0.8);
  });

  test("terminal window fits within viewport", async ({ page }) => {
    await page.goto("/");
    const terminal = page.locator(".terminal-window");
    await expect(terminal).toBeVisible();
    const box = await terminal.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(VIEWPORTS.mobile.width + 2);
  });

  test("window bar is hidden on mobile", async ({ page }) => {
    await page.goto("/");
    const bar = page.locator(".window-bar");
    await expect(bar).toBeHidden();
  });

  test("feature cards stack in single column", async ({ page }) => {
    await page.goto("/");
    const cards = page.locator(".feature-card");
    const count = await cards.count();
    expect(count).toBe(4);

    // All cards should have roughly the same x position (single column)
    const boxes = await Promise.all(
      Array.from({ length: count }, (_, i) => cards.nth(i).boundingBox())
    );

    for (const box of boxes) {
      expect(box).toBeTruthy();
      expect(box!.width).toBeGreaterThan(VIEWPORTS.mobile.width * 0.7);
    }

    // Cards should be stacked vertically (each below the previous)
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i]!.y).toBeGreaterThan(boxes[i - 1]!.y);
    }
  });

  test("footer stacks vertically on mobile", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    const footerStyle = await footer.evaluate((el) =>
      getComputedStyle(el).flexDirection
    );
    expect(footerStyle).toBe("column");
  });

  test("warning box fits within viewport", async ({ page }) => {
    await page.goto("/");
    const warning = page.locator(".warning-box");
    await expect(warning).toBeVisible();
    const box = await warning.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(VIEWPORTS.mobile.width + 2);
  });
});

test.describe("Landing page responsive - Small Mobile (320px)", () => {
  test.use({ viewport: VIEWPORTS.smallMobile });

  test("no horizontal overflow on very small screens", async ({ page }) => {
    await page.goto("/");
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(VIEWPORTS.smallMobile.width + 1);
  });

  test("all elements remain visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".hero-title")).toBeVisible();
    await expect(page.locator(".hero-subtitle")).toBeVisible();
    await expect(page.locator(".cmd-button")).toBeVisible();
    await expect(page.locator(".terminal-window")).toBeVisible();
    await expect(page.locator(".features")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
  });
});

test.describe("Landing page responsive - Tablet", () => {
  test.use({ viewport: VIEWPORTS.tablet });

  test("no horizontal overflow on tablet", async ({ page }) => {
    await page.goto("/");
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(VIEWPORTS.tablet.width + 1);
  });

  test("feature cards display in 2-column grid", async ({ page }) => {
    await page.goto("/");
    const cards = page.locator(".feature-card");
    const boxes = await Promise.all(
      Array.from({ length: 4 }, (_, i) => cards.nth(i).boundingBox())
    );

    // First two cards should be side by side (same Y, different X)
    expect(Math.abs(boxes[0]!.y - boxes[1]!.y)).toBeLessThan(5);
    expect(boxes[1]!.x).toBeGreaterThan(boxes[0]!.x);

    // Third card should be on next row
    expect(boxes[2]!.y).toBeGreaterThan(boxes[0]!.y);
  });

  test("terminal window is properly contained", async ({ page }) => {
    await page.goto("/");
    const terminal = page.locator(".terminal-window");
    const box = await terminal.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(VIEWPORTS.tablet.width + 2);
  });

  test("footer remains visible and contained", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    const box = await footer.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(VIEWPORTS.tablet.width + 2);
  });
});

test.describe("Landing page responsive - Tablet Landscape (1024px)", () => {
  test.use({ viewport: VIEWPORTS.tabletLandscape });

  test("no horizontal overflow", async ({ page }) => {
    await page.goto("/");
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(VIEWPORTS.tabletLandscape.width + 1);
  });

  test("feature cards in 2-column grid at 1024px", async ({ page }) => {
    await page.goto("/");
    const cards = page.locator(".feature-card");
    const boxes = await Promise.all(
      Array.from({ length: 4 }, (_, i) => cards.nth(i).boundingBox())
    );
    // Should be 2-column at exactly 1024px (matches the breakpoint)
    expect(Math.abs(boxes[0]!.y - boxes[1]!.y)).toBeLessThan(5);
  });
});

test.describe("Landing page responsive - Desktop", () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test("page renders with full layout", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".hero-title")).toBeVisible();
    const bar = page.locator(".window-bar");
    await expect(bar).toBeVisible();
  });

  test("feature cards span multiple columns", async ({ page }) => {
    await page.goto("/");
    const cards = page.locator(".feature-card");
    const box0 = await cards.nth(0).boundingBox();
    const box1 = await cards.nth(1).boundingBox();
    // Should be side by side
    expect(box1!.x).toBeGreaterThan(box0!.x);
    expect(Math.abs(box0!.y - box1!.y)).toBeLessThan(5);
  });

  test("footer is horizontal on desktop", async ({ page }) => {
    await page.goto("/");
    const footerStyle = await page.locator("footer").evaluate((el) =>
      getComputedStyle(el).flexDirection
    );
    expect(footerStyle).toBe("row");
  });
});
