import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { ColumnType } from "@prisma/client";

export const columnRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        type: z.nativeEnum(ColumnType),
        position: z.number(),
        tableId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const column = await ctx.db.column.create({
        data: input,
      });
      return column; // This includes the column ID
    }),

  edit: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string(), type: z.nativeEnum(ColumnType), position: z.number() }))
    .mutation(async ({ input: { id, name, type, position }, ctx }) => {
      return await ctx.db.column.update({
        where: { id },
        data: { name, type, position },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input: { id }, ctx }) => {
      return await ctx.db.column.delete({ where: { id } });
    }),

  getByTable: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ input: { tableId }, ctx }) => {
      return await ctx.db.column.findMany({
        where: { tableId },
        orderBy: { position: "asc" },
      });
    }),
  
    createMultiple: protectedProcedure
    .input(
      z.array(
        z.object({
          name: z.string().min(1),
          type: z.enum(["TEXT", "NUMBER"]),
          position: z.number().int().min(0),
          tableId: z.string().cuid(),
        })
      )
    )
    .mutation(async ({ ctx, input }) => {
      // Create all columns in a single transaction
      const columns = await ctx.db.$transaction(
        input.map((columnData) =>
          ctx.db.column.create({
            data: {
              name: columnData.name,
              type: columnData.type,
              position: columnData.position,
              tableId: columnData.tableId,
            },
          })
        )
      );

      return columns;
    }),
});
