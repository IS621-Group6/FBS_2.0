const request = require('supertest');
const app = require('../index');

describe('POST /api/bookings', () => {
  it('returns credits snapshot for a student', async () => {
    const resp = await request(app)
      .post('/api/bookings')
      .set('x-user-role', 'student')
      .send({
        facilityId: 'R-0101',
        date: '2026-03-10',
        start: '09:00',
        end: '10:00',
        userEmail: 'stu1@smu.edu.sg'
      });
    expect(resp.status).toBe(201);
    expect(resp.body).toHaveProperty('creditsRemaining');
    expect(resp.body).toHaveProperty('deducted');
    expect(resp.body.creditsRemaining).toBeLessThan(4500);
  });

  it('returns cost centre for a staff member', async () => {
    const resp = await request(app)
      .post('/api/bookings')
      .set('x-user-role', 'staff')
      .send({
        facilityId: 'R-0101',
        date: '2026-03-10',
        start: '11:00',
        end: '12:00',
        userEmail: 'staff@smu.edu.sg'
      });
    expect(resp.status).toBe(201);
    expect(resp.body).toHaveProperty('costCentre');
    expect(typeof resp.body.costCentre).toBe('string');
  });
});
