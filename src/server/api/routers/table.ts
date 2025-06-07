import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const tableRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({ name: z.string(), baseId: z.string() }))
    .mutation(async ({ input: { name, baseId }, ctx }) => {
      return await ctx.db.table.create({
        data: { name, baseId },
      });
    }),

  edit: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string() }))
    .mutation(async ({ input: { id, name }, ctx }) => {
      return await ctx.db.table.update({
        where: { id },
        data: { name },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input: { id }, ctx }) => {
      return await ctx.db.table.delete({
        where: { id },
      });
    }),

  getByBase: protectedProcedure
    .input(z.object({ baseId: z.string() }))
    .query(async ({ input: { baseId }, ctx }) => {
      return await ctx.db.table.findMany({
        where: { baseId },
        orderBy: { createdAt: "asc" },
      });
    }),
  
  getById: protectedProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ input: { id }, ctx }) => {
    return await ctx.db.table.findUnique({
      where: { id },
    });
  }),

  createColumn: protectedProcedure
  .input(
    z.object({
      tableId: z.string(),
      name: z.string(),
      type: z.enum(["TEXT", "NUMBER"]),
    })
  )
  .mutation(async ({ input: { tableId, name, type }, ctx }) => {
    // Get current max position or count of columns for the table
    const columnsCount = await ctx.db.column.count({
      where: { tableId },
    });

    return await ctx.db.column.create({
      data: {
        name,
        type,
        tableId,
        position: columnsCount, // set position to current count to append at the end
      },
    });
  }),

  createRow: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
      })
    )
    .mutation(async ({ input: { tableId }, ctx }) => {
      // Fetch columns for this table
      const columns = await ctx.db.column.findMany({
        where: { tableId },
      });

      // Create new row
      const row = await ctx.db.row.create({
        data: {
          tableId,
        },
      });

      // Create empty cellValues for each column for this new row
      await Promise.all(
        columns.map((col) =>
          ctx.db.cellValue.create({
            data: {
              rowId: row.id,
              columnId: col.id,
              textValue: col.type === "TEXT" ? "" : null,
              numberValue: col.type === "NUMBER" ? 0 : null,
            },
          })
        )
      );

      return row;
    }),
});
