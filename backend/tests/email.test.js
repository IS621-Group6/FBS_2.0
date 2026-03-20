const { formatBookingConfirmation } = require('../emailTemplates');

describe('emailTemplates', () => {
  it('builds student message', () => {
    const body = formatBookingConfirmation('student', { deducted: 100, creditsRemaining: 4400 });
    expect(body).toMatch(/Credits deducted: 100/);
    expect(body).toMatch(/Remaining balance: 4400/);
    expect(body).toMatch(/50% credit refund/);
  });
  it('builds staff message', () => {
    const body = formatBookingConfirmation('staff', { costCentre: 'RCA-0001' });
    expect(body).toMatch(/Cost centre billed: RCA-0001/);
    expect(body).toMatch(/tier-based/);
  });
});
