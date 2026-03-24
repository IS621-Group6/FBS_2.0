const { formatBookingConfirmation } = require("../emailTemplates");

describe("emailTemplates", () => {
  it("builds student confirmation message", () => {
    const body = formatBookingConfirmation("student", { deducted: 100, creditsRemaining: 4400, creditLimit: 4500 });
    expect(body).toContain("Your reservation has been confirmed.");
    expect(body).toContain("Credits deducted: 100");
    expect(body).toContain("Remaining balance: 4400");
    expect(body).toContain("50% credit refund");
  });

  it("builds staff confirmation message", () => {
    const body = formatBookingConfirmation("staff", { costCentre: "RCA-0001" });
    expect(body).toContain("Your reservation has been confirmed.");
    expect(body).toContain("Cost centre billed: RCA-0001");
    expect(body).toContain("tier-based");
  });

  it("falls back to generic message for unknown role", () => {
    const body = formatBookingConfirmation("external-user");
    expect(body).toBe("Your reservation has been confirmed.");
  });
});
