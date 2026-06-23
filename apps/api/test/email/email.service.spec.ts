import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../src/email/email.service';

describe('EmailService', () => {
  let service: EmailService;
  const mockConfig = { get: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    global.fetch = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('logs instead of sending when RESEND_API_KEY is unset', async () => {
    mockConfig.get.mockImplementation((key: string) => {
      if (key === 'RESEND_API_KEY') return '';
      if (key === 'EMAIL_FROM') return 'PureChess <noreply@test>';
      return undefined;
    });

    await service.send({
      to: 'user@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
      text: 'Hi',
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('calls Resend when API key is configured', async () => {
    mockConfig.get.mockImplementation((key: string) => {
      if (key === 'RESEND_API_KEY') return 're_test';
      if (key === 'EMAIL_FROM') return 'PureChess <noreply@test>';
      return undefined;
    });
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    await service.send({
      to: 'user@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});