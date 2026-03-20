const { formatBookingConfirmation } = require("../emailTemplates");

describe("emailTemplates", () => {
  it("builds student confirmation message", () => {
    const body = formatBookingConfirmation("student");
    expect(body).toContain("Your reservation has been confirmed.");
    expect(body).toContain("Please review the cancellation policy");
  });

  it("builds staff confirmation message", () => {
    const body = formatBookingConfirmation("staff");
    expect(body).toContain("Your reservation has been confirmed.");
    expect(body).toContain("Please review the cancellation policy");
  });

  it("falls back to generic message for unknown role", () => {
    const body = formatBookingConfirmation("external-user");
    expect(body).toBe("Your reservation has been confirmed.");
  });
});
