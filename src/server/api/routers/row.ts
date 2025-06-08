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
        filters: z
          .array(
            z.object({
              columnId: z.string(),
              operator: z.enum([
                "is",
                "is not", 
                "contains",
                "does not contain",
                "is empty",
                "is not empty",
                "=",
                "!=",
                ">",
                "<"
              ]),
              value: z.string().optional(),
            })
          )
          .optional(),
      })
    )
    .query(async ({ input: { tableId, limit, cursor, filters }, ctx }) => {
      // Build Prisma where clause for cellValues filtering
      const cellValuesConditions: Array<{ some: any }> = [];
      
      if (filters && filters.length > 0) {
        const filterConditions = filters.map((filter) => {
          const { columnId, operator, value } = filter;

          // Create conditions for both text and number values
          const createTextCondition = (condition: any) => ({
            columnId,
            textValue: condition,
          });

          const createNumberCondition = (condition: any) => ({
            columnId,
            numberValue: condition,
          });

          switch (operator) {
            case "is":
            case "=":
              return {
                columnId,
                OR: [
                  { textValue: value ?? "" },
                  { numberValue: value ? parseFloat(value) : null },
                ],
              };
            case "is not":
            case "!=":
              return {
                columnId,
                NOT: {
                  OR: [
                    { textValue: value ?? "" },
                    { numberValue: value ? parseFloat(value) : null },
                  ],
                },
              };
            case "contains":
              return createTextCondition({
                contains: value ?? "",
                mode: "insensitive" as const,
              });
            case "does not contain":
              return {
                columnId,
                NOT: {
                  textValue: {
                    contains: value ?? "",
                    mode: "insensitive" as const,
                  },
                },
              };
            case "is empty":
              return {
                columnId,
                OR: [
                  { textValue: null },
                  { textValue: "" },
                  { numberValue: null },
                ],
              };
            case "is not empty":
              return {
                columnId,
                NOT: {
                  OR: [
                    { textValue: null },
                    { textValue: "" },
                    { numberValue: null },
                  ],
                },
              };
            case ">":
              return createNumberCondition({
                gt: value ? parseFloat(value) : 0,
              });
            case "<":
              return createNumberCondition({
                lt: value ? parseFloat(value) : 0,
              });
            default:
              return null;
          }
        }).filter((condition): condition is NonNullable<typeof condition> => condition !== null);

        if (filterConditions.length > 0) {
          // For AND logic across multiple columns, we need to ensure
          // the row has cellValues that match ALL filter conditions
          cellValuesConditions.push(
            ...filterConditions.map(condition => ({
              some: condition
            }))
          );
        }
      }

      const whereClause = {
        tableId,
        ...(cellValuesConditions.length > 0 && {
          AND: cellValuesConditions.map(condition => ({
            cellValues: condition
          }))
        }),
      };

      const rows = await ctx.db.row.findMany({
        where: whereClause,
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
        const nextItem = rows.pop();
        nextCursor = nextItem?.id;
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