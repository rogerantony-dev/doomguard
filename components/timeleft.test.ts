import { timeLeftState, TL_GREEN, TL_AMBER, TL_OVER } from "./timeleft";

describe("timeLeftState", () => {
  it("is green with more than half the budget left", () => {
    const s = timeLeftState(20, 60);
    expect(s.minutesLeft).toBe(40);
    expect(s.tone).toBe("ok");
    expect(s.color).toBe(TL_GREEN);
  });

  it("is amber once half the budget or less remains (the mockup moment)", () => {
    const s = timeLeftState(42, 60);
    expect(s.minutesLeft).toBe(18);
    expect(s.tone).toBe("warn");
    expect(s.color).toBe(TL_AMBER);
  });

  it("is amber exactly at half remaining", () => {
    expect(timeLeftState(30, 60).tone).toBe("warn");
  });

  it("is red and floored to zero when over the limit", () => {
    const s = timeLeftState(75, 60);
    expect(s.minutesLeft).toBe(0);
    expect(s.tone).toBe("over");
    expect(s.color).toBe(TL_OVER);
  });

  it("is red at exactly the limit (nothing left)", () => {
    expect(timeLeftState(60, 60).tone).toBe("over");
  });

  it("rounds fractional usage to whole minutes", () => {
    expect(timeLeftState(41.6, 60).minutesLeft).toBe(18);
  });

  it("never divides by a zero limit", () => {
    const s = timeLeftState(0, 0);
    expect(s.minutesLeft).toBe(1);
    expect(Number.isFinite(s.minutesLeft)).toBe(true);
  });
});
