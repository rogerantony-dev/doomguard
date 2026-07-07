import { pointsForLimit, nextRungBelow, LADDER } from "./progress";

describe("pointsForLimit", () => {
  it("maps each ladder rung to its table value", () => {
    expect(pointsForLimit(120)).toBe(10);
    expect(pointsForLimit(90)).toBe(15);
    expect(pointsForLimit(60)).toBe(20);
    expect(pointsForLimit(45)).toBe(30);
    expect(pointsForLimit(30)).toBe(50);
    expect(pointsForLimit(15)).toBe(100);
  });
  it("falls back to round(1200/limit) off-table", () => {
    expect(pointsForLimit(20)).toBe(60); // round(1200/20)
    expect(pointsForLimit(240)).toBe(5); // round(1200/240)
  });
});

describe("nextRungBelow", () => {
  it("returns the next lower ladder value", () => {
    expect(nextRungBelow(60)).toBe(45);
    expect(nextRungBelow(120)).toBe(90);
    expect(nextRungBelow(30)).toBe(15);
  });
  it("returns null at or below the floor", () => {
    expect(nextRungBelow(15)).toBeNull();
    expect(nextRungBelow(10)).toBeNull();
  });
  it("returns the next lower rung for an off-ladder value", () => {
    expect(nextRungBelow(50)).toBe(45);
  });
});

describe("LADDER", () => {
  it("is the descending limit ladder", () => {
    expect(LADDER).toEqual([120, 90, 60, 45, 30, 15]);
  });
});
