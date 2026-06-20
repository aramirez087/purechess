import { BadRequestException } from '@nestjs/common';
import { ChessComService, clusterMistakes } from '../../src/chess-com/chess-com.service';

function mockRedis(store = new Map<string, string>()) {
  return {
    get: jest.fn(async (k: string) => store.get(k) ?? null),
    set: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    del: jest.fn(async (...keys: string[]) => {
      for (const k of keys) store.delete(k);
    }),
  };
}

describe('ChessComService', () => {
  it('rejects an unknown chess.com username', async () => {
    const redis = mockRedis();
    const service = new ChessComService(redis as never);
    global.fetch = jest.fn().mockResolvedValue({ status: 404, ok: false }) as typeof fetch;

    await expect(service.setLink('u1', 'nobody-here-xyz')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('stores a normalized username on link', async () => {
    const store = new Map<string, string>();
    const redis = mockRedis(store);
    const service = new ChessComService(redis as never);
    global.fetch = jest.fn().mockResolvedValue({ status: 200, ok: true }) as typeof fetch;

    const link = await service.setLink('u1', '  Hikaru  ');
    expect(link.username).toBe('hikaru');
    expect(store.get('chesscom:link:u1')).toBe('hikaru');
  });

  it('merges and caps persisted mistakes', async () => {
    const store = new Map<string, string>([['chesscom:link:u1', 'hikaru']]);
    const redis = mockRedis(store);
    const service = new ChessComService(redis as never);

    await service.saveMistakes('u1', {
      mistakes: [
        {
          gameId: 'https://chess.com/game/1',
          gameUrl: 'https://chess.com/game/1',
          ply: 5,
          fen: 'fen1',
          playedUci: 'e2e4',
          playedSan: 'e4',
          bestUci: 'd2d4',
          cpLoss: 120,
          openingLabel: 'Italian Game',
        },
      ],
    });

    const listed = await service.listMistakes('u1');
    expect(listed.mistakes).toHaveLength(1);
    expect(listed.clusters[0].openingLabel).toBe('Italian Game');
  });
});

describe('clusterMistakes', () => {
  it('groups by opening label and sorts by count', () => {
    const clusters = clusterMistakes([
      {
        gameId: 'a',
        gameUrl: 'a',
        ply: 1,
        fen: 'f',
        playedUci: 'e2e4',
        playedSan: 'e4',
        bestUci: 'd2d4',
        cpLoss: 100,
        openingLabel: 'Italian',
        reviewed: false,
        createdAt: '2026-01-01',
      },
      {
        gameId: 'b',
        gameUrl: 'b',
        ply: 3,
        fen: 'f2',
        playedUci: 'g1f3',
        playedSan: 'Nf3',
        bestUci: 'b1c3',
        cpLoss: 90,
        openingLabel: 'Italian',
        reviewed: false,
        createdAt: '2026-01-02',
      },
      {
        gameId: 'c',
        gameUrl: 'c',
        ply: 7,
        fen: 'f3',
        playedUci: 'd7d5',
        playedSan: 'd5',
        bestUci: 'e7e5',
        cpLoss: 200,
        openingLabel: 'Caro-Kann',
        reviewed: false,
        createdAt: '2026-01-03',
      },
    ]);
    expect(clusters[0].openingLabel).toBe('Italian');
    expect(clusters[0].count).toBe(2);
    expect(clusters[1].openingLabel).toBe('Caro-Kann');
  });
});