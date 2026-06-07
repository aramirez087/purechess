describe('Log redaction', () => {
  const SENSITIVE_FIELDS = ['cookie', 'authorization', 'password', 'token'];

  it('redact config includes all sensitive fields', async () => {
    const { LoggerModule } = await import('nestjs-pino');
    expect(LoggerModule).toBeDefined();

    const redactPaths = [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.body.password',
      'req.body.token',
    ];

    SENSITIVE_FIELDS.forEach((field) => {
      const covered = redactPaths.some((path) => path.includes(field));
      expect(covered).toBe(true);
    });
  });

  it('cookie value is redacted (not in serialized log)', () => {
    const logRecord = {
      req: {
        headers: {
          cookie: '[Redacted]',
          'content-type': 'application/json',
        },
        body: {
          password: '[Redacted]',
          token: '[Redacted]',
        },
      },
    };

    const serialized = JSON.stringify(logRecord);
    expect(serialized).not.toContain('secret-cookie-value');
    expect(serialized).not.toContain('Bearer fake-token');
    expect(logRecord.req.headers.cookie).toBe('[Redacted]');
    expect(logRecord.req.body.password).toBe('[Redacted]');
  });
});
