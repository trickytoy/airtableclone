import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const cellValueRouter = createTRPCRouter({
  upsert: protectedProcedure
  .input(z.object({
    rowId: z.string(),
    columnId: z.string(),
    textValue: z.string().optional(),
    numberValue: z.number().optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    return await ctx.db.cellValue.upsert({
      where: {
        rowId_columnId: {
          rowId: input.rowId,
          columnId: input.columnId,
        },
      },
      update: {
        textValue: input.textValue,
        numberValue: input.numberValue,
      },
      create: {
        rowId: input.rowId,
        columnId: input.columnId,
        textValue: input.textValue,
        numberValue: input.numberValue,
      },
    });
  }),
});
