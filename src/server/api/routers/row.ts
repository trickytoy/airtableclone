import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const rowRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .mutation(async ({ input: { tableId }, ctx }) => {
      return await ctx.db.row.create({
        data: { tableId },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input: { id }, ctx }) => {
      return await ctx.db.row.delete({
        where: { id },
      });
    }),

  getByTable: protectedProcedure
  .input(
    z.object({
      tableId: z.string(),
      limit: z.number().min(1).max(100).default(50),
      cursor: z.string().optional(),
    })
  )
  .query(async ({ input: { tableId, limit, cursor }, ctx }) => {
    const rows = await ctx.db.row.findMany({
      where: { tableId },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      orderBy: { createdAt: "asc" },
      include: {
        cellValues: true,
      },
    });

    let nextCursor: typeof cursor | undefined = undefined;
    if (rows.length > limit) {
      const nextItem = rows.pop(); // remove the extra item
      nextCursor = nextItem!.id;
    }

    const formattedRows = rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      cellValuesByColumnId: Object.fromEntries(
        row.cellValues.map((cell) => [cell.columnId, cell])
      ),
    }));

    return {
      rows: formattedRows,
      nextCursor,
    };
  }),
});
