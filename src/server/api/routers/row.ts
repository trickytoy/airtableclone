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
                "is", "is not", "contains", "does not contain",
                "is empty", "is not empty", "=", "!=", ">", "<",
              ]),
              value: z.string().optional(),
            })
          )
          .optional(),
        sorts: z
          .array(
            z.object({
              id: z.string(),
              columnId: z.string(),
              direction: z.enum(["asc", "desc"]),
            })
          )
          .optional(),
      })
    )
    .query(async ({ input: { tableId, limit, cursor, filters, sorts }, ctx }) => {
      const cellValuesConditions: Array<{ some: any }> = [];

      // FILTERING
      if (filters && filters.length > 0) {
        const filterConditions = filters
          .map(({ columnId, operator, value }) => {
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
          })
          .filter((c): c is NonNullable<typeof c> => c !== null);

        if (filterConditions.length > 0) {
          cellValuesConditions.push(
            ...filterConditions.map((c) => ({ some: c }))
          );
        }
      }

      const whereClause = {
        tableId,
        ...(cellValuesConditions.length > 0 && {
          AND: cellValuesConditions.map((c) => ({
            cellValues: c,
          })),
        }),
      };

      // SORTING
      if (sorts && sorts.length > 0) {
        // For multiple sorts, we need to fetch all matching rows and sort in memory
        // since Prisma doesn't support complex sorting across relations easily
        
        const allRows = await ctx.db.row.findMany({
          where: whereClause,
          include: {
            cellValues: true,
          },
        });

        // Sort rows based on multiple sort criteria
        const sortedRows = allRows.sort((a, b) => {
          for (const { columnId, direction } of sorts) {
            const aCellValue = a.cellValues.find(cell => cell.columnId === columnId);
            const bCellValue = b.cellValues.find(cell => cell.columnId === columnId);
            
            // Get the actual values for comparison
            const aValue = aCellValue?.numberValue ?? aCellValue?.textValue ?? "";
            const bValue = bCellValue?.numberValue ?? bCellValue?.textValue ?? "";
            
            let comparison = 0;
            
            // Handle different value types
            if (typeof aValue === 'number' && typeof bValue === 'number') {
              comparison = aValue - bValue;
            } else {
              // Convert to string for comparison
              const aStr = String(aValue).toLowerCase();
              const bStr = String(bValue).toLowerCase();
              comparison = aStr.localeCompare(bStr);
            }
            
            if (comparison !== 0) {
              return direction === 'desc' ? -comparison : comparison;
            }
          }
          return 0;
        });

        // Apply pagination
        const startIndex = cursor ? sortedRows.findIndex(row => row.id === cursor) + 1 : 0;
        const endIndex = Math.min(startIndex + limit, sortedRows.length);
        const paginatedRows = sortedRows.slice(startIndex, startIndex + limit);
        
        let nextCursor: typeof cursor | undefined = undefined;
        if (endIndex < sortedRows.length) {
          nextCursor = paginatedRows[paginatedRows.length - 1]?.id;
        }

        const formattedRows = paginatedRows.map((row) => ({
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
      }

      // DEFAULT fetch (no sort)
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