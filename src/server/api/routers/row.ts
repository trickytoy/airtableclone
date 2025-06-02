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
    .input(z.object({ tableId: z.string() }))
    .query(async ({ input: { tableId }, ctx }) => {
      return await ctx.db.row.findMany({
        where: { tableId },
        orderBy: { createdAt: "asc" },
        include: {
          cellValues: {
            include: { column: true },
          },
        },
      });
    }),
});
