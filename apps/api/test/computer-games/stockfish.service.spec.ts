import { StockfishService, StockfishEngine, StockfishFactory } from '../../src/computer-games/stockfish.service';

class TestableStockfishService extends StockfishService {
  private mockFactory: StockfishFactory;

  constructor(factory: StockfishFactory) {
    super();
    this.mockFactory = factory;
  }

  protected override async loadFactory(): Promise<StockfishFactory> {
    return this.mockFactory;
  }
}

function makeEngine(): { engine: StockfishEngine; commands: string[] } {
  const commands: string[] = [];
  const engine: StockfishEngine = {
    postMessage(cmd: string) {
      commands.push(cmd);
      if (cmd === 'uci' && engine.onmessage) {
        engine.onmessage('uciok');
      } else if (cmd === 'isready' && engine.onmessage) {
        engine.onmessage('readyok');
      } else if (cmd.startsWith('go movetime') && engine.onmessage) {
        engine.onmessage('info depth 10 score cp 30');
        engine.onmessage('bestmove e2e4 ponder e7e5');
      }
    },
    onmessage: null,
    terminate: jest.fn(),
  };
  return { engine, commands };
}

describe('StockfishService', () => {
  it('sends correct UCI command sequence and returns bestmove', async () => {
    const { engine, commands } = makeEngine();
    const service = new TestableStockfishService(() => engine);

    const move = await service.getBestMove(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      3,
      500,
    );

    expect(move).toBe('e2e4');
    expect(commands[0]).toBe('uci');
    expect(commands[1]).toBe('setoption name Skill Level value 5');
    expect(commands[2]).toBe('isready');
    expect(commands[3]).toBe('position fen rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(commands[4]).toBe('go movetime 500');
    expect(engine.terminate).toHaveBeenCalled();
  });

  it('maps skill levels correctly', async () => {
    const cases: Array<[number, number]> = [
      [1, 0], [2, 3], [3, 5], [4, 8], [5, 11], [6, 14], [7, 17], [8, 20],
    ];

    for (const [level, expectedSkill] of cases) {
      const { engine, commands } = makeEngine();
      const service = new TestableStockfishService(() => engine);
      await service.getBestMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', level);
      expect(commands[1]).toBe(`setoption name Skill Level value ${expectedSkill}`);
    }
  });

  it('rejects on timeout', async () => {
    jest.useFakeTimers();
    const engine: StockfishEngine = {
      postMessage: jest.fn(),
      onmessage: null,
      terminate: jest.fn(),
    };
    const service = new TestableStockfishService(() => engine);

    const promise = service.getBestMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 1);
    // Flush microtasks so loadFactory() resolves and setTimeout is registered before advancing
    await Promise.resolve();
    jest.advanceTimersByTime(5001);

    await expect(promise).rejects.toThrow('Stockfish timeout');
    expect(engine.terminate).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('rejects when bestmove is (none)', async () => {
    const { engine } = makeEngine();
    // Override go movetime to return (none)
    const origPost = engine.postMessage.bind(engine);
    engine.postMessage = (cmd: string) => {
      if (cmd.startsWith('go movetime')) {
        engine.onmessage?.('bestmove (none)');
      } else {
        origPost(cmd);
      }
    };

    const service = new TestableStockfishService(() => engine);
    await expect(
      service.getBestMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 1),
    ).rejects.toThrow('no legal move');
  });
});
