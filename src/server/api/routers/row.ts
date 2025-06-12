import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

// Define types for better type safety
type TextValueCondition = string | null | { contains: string; mode: "insensitive" };
type NumberValueCondition = number | null | { gt: number } | { lt: number };

type CellValueCondition = {
  columnId: string;
  textValue?: TextValueCondition;
  numberValue?: NumberValueCondition;
  OR?: Array<{ 
    textValue?: TextValueCondition; 
    numberValue?: NumberValueCondition; 
  }>;
  NOT?: {
    OR?: Array<{ 
      textValue?: TextValueCondition; 
      numberValue?: NumberValueCondition; 
    }>;
    textValue?: { contains: string; mode: "insensitive" };
  };
};

type CellValuesCondition = {
  some: CellValueCondition;
};

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
                "<",
              ]),
              value: z.string().optional(),
            })
          )
          .optional(),
        sorts: z
          .array(
            z.object({
              columnId: z.string(),
              direction: z.enum(["asc", "desc"]),
            })
          )
          .optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ input: { tableId, limit, cursor, filters, sorts, search }, ctx }) => {
      const cellValuesConditions: CellValuesCondition[] = [];

      // FILTERING
      if (filters && filters.length > 0) {
        const filterConditions = filters
          .map(({ columnId, operator, value }) => {
            // Helper to safely parse numbers
            const parseNumber = (val: string | undefined) => {
              if (!val) return null;
              const parsed = parseFloat(val);
              return isNaN(parsed) ? null : parsed;
            };

            const createTextCondition = (condition: { contains: string; mode: "insensitive" }): CellValueCondition => ({
              columnId,
              textValue: condition,
            });

            const createNumberCondition = (condition: { gt: number } | { lt: number }): CellValueCondition => ({
              columnId,
              numberValue: condition,
            });

            switch (operator) {
              case "is":
              case "=":
                const numberValue = parseNumber(value);
                const isCondition: CellValueCondition = {
                  columnId,
                  OR: [
                    { textValue: value ?? "" },
                    ...(numberValue !== null ? [{ numberValue }] : []),
                  ],
                };
                return isCondition;
              case "is not":
              case "!=":
                const notNumberValue = parseNumber(value);
                const isNotCondition: CellValueCondition = {
                  columnId,
                  NOT: {
                    OR: [
                      { textValue: value ?? "" },
                      ...(notNumberValue !== null ? [{ numberValue: notNumberValue }] : []),
                    ],
                  },
                };
                return isNotCondition;
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
                    { numberValue: null }
                  ],
                };
              case "is not empty":
                return {
                  columnId,
                  NOT: {
                    OR: [
                      { textValue: null }, 
                      { textValue: "" }, 
                      { numberValue: null }
                    ],
                  },
                };
              case ">":
                const gtValue = parseNumber(value);
                return gtValue !== null ? createNumberCondition({ gt: gtValue }) : null;
              case "<":
                const ltValue = parseNumber(value);
                return ltValue !== null ? createNumberCondition({ lt: ltValue }) : null;
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

      // SEARCHING - Improved to handle partial number matches
      if (search?.trim()) {
        const searchTerm = search.trim();
        const numberSearch = parseFloat(searchTerm);
        
        const searchCondition: CellValuesCondition = {
          some: {
            columnId: "", // Will be matched against any column
            OR: [
              {
                textValue: {
                  contains: searchTerm,
                  mode: "insensitive" as const,
                } as TextValueCondition,
              },
              // Only include number search if it's a valid number
              ...(isNaN(numberSearch) ? [] : [{
                numberValue: numberSearch as NumberValueCondition,
              }]),
            ].filter(Boolean),
          },
        };
        cellValuesConditions.push(searchCondition);
      }

      const whereClause = {
        tableId,
        ...(cellValuesConditions.length > 0 && {
          AND: cellValuesConditions.map((c) => ({
            cellValues: c,
          })),
        }),
      };

      // SORTING - NEED TO FIX
      if (sorts && sorts.length > 0) {
        // First, get a count to see if we should use memory sorting
        const totalCount = await ctx.db.row.count({
          where: whereClause,
        });

        // Only use memory sorting for reasonable dataset sizes
        if (totalCount <= 1000) {
          const allRows = await ctx.db.row.findMany({
            where: whereClause,
            include: {
              cellValues: true,
            },
          });

          // Sort rows based on multiple sort criteria
          const sortedRows = allRows.sort((a, b) => {
            for (const { columnId, direction } of sorts) {
              const aCellValue = a.cellValues.find((cell) => cell.columnId === columnId);
              const bCellValue = b.cellValues.find((cell) => cell.columnId === columnId);

              // Get the actual values for comparison
              const aValue = aCellValue?.numberValue ?? aCellValue?.textValue ?? "";
              const bValue = bCellValue?.numberValue ?? bCellValue?.textValue ?? "";

              let comparison = 0;

              // Handle different value types
              if (typeof aValue === "number" && typeof bValue === "number") {
                comparison = aValue - bValue;
              } else {
                // Convert to string for comparison
                const aStr = String(aValue).toLowerCase();
                const bStr = String(bValue).toLowerCase();
                comparison = aStr.localeCompare(bStr);
              }

              if (comparison !== 0) {
                return direction === "desc" ? -comparison : comparison;
              }
            }
            return 0;
          });

          // Apply pagination
          const startIndex = cursor ? sortedRows.findIndex((row) => row.id === cursor) + 1 : 0;
          const paginatedRows = sortedRows.slice(startIndex, startIndex + limit);

          let nextCursor: typeof cursor | undefined = undefined;
          if (startIndex + limit < sortedRows.length) {
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
        } else {
          // For large datasets, fall back to simple database sorting
          // This is a limitation - complex multi-column sorting with relations is hard in Prisma
          console.warn(`Dataset too large (${totalCount} rows) for complex sorting, using simple sort`);
        }
      }

      // DEFAULT fetch (no sort or fallback)
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