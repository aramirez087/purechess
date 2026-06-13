import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { RepertoireNodeDto } from '@purechess/shared';
import { RepertoireService } from '../../src/repertoire/repertoire.service';
import { PrismaService } from '../../src/database/prisma.service';
import { MAX_TREE_NODES } from '../../src/repertoire/repertoire-tree';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const AFTER_E4_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

/** A small legal tree: 1.e4 e5 (one line). */
function legalTree(): RepertoireNodeDto {
  return {
    fen: START_FEN,
    san: '',
    uci: '',
    children: [
      {
        fen: AFTER_E4,
        san: 'e4',
        uci: 'e2e4',
        children: [{ fen: AFTER_E4_E5, san: 'e5', uci: 'e7e5', children: [] }],
      },
    ],
  };
}

const mockPrisma = {
  repertoire: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  repertoireReview: {
    groupBy: jest.fn(),
  },
};

function rowFromTree(tree: RepertoireNodeDto, over: Partial<Record<string, unknown>> = {}) {
  const now = new Date('2026-06-13T00:00:00.000Z');
  return {
    id: 'rep1',
    userId: 'userA',
    name: 'King’s Pawn',
    color: 'white',
    rootFen: tree.fen,
    treeJson: tree,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

describe('RepertoireService', () => {
  let service: RepertoireService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [RepertoireService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(RepertoireService);
  });

  describe('create', () => {
    it('persists a validated tree with its root FEN and returns a DTO', async () => {
      const tree = legalTree();
      mockPrisma.repertoire.create.mockResolvedValue(rowFromTree(tree));

      const result = await service.create('userA', { name: 'My White', color: 'white', tree });

      const arg = mockPrisma.repertoire.create.mock.calls[0][0];
      expect(arg.data.userId).toBe('userA');
      expect(arg.data.name).toBe('My White');
      expect(arg.data.color).toBe('white');
      expect(arg.data.rootFen).toBe(START_FEN); // derived from the tree root
      expect(arg.data.treeJson).toEqual(tree);
      expect(result.id).toBe('rep1');
      expect(result.tree.children[0].san).toBe('e4');
    });

    it('trims the name and rejects an empty one', async () => {
      const tree = legalTree();
      mockPrisma.repertoire.create.mockResolvedValue(rowFromTree(tree, { name: 'Trimmed' }));
      await service.create('userA', { name: '  Trimmed  ', color: 'white', tree });
      expect(mockPrisma.repertoire.create.mock.calls[0][0].data.name).toBe('Trimmed');

      await expect(
        service.create('userA', { name: '   ', color: 'white', tree }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an illegal move in the tree', async () => {
      const tree = legalTree();
      // Replace the e4 child with an illegal jump (Ke2 isn't reachable from start).
      tree.children[0] = {
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPKPPP/RNBQ1BNR b KQkq - 0 1',
        san: 'Ke2',
        uci: 'e1e2',
        children: [],
      };
      await expect(
        service.create('userA', { name: 'Bad', color: 'white', tree }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.repertoire.create).not.toHaveBeenCalled();
    });

    it('rejects a tree whose root FEN is illegal', async () => {
      const tree = legalTree();
      tree.fen = 'not-a-fen';
      await expect(
        service.create('userA', { name: 'Bad root', color: 'white', tree }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('list', () => {
    it('returns summaries with line/node counts and last-trained, newest first', async () => {
      const tree = legalTree();
      mockPrisma.repertoire.findMany.mockResolvedValue([rowFromTree(tree)]);
      mockPrisma.repertoireReview.groupBy.mockResolvedValue([
        { repertoireId: 'rep1', _max: { updatedAt: new Date('2026-06-12T10:00:00.000Z') } },
      ]);

      const list = await service.list('userA');

      expect(mockPrisma.repertoire.findMany.mock.calls[0][0]).toMatchObject({
        where: { userId: 'userA' },
        orderBy: { updatedAt: 'desc' },
      });
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({
        id: 'rep1',
        lineCount: 1,
        nodeCount: 2,
        lastTrainedAt: '2026-06-12T10:00:00.000Z',
      });
      // The summary never carries the tree payload.
      expect((list[0] as Record<string, unknown>).tree).toBeUndefined();
    });

    it('omits lastTrainedAt when the repertoire has never been drilled', async () => {
      mockPrisma.repertoire.findMany.mockResolvedValue([rowFromTree(legalTree())]);
      mockPrisma.repertoireReview.groupBy.mockResolvedValue([]);
      const list = await service.list('userA');
      expect(list[0].lastTrainedAt).toBeUndefined();
    });

    it('skips the review query when the user has no repertoires', async () => {
      mockPrisma.repertoire.findMany.mockResolvedValue([]);
      const list = await service.list('userA');
      expect(list).toEqual([]);
      expect(mockPrisma.repertoireReview.groupBy).not.toHaveBeenCalled();
    });
  });

  describe('get / ownership', () => {
    it('returns the full DTO for the owner', async () => {
      const tree = legalTree();
      mockPrisma.repertoire.findUnique.mockResolvedValue(rowFromTree(tree));
      const dto = await service.get('userA', 'rep1');
      expect(dto.tree.children[0].san).toBe('e4');
    });

    it('404s when a different user requests the row (no existence leak)', async () => {
      mockPrisma.repertoire.findUnique.mockResolvedValue(rowFromTree(legalTree(), { userId: 'userA' }));
      await expect(service.get('userB', 'rep1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s when the row does not exist', async () => {
      mockPrisma.repertoire.findUnique.mockResolvedValue(null);
      await expect(service.get('userA', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates name only without touching the tree', async () => {
      mockPrisma.repertoire.findUnique.mockResolvedValue(rowFromTree(legalTree()));
      mockPrisma.repertoire.update.mockResolvedValue(rowFromTree(legalTree(), { name: 'Renamed' }));

      const dto = await service.update('userA', 'rep1', { name: 'Renamed' });

      const arg = mockPrisma.repertoire.update.mock.calls[0][0];
      expect(arg.where).toEqual({ id: 'rep1' });
      expect(arg.data.name).toBe('Renamed');
      expect(arg.data.treeJson).toBeUndefined();
      expect(arg.data.rootFen).toBeUndefined();
      expect(dto.name).toBe('Renamed');
    });

    it('re-validates and re-derives rootFen when the tree changes', async () => {
      mockPrisma.repertoire.findUnique.mockResolvedValue(rowFromTree(legalTree()));
      const newTree = legalTree();
      mockPrisma.repertoire.update.mockResolvedValue(rowFromTree(newTree));

      await service.update('userA', 'rep1', { tree: newTree });

      const arg = mockPrisma.repertoire.update.mock.calls[0][0];
      expect(arg.data.rootFen).toBe(START_FEN);
      expect(arg.data.treeJson).toEqual(newTree);
    });

    it('rejects an illegal updated tree before writing', async () => {
      mockPrisma.repertoire.findUnique.mockResolvedValue(rowFromTree(legalTree()));
      const bad = legalTree();
      bad.children[0].children[0].uci = 'e7e2'; // not a legal move from after e4
      bad.children[0].children[0].san = '';
      await expect(service.update('userA', 'rep1', { tree: bad })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(mockPrisma.repertoire.update).not.toHaveBeenCalled();
    });

    it('404s on a cross-user update and never writes', async () => {
      mockPrisma.repertoire.findUnique.mockResolvedValue(rowFromTree(legalTree(), { userId: 'userA' }));
      await expect(
        service.update('userB', 'rep1', { name: 'hijack' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mockPrisma.repertoire.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes when owned', async () => {
      mockPrisma.repertoire.findUnique.mockResolvedValue(rowFromTree(legalTree()));
      mockPrisma.repertoire.delete.mockResolvedValue(rowFromTree(legalTree()));
      const out = await service.remove('userA', 'rep1');
      expect(out).toEqual({ id: 'rep1' });
      expect(mockPrisma.repertoire.delete.mock.calls[0][0]).toEqual({ where: { id: 'rep1' } });
    });

    it('404s and never deletes another user’s row', async () => {
      mockPrisma.repertoire.findUnique.mockResolvedValue(rowFromTree(legalTree(), { userId: 'userA' }));
      await expect(service.remove('userB', 'rep1')).rejects.toBeInstanceOf(NotFoundException);
      expect(mockPrisma.repertoire.delete).not.toHaveBeenCalled();
    });
  });

  describe('import', () => {
    it('imports a pre-parsed tree (client-parsed path)', async () => {
      const tree = legalTree();
      mockPrisma.repertoire.create.mockResolvedValue(rowFromTree(tree));
      const dto = await service.import('userA', { name: 'Imported', color: 'white', tree });
      expect(dto.tree.children[0].san).toBe('e4');
      expect(mockPrisma.repertoire.create.mock.calls[0][0].data.rootFen).toBe(START_FEN);
    });

    it('parses a raw PGN server-side when no tree is given', async () => {
      mockPrisma.repertoire.create.mockImplementation(({ data }: { data: { treeJson: unknown } }) =>
        Promise.resolve(rowFromTree(data.treeJson as RepertoireNodeDto)),
      );
      const dto = await service.import('userA', {
        name: 'From PGN',
        color: 'white',
        pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 *',
      });
      // 1.e4 e5 2.Nf3 Nc6 3.Bb5 = 5 plies, single line.
      const tree = dto.tree;
      let depth = 0;
      let node = tree;
      while (node.children[0]) {
        node = node.children[0];
        depth++;
      }
      expect(depth).toBe(5);
    });

    it('rejects an oversized tree (over the node cap)', async () => {
      // Build a single deep chain past MAX_TREE_NODES — shape-valid, size-invalid.
      const root: RepertoireNodeDto = { fen: START_FEN, san: '', uci: '', children: [] };
      let cursor = root;
      for (let i = 0; i < MAX_TREE_NODES + 5; i++) {
        const child: RepertoireNodeDto = { fen: START_FEN, san: 'x', uci: '', children: [] };
        cursor.children.push(child);
        cursor = child;
      }
      await expect(
        service.import('userA', { name: 'Mega', color: 'white', tree: root }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.repertoire.create).not.toHaveBeenCalled();
    });

    it('rejects an illegal tree on import', async () => {
      const tree = legalTree();
      tree.children[0].san = 'e4';
      tree.children[0].uci = 'a2a8'; // impossible move
      await expect(
        service.import('userA', { name: 'Bad', color: 'white', tree }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an import with neither tree nor pgn', async () => {
      await expect(
        service.import('userA', { name: 'Empty', color: 'white' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a color that is not white/black', async () => {
      const tree = legalTree();
      await expect(
        // @ts-expect-error — deliberately invalid color
        service.import('userA', { name: 'Bad color', color: 'green', tree }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
