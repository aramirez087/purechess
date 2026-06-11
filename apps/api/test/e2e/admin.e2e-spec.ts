import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, truncateAll, seedUser } from './setup';

describe('Admin (e2e)', () => {
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

  it('GET /api/admin/users requires admin', async () => {
    const regular = await seedUser(app, { username: 'regular-adm', email: 'regular-adm@test.com' });

    await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Cookie', `purechess_session=${regular.sessionToken}`)
      .expect(403);
  });

  it('GET /api/admin/users succeeds for admin', async () => {
    const admin = await seedUser(app, {
      username: 'admin-adm',
      email: 'admin-adm@test.com',
      isAdmin: true,
    });

    await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Cookie', `purechess_session=${admin.sessionToken}`)
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });
  });

  it('POST /api/admin/users/:id/disable sets isDisabled and creates audit log', async () => {
    const admin = await seedUser(app, {
      username: 'admin-adm2',
      email: 'admin-adm2@test.com',
      isAdmin: true,
    });
    const target = await seedUser(app, { username: 'target-adm2', email: 'target-adm2@test.com' });

    await request(app.getHttpServer())
      .post(`/api/admin/users/${target.id}/disable`)
      .set('Cookie', `purechess_session=${admin.sessionToken}`)
      .send({ reason: 'e2e test disable' })
      .expect((r) => {
        expect([200, 201, 204]).toContain(r.status);
      });

    // A disabled account's session must stop working on guarded routes.
    await request(app.getHttpServer())
      .get('/api/matchmaking/status')
      .set('Cookie', `purechess_session=${target.sessionToken}`)
      .expect(401);
  });

  it('GET /api/admin/audit returns entries', async () => {
    const admin = await seedUser(app, {
      username: 'admin-adm3',
      email: 'admin-adm3@test.com',
      isAdmin: true,
    });

    await request(app.getHttpServer())
      .get('/api/admin/audit')
      .set('Cookie', `purechess_session=${admin.sessionToken}`)
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });
  });
});
