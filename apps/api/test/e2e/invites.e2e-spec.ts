import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, truncateAll, seedUser } from './setup';

describe('Invites (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'test';
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(app);
  });

  it('POST /api/invites requires auth', async () => {
    await request(app.getHttpServer())
      .post('/api/invites')
      .send({ timeControlSeconds: 300, incrementSeconds: 0, category: 'blitz' })
      .expect(401);
  });

  it('POST /api/invites creates an invite link', async () => {
    const alice = await seedUser(app, { username: 'alice-inv', email: 'alice-inv@test.com' });

    const res = await request(app.getHttpServer())
      .post('/api/invites')
      .set('Cookie', `purechess_session=${alice.sessionToken}`)
      .send({ timeControlSeconds: 300, incrementSeconds: 0, category: 'blitz' })
      .expect((r) => {
        expect([200, 201]).toContain(r.status);
      });

    expect(res.body).toHaveProperty('inviteToken');
    expect(res.body).toHaveProperty('inviteUrl');
    expect(res.body).toHaveProperty('gameId');
  });

  it('GET /api/invites/:token returns invite info', async () => {
    const alice = await seedUser(app, { username: 'alice-inv2', email: 'alice-inv2@test.com' });

    const createRes = await request(app.getHttpServer())
      .post('/api/invites')
      .set('Cookie', `purechess_session=${alice.sessionToken}`)
      .send({ timeControlSeconds: 300, incrementSeconds: 0, category: 'blitz' });

    expect([200, 201]).toContain(createRes.status);
    const { inviteToken } = createRes.body as { inviteToken: string };
    const res = await request(app.getHttpServer()).get(`/api/invites/${inviteToken}`).expect(200);
    expect(res.body).toMatchObject({ status: 'invite_pending' });
  });
});
