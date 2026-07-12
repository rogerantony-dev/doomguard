import { rotateAbout, translateX } from "./catmatrix";

describe("translateX", () => {
  it("is the identity when there is no offset", () => {
    expect(translateX(0)).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it("puts the horizontal offset in the tx slot only", () => {
    expect(translateX(5)).toEqual([1, 0, 0, 1, 5, 0]);
    expect(translateX(-2.5)).toEqual([1, 0, 0, 1, -2.5, 0]);
  });
});

describe("rotateAbout", () => {
  it("is the identity at zero degrees", () => {
    const m = rotateAbout(0, 112, 120);
    expect(m[0]).toBeCloseTo(1);
    expect(m[1]).toBeCloseTo(0);
    expect(m[2]).toBeCloseTo(0);
    expect(m[3]).toBeCloseTo(1);
    expect(m[4]).toBeCloseTo(0);
    expect(m[5]).toBeCloseTo(0);
  });

  it("leaves the pivot point fixed under rotation", () => {
    const ox = 112;
    const oy = 120;
    const [a, b, c, d, tx, ty] = rotateAbout(30, ox, oy);
    // Applying the affine to the pivot must return the pivot unchanged.
    const px = a * ox + c * oy + tx;
    const py = b * ox + d * oy + ty;
    expect(px).toBeCloseTo(ox);
    expect(py).toBeCloseTo(oy);
  });

  it("rotates a point below the pivot to the expected place", () => {
    // A point 44 units below the pivot, rotated +90°, lands 44 units to the
    // left in SVG coords (y grows downward, so +deg is clockwise on screen).
    const ox = 112;
    const oy = 120;
    const [a, b, c, d, tx, ty] = rotateAbout(90, ox, oy);
    const px = a * ox + c * (oy + 44) + tx;
    const py = b * ox + d * (oy + 44) + ty;
    expect(px).toBeCloseTo(ox - 44);
    expect(py).toBeCloseTo(oy);
  });
});
