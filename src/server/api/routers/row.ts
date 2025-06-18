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
  createMultiple: protectedProcedure
    .input(
      z.array(
        z.object({
          tableId: z.string().cuid(),
          cellValues: z.array(
            z.object({
              columnId: z.string().cuid(),
              textValue: z.string().nullable().optional(),
              numberValue: z.number().nullable().optional(),
            })
          ),
        })
      )
    )
    .mutation(async ({ ctx, input }) => {
      const results = [];

      // Process each row in a transaction
      for (const rowData of input) {
        const result = await ctx.db.$transaction(async (tx) => {
          // Create the row
          const newRow = await tx.row.create({
            data: {
              tableId: rowData.tableId,
            },
          });

          // Create all cell values for this row
          if (rowData.cellValues.length > 0) {
            const cellValues = await Promise.all(
              rowData.cellValues.map((cellData) =>
                tx.cellValue.create({
                  data: {
                    rowId: newRow.id,
                    columnId: cellData.columnId,
                    textValue: cellData.textValue,
                    numberValue: cellData.numberValue,
                  },
                })
              )
            );

            return {
              ...newRow,
              cellValues,
            };
          }

          return newRow;
        });

        results.push(result);
      }

      return results;
    }),


  count: protectedProcedure
  .input(z.object({ tableId: z.string() }))
  .query(async ({ input: { tableId }, ctx }) => {
    const total = await ctx.db.row.count({
      where: { tableId },
    });
    return { total };
  }),

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
      // First verify the row belongs to a table in a base owned by the current user
      
      // Manual cascade delete to handle foreign key constraints
      // 1. Delete all cell values for this row first
      await ctx.db.cellValue.deleteMany({
        where: {
          rowId: id
        }
      });

      // 2. Finally delete the row
      return await ctx.db.row.delete({
        where: { id },
      });
    }),

    deleteMultiple: protectedProcedure
    .input(z.object({ 
      rowIds: z.array(z.string()).min(1).max(100) // Limit batch size to prevent abuse
    }))
    .mutation(async ({ input: { rowIds }, ctx }) => {
      // First verify all rows belong to tables in bases owned by the current user
      

      // Use a transaction to ensure all deletes succeed or fail together
      return await ctx.db.$transaction(async (tx) => {
        // 1. Delete all cell values for these rows first
        await tx.cellValue.deleteMany({
          where: {
            rowId: { in: rowIds }
          }
        });

        // 2. Delete all the rows
        const deleteResult = await tx.row.deleteMany({
          where: { 
            id: { in: rowIds }
          },
        });

        return {
          deletedCount: deleteResult.count,
          deletedIds: rowIds
        };
      });
    }),

  // Minimal change - just add the optional parameters your frontend expects
getRows: protectedProcedure
    .input(z.object({
      tableId: z.string(),
      cursor: z.string().nullish(),
      limit: z.number().min(1).max(1000).default(200), // Increased max limit
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
    }))
    .query(async ({ input: { tableId, limit, cursor, filters, sorts, search }, ctx }) => {
      
      // If we have sorts, use raw SQL for complex sorting
      if (sorts && sorts.length > 0) {
        // Get column information for proper type handling
        const columns = await ctx.db.column.findMany({
          where: { 
            id: { in: sorts.map(s => s.columnId) }
          },
          select: { id: true, type: true }
        });
        
        const columnTypeMap = Object.fromEntries(
          columns.map(col => [col.id, col.type])
        );

        // Build dynamic joins for each sort column
        const joins = sorts.map((sort, index) => {
          return `LEFT JOIN "CellValue" cv${index} ON r.id = cv${index}."rowId" AND cv${index}."columnId" = $${index + 2}`;
        }).join('\n');

        // Build ORDER BY clause with proper type handling
        const orderClauses = sorts.map((sort, index) => {
          const columnType = columnTypeMap[sort.columnId];
          const direction = sort.direction.toUpperCase();
          
          if (columnType === 'NUMBER') {
            // For numbers, prioritize numberValue, then try to parse textValue as number
            return `
              CASE 
                WHEN cv${index}."numberValue" IS NOT NULL THEN cv${index}."numberValue"
                WHEN cv${index}."textValue" ~ '^-?[0-9]+\.?[0-9]*$' THEN cv${index}."textValue"::numeric
                ELSE NULL 
              END ${direction} NULLS LAST`;
          } else {
            // For text, prioritize textValue, then convert numberValue to text
            return `
              CASE 
                WHEN cv${index}."textValue" IS NOT NULL AND cv${index}."textValue" != '' THEN cv${index}."textValue"
                WHEN cv${index}."numberValue" IS NOT NULL THEN cv${index}."numberValue"::text
                ELSE NULL 
              END ${direction} NULLS LAST`;
          }
        }).join(',\n');

        // Build WHERE clause for filters and search
        let whereConditions = [`r."tableId" = $1`];
        let paramIndex = sorts.length + 2; // Start after tableId and columnIds
        const params: any[] = [tableId, ...sorts.map(s => s.columnId)];

        // Handle filters with proper SQL generation
        if (filters && filters.length > 0) {
          const filterSubqueries: string[] = [];
          
          for (const filter of filters) {
            const { columnId, operator, value } = filter;
            
            // Helper to safely parse numbers
            const parseNumber = (val: string | undefined) => {
              if (!val) return null;
              const parsed = parseFloat(val);
              return isNaN(parsed) ? null : parsed;
            };

            let filterCondition = '';
            
            switch (operator) {
              case "is":
              case "=":
                const numberValue = parseNumber(value);
                if (numberValue !== null) {
                  filterCondition = `
                    EXISTS (
                      SELECT 1 FROM "CellValue" cv_filter 
                      WHERE cv_filter."rowId" = r.id 
                      AND cv_filter."columnId" = $${paramIndex}
                      AND (cv_filter."textValue" = $${paramIndex + 1} OR cv_filter."numberValue" = $${paramIndex + 2})
                    )`;
                  params.push(columnId, value ?? "", numberValue);
                  paramIndex += 3;
                } else {
                  filterCondition = `
                    EXISTS (
                      SELECT 1 FROM "CellValue" cv_filter 
                      WHERE cv_filter."rowId" = r.id 
                      AND cv_filter."columnId" = $${paramIndex}
                      AND cv_filter."textValue" = $${paramIndex + 1}
                    )`;
                  params.push(columnId, value ?? "");
                  paramIndex += 2;
                }
                break;

              case "is not":
              case "!=":
                const notNumberValue = parseNumber(value);
                if (notNumberValue !== null) {
                  filterCondition = `
                    NOT EXISTS (
                      SELECT 1 FROM "CellValue" cv_filter 
                      WHERE cv_filter."rowId" = r.id 
                      AND cv_filter."columnId" = $${paramIndex}
                      AND (cv_filter."textValue" = $${paramIndex + 1} OR cv_filter."numberValue" = $${paramIndex + 2})
                    )`;
                  params.push(columnId, value ?? "", notNumberValue);
                  paramIndex += 3;
                } else {
                  filterCondition = `
                    NOT EXISTS (
                      SELECT 1 FROM "CellValue" cv_filter 
                      WHERE cv_filter."rowId" = r.id 
                      AND cv_filter."columnId" = $${paramIndex}
                      AND cv_filter."textValue" = $${paramIndex + 1}
                    )`;
                  params.push(columnId, value ?? "");
                  paramIndex += 2;
                }
                break;

              case "contains":
                filterCondition = `
                  EXISTS (
                    SELECT 1 FROM "CellValue" cv_filter 
                    WHERE cv_filter."rowId" = r.id 
                    AND cv_filter."columnId" = $${paramIndex}
                    AND cv_filter."textValue" ILIKE $${paramIndex + 1}
                  )`;
                params.push(columnId, `%${value ?? ""}%`);
                paramIndex += 2;
                break;

              case "does not contain":
                filterCondition = `
                  NOT EXISTS (
                    SELECT 1 FROM "CellValue" cv_filter 
                    WHERE cv_filter."rowId" = r.id 
                    AND cv_filter."columnId" = $${paramIndex}
                    AND cv_filter."textValue" ILIKE $${paramIndex + 1}
                  )`;
                params.push(columnId, `%${value ?? ""}%`);
                paramIndex += 2;
                break;

              case "is empty":
                // Handles:
                // 1. CellValue record does NOT exist for this column on this row
                // OR
                // 2. CellValue record EXISTS and its textValue is NULL/empty AND its numberValue is NULL
                filterCondition = `
                  (
                    NOT EXISTS (
                      SELECT 1 FROM "CellValue" cv_filter 
                      WHERE cv_filter."rowId" = r.id 
                      AND cv_filter."columnId" = $${paramIndex}
                    )
                    OR
                    EXISTS (
                      SELECT 1 FROM "CellValue" cv_filter 
                      WHERE cv_filter."rowId" = r.id 
                      AND cv_filter."columnId" = $${paramIndex}
                      AND (
                        (cv_filter."textValue" IS NULL OR cv_filter."textValue" = '') 
                        AND cv_filter."numberValue" IS NULL
                      )
                    )
                  )`;
                params.push(columnId); // columnId for the NOT EXISTS part
                paramIndex += 1; // Increment paramIndex for the EXISTS part
                // The columnId param for the EXISTS part is the same as the NOT EXISTS part, so we don't push it again for paramIndex
                break;

              case "is not empty":
                // Handles:
                // CellValue record EXISTS and (textValue is NOT NULL/empty OR numberValue is NOT NULL)
                filterCondition = `
                  EXISTS (
                    SELECT 1 FROM "CellValue" cv_filter 
                    WHERE cv_filter."rowId" = r.id 
                    AND cv_filter."columnId" = $${paramIndex}
                    AND (
                      (cv_filter."textValue" IS NOT NULL AND cv_filter."textValue" != '') 
                      OR cv_filter."numberValue" IS NOT NULL
                    )
                  )`;
                params.push(columnId);
                paramIndex += 1;
                break;

              case ">":
                const gtValue = parseNumber(value);
                if (gtValue !== null) {
                  filterCondition = `
                    EXISTS (
                      SELECT 1 FROM "CellValue" cv_filter 
                      WHERE cv_filter."rowId" = r.id 
                      AND cv_filter."columnId" = $${paramIndex}
                      AND cv_filter."numberValue" > $${paramIndex + 1}
                    )`;
                  params.push(columnId, gtValue);
                  paramIndex += 2;
                }
                break;

              case "<":
                const ltValue = parseNumber(value);
                if (ltValue !== null) {
                  filterCondition = `
                    EXISTS (
                      SELECT 1 FROM "CellValue" cv_filter 
                      WHERE cv_filter."rowId" = r.id 
                      AND cv_filter."columnId" = $${paramIndex}
                      AND cv_filter."numberValue" < $${paramIndex + 1}
                    )`;
                  params.push(columnId, ltValue);
                  paramIndex += 2;
                }
                break;
            }

            if (filterCondition) {
              filterSubqueries.push(filterCondition);
            }
          }

          if (filterSubqueries.length > 0) {
            whereConditions.push(`(${filterSubqueries.join(' AND ')})`);
          }
        }

        // Handle search
        if (search?.trim()) {
          const searchTerm = search.trim();
          const numberSearch = parseFloat(searchTerm);
          
          // Get all columns for this table to search across them
          const tableColumns = await ctx.db.column.findMany({
            where: { tableId },
            select: { id: true, type: true }
          });

          const searchSubqueries: string[] = [];
          
          for (const column of tableColumns) {
            if (column.type === 'TEXT') {
              searchSubqueries.push(`
                EXISTS (
                  SELECT 1 FROM "CellValue" cv_search 
                  WHERE cv_search."rowId" = r.id 
                  AND cv_search."columnId" = $${paramIndex}
                  AND cv_search."textValue" ILIKE $${paramIndex + 1}
                )`);
              params.push(column.id, `%${searchTerm}%`);
              paramIndex += 2;
            } else if (column.type === 'NUMBER' && !isNaN(numberSearch)) {
              searchSubqueries.push(`
                EXISTS (
                  SELECT 1 FROM "CellValue" cv_search 
                  WHERE cv_search."rowId" = r.id 
                  AND cv_search."columnId" = $${paramIndex}
                  AND cv_search."numberValue" = $${paramIndex + 1}
                )`);
              params.push(column.id, numberSearch);
              paramIndex += 2;
            }
          }

          if (searchSubqueries.length > 0) {
            whereConditions.push(`(${searchSubqueries.join(' OR ')})`);
          }
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

        // Build the complete query WITHOUT LIMIT to get all sorted results first
        const query = `
          SELECT r.id, r."createdAt", r."tableId"
          FROM "Row" r
          ${joins}
          ${whereClause}
          ORDER BY 
            ${orderClauses},
            r."createdAt" ASC
        `;

        // Execute raw query without limit
        const rawRows = await ctx.db.$queryRawUnsafe(query, ...params) as any[];

        // Handle cursor-based pagination on the sorted results
        let startIndex = 0;
        if (cursor) {
          const cursorIndex = rawRows.findIndex((row: any) => row.id === cursor);
          startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
        }

        // Apply pagination
        const endIndex = startIndex + limit;
        const paginatedRows = rawRows.slice(startIndex, endIndex);

        // Determine next cursor
        let nextCursor: string | undefined = undefined;
        if (endIndex < rawRows.length) {
          nextCursor = paginatedRows[paginatedRows.length - 1]?.id;
        }

        // Get full row data with cell values
        const rowIds = paginatedRows.map((row: any) => row.id);
        
        if (rowIds.length === 0) {
          return { formattedRows: [], nextCursor: undefined };
        }

        const fullRows = await ctx.db.row.findMany({
          where: {
            id: { in: rowIds }
          },
          include: { 
            cellValues: {
              include: {
                column: true
              }
            }
          },
        });

        // Re-order the full rows to match our sorted order
        const rowIdToRowMap = new Map(fullRows.map(row => [row.id, row]));
        const orderedRows = rowIds.map(id => rowIdToRowMap.get(id)).filter(Boolean);

        const formattedRows = orderedRows.map((row) => ({
          id: row!.id,
          createdAt: row!.createdAt,
          cellValuesByColumnId: Object.fromEntries(
            row!.cellValues.map((cell) => [cell.columnId, cell])
          ),
        }));

        return { formattedRows, nextCursor };
      }

      // Fall back to original Prisma logic for cases without sorting
      let whereClause: any = {
        tableId,
      };

      const conditions: any[] = [];

      // FILTERING
      if (filters && filters.length > 0) {
        // Group conditions for CellValue and direct Row (for 'is empty')
        const rowLevelFilterConditions: any[] = []; // For 'is empty' which needs OR/NONE
        const cellValueFilterConditions: any[] = []; // For 'is not empty', 'is', 'contains', etc.

        const parseNumber = (val: string | undefined) => {
          if (!val) return null;
          const parsed = parseFloat(val);
          return isNaN(parsed) ? null : parsed;
        };

        for (const filter of filters) {
          const { columnId, operator, value } = filter;

          switch (operator) {
            case "is empty":
              rowLevelFilterConditions.push({
                OR: [
                  { // Case 1: No CellValue record exists for this column on this row
                    cellValues: {
                      none: {
                        columnId: columnId
                      }
                    }
                  },
                  { // Case 2: A CellValue record exists for this column, and it's truly empty
                    cellValues: {
                      some: {
                        columnId: columnId,
                        AND: [
                          { OR: [{ textValue: null }, { textValue: "" }] },
                          { numberValue: null }
                        ]
                      }
                    }
                  }
                ]
              });
              break;

            case "is not empty":
              cellValueFilterConditions.push({
                columnId: columnId,
                OR: [
                  { textValue: { not: null } },
                  { numberValue: { not: null } }
                ],
              });
              break;

            case "is":
            case "=":
              const numberValue = parseNumber(value);
              cellValueFilterConditions.push({
                columnId,
                OR: [
                  { textValue: value ?? "" },
                  ...(numberValue !== null ? [{ numberValue }] : []),
                ],
              });
              break;

            case "is not":
            case "!=":
              const notNumberValue = parseNumber(value);
              cellValueFilterConditions.push({
                columnId,
                NOT: {
                  OR: [
                    { textValue: value ?? "" },
                    ...(notNumberValue !== null ? [{ numberValue: notNumberValue }] : []),
                  ],
                },
              });
              break;

            case "contains":
              cellValueFilterConditions.push({
                columnId,
                textValue: {
                  contains: value ?? "",
                  mode: "insensitive" as const,
                },
              });
              break;

            case "does not contain":
              cellValueFilterConditions.push({
                columnId,
                NOT: {
                  textValue: {
                    contains: value ?? "",
                    mode: "insensitive" as const,
                  },
                },
              });
              break;

            case ">":
              const gtValue = parseNumber(value);
              if (gtValue !== null) {
                cellValueFilterConditions.push({
                  columnId,
                  numberValue: { gt: gtValue },
                });
              }
              break;

            case "<":
              const ltValue = parseNumber(value);
              if (ltValue !== null) {
                cellValueFilterConditions.push({
                  columnId,
                  numberValue: { lt: ltValue },
                });
              }
              break;
            default:
              break;
          }
        }

        // Add row-level conditions (e.g., from 'is empty')
        if (rowLevelFilterConditions.length > 0) {
          conditions.push({ AND: rowLevelFilterConditions });
        }

        // Add cell value conditions (wrapped in 'some')
        if (cellValueFilterConditions.length > 0) {
          conditions.push({
            AND: cellValueFilterConditions.map((c) => ({
              cellValues: { some: c },
            })),
          });
        }
      }

      // Add search conditions with OR logic (search across columns)
      if (search?.trim()) {
        const searchTerm = search.trim();
        const numberSearch = parseFloat(searchTerm);
        
        // Get all columns for this table to search across them
        const tableColumns = await ctx.db.column.findMany({
          where: { tableId },
          select: { id: true, type: true }
        });

        const searchRowConditions: any[] = [];
        
        tableColumns.forEach(column => {
          if (column.type === 'TEXT') {
            // Text search
            searchRowConditions.push({
              cellValues: {
                some: {
                  columnId: column.id,
                  textValue: {
                    contains: searchTerm,
                    mode: "insensitive" as const,
                  }
                }
              }
            });
          } else if (column.type === 'NUMBER' && !isNaN(numberSearch)) {
            // Number search - exact match
            searchRowConditions.push({
              cellValues: {
                some: {
                  columnId: column.id,
                  numberValue: numberSearch
                }
              }
            });
          }
        });

        if (searchRowConditions.length > 0) {
          conditions.push({
            OR: searchRowConditions
          });
        }
      }

      // Apply all combined conditions
      if (conditions.length > 0) {
        whereClause.AND = conditions;
      }

      const rows = await ctx.db.row.findMany({
        where: whereClause,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor } } : {}),
        orderBy: [
          { createdAt: "asc" },
          { id: "asc" }, // Add id as a secondary sort for stable pagination
        ],
        include: { 
          cellValues: {
            include: {
              column: true
            }
          }
        },
      });

      let nextCursor: string | undefined = undefined;
      if (rows.length > limit) {
        const next = rows.pop();
        nextCursor = next?.id;
      }

      const formattedRows = rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        cellValuesByColumnId: Object.fromEntries(
          row.cellValues.map((cell) => [cell.columnId, cell])
        ),
      }));

      return { formattedRows, nextCursor };
    }),
  getRowsV2: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        limit: z.number().min(1).max(1000).default(50),
        cursor: z.string().optional(), // for pagination
      })
    )
    .query(async ({ ctx, input }) => {
      const { tableId, limit, cursor } = input;

      // Get rows with pagination
      const rows = await ctx.db.row.findMany({
        where: {
          tableId: tableId,
        },
        include: {
          cellValues: {
            include: {
              column: true,
            },
          },
        },
        take: limit + 1, // Take one extra to determine if there's a next page
        cursor: cursor ? { id: cursor } : undefined
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (rows.length > limit) {
        const nextItem = rows.pop(); // Remove the extra item
        nextCursor = nextItem!.id;
      }

      return {
        rows,
        nextCursor,
      };
    }),

getRowsV3: protectedProcedure
  .input(
    z.object({
      tableId: z.string(),
      cursor: z.string().nullish(),
      limit: z.number().min(1).max(200).default(200),
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
    // Helper to safely parse numbers
    const parseNumber = (val: string | undefined) => {
      if (!val) return null;
      const parsed = parseFloat(val);
      return isNaN(parsed) ? null : parsed;
    };

    // --- RAW SQL PATH (for complex sorting or when direct Prisma orderBy isn't sufficient) ---
    if (sorts && sorts.length > 0) {
      // Get column information for proper type handling
      const columns = await ctx.db.column.findMany({
        where: {
          id: { in: sorts.map((s) => s.columnId) },
        },
        select: { id: true, type: true },
      });

      const columnTypeMap = Object.fromEntries(columns.map((col) => [col.id, col.type]));

      // Build dynamic joins for each sort column
      const joins = sorts
        .map((sort, index) => {
          return `LEFT JOIN "CellValue" cv${index} ON r.id = cv${index}."rowId" AND cv${index}."columnId" = $${index + 2}`;
        })
        .join("\n");

      // Build ORDER BY clause with proper type handling
      const orderClauses = sorts
        .map((sort, index) => {
          const columnType = columnTypeMap[sort.columnId];
          const direction = sort.direction.toUpperCase();

          if (columnType === "NUMBER") {
            // For numbers, prioritize numberValue, then try to parse textValue as number
            return `
              CASE
                WHEN cv${index}."numberValue" IS NOT NULL THEN cv${index}."numberValue"
                WHEN cv${index}."textValue" ~ '^-?[0-9]+\.?[0-9]*$' THEN cv${index}."textValue"::numeric
                ELSE NULL
              END ${direction} NULLS LAST`;
          } else {
            // For text, prioritize textValue, then convert numberValue to text
            return `
              CASE
                WHEN cv${index}."textValue" IS NOT NULL AND cv${index}."textValue" != '' THEN cv${index}."textValue"
                WHEN cv${index}."numberValue" IS NOT NULL THEN cv${index}."numberValue"::text
                ELSE NULL
              END ${direction} NULLS LAST`;
          }
        })
        .join(",\n");

      // Build WHERE clause for filters and search
      let whereConditions = [`r."tableId" = $1`];
      let paramIndex = sorts.length + 2; // Start after tableId and columnIds
      const params: any[] = [tableId, ...sorts.map((s) => s.columnId)];

      // Handle filters with proper SQL generation
      if (filters && filters.length > 0) {
        const filterSubqueries: string[] = [];

        for (const filter of filters) {
          const { columnId, operator, value } = filter;
          let filterCondition = "";

          switch (operator) {
            case "is":
            case "=":
              const numberValue = parseNumber(value);
              if (numberValue !== null) {
                filterCondition = `
                  EXISTS (
                    SELECT 1 FROM "CellValue" cv_filter
                    WHERE cv_filter."rowId" = r.id
                    AND cv_filter."columnId" = $${paramIndex}
                    AND (cv_filter."textValue" = $${paramIndex + 1} OR cv_filter."numberValue" = $${paramIndex + 2})
                  )`;
                params.push(columnId, value ?? "", numberValue);
                paramIndex += 3;
              } else {
                filterCondition = `
                  EXISTS (
                    SELECT 1 FROM "CellValue" cv_filter
                    WHERE cv_filter."rowId" = r.id
                    AND cv_filter."columnId" = $${paramIndex}
                    AND cv_filter."textValue" = $${paramIndex + 1}
                  )`;
                params.push(columnId, value ?? "");
                paramIndex += 2;
              }
              break;

            case "is not":
            case "!=":
              const notNumberValue = parseNumber(value);
              if (notNumberValue !== null) {
                filterCondition = `
                  NOT EXISTS (
                    SELECT 1 FROM "CellValue" cv_filter
                    WHERE cv_filter."rowId" = r.id
                    AND cv_filter."columnId" = $${paramIndex}
                    AND (cv_filter."textValue" = $${paramIndex + 1} OR cv_filter."numberValue" = $${paramIndex + 2})
                  )`;
                params.push(columnId, value ?? "", notNumberValue);
                paramIndex += 3;
              } else {
                filterCondition = `
                  NOT EXISTS (
                    SELECT 1 FROM "CellValue" cv_filter
                    WHERE cv_filter."rowId" = r.id
                    AND cv_filter."columnId" = $${paramIndex}
                    AND cv_filter."textValue" = $${paramIndex + 1}
                  )`;
                params.push(columnId, value ?? "");
                paramIndex += 2;
              }
              break;

            case "contains":
              filterCondition = `
                EXISTS (
                  SELECT 1 FROM "CellValue" cv_filter
                  WHERE cv_filter."rowId" = r.id
                  AND cv_filter."columnId" = $${paramIndex}
                  AND cv_filter."textValue" ILIKE $${paramIndex + 1}
                )`;
              params.push(columnId, `%${value ?? ""}%`);
              paramIndex += 2;
              break;

            case "does not contain":
              filterCondition = `
                NOT EXISTS (
                  SELECT 1 FROM "CellValue" cv_filter
                  WHERE cv_filter."rowId" = r.id
                  AND cv_filter."columnId" = $${paramIndex}
                  AND cv_filter."textValue" ILIKE $${paramIndex + 1}
                )`;
              params.push(columnId, `%${value ?? ""}%`);
              paramIndex += 2;
              break;

            case "is empty":
              filterCondition = `
                EXISTS (
                  SELECT 1 FROM "CellValue" cv_filter
                  WHERE cv_filter."rowId" = r.id
                  AND cv_filter."columnId" = $${paramIndex}
                  AND (
                    (cv_filter."textValue" IS NULL or cv_filter."textValue" = '')
                    AND (cv_filter."numberValue" IS NULL)
                  )
                )`;
              params.push(columnId);
              paramIndex += 1;
              break;

            case "is not empty":
              filterCondition = `
                EXISTS (
                  SELECT 1 FROM "CellValue" cv_filter
                  WHERE cv_filter."rowId" = r.id
                  AND cv_filter."columnId" = $${paramIndex}
                  AND (
                    (cv_filter."textValue" IS NOT NULL AND cv_filter."textValue" != '')
                    OR cv_filter."numberValue" IS NOT NULL
                  )
                )`;
              params.push(columnId);
              paramIndex += 1;
              break;

            case ">":
              const gtValue = parseNumber(value);
              if (gtValue !== null) {
                filterCondition = `
                  EXISTS (
                    SELECT 1 FROM "CellValue" cv_filter
                    WHERE cv_filter."rowId" = r.id
                    AND cv_filter."columnId" = $${paramIndex}
                    AND cv_filter."numberValue" > $${paramIndex + 1}
                  )`;
                params.push(columnId, gtValue);
                paramIndex += 2;
              }
              break;

            case "<":
              const ltValue = parseNumber(value);
              if (ltValue !== null) {
                filterCondition = `
                  EXISTS (
                    SELECT 1 FROM "CellValue" cv_filter
                    WHERE cv_filter."rowId" = r.id
                    AND cv_filter."columnId" = $${paramIndex}
                    AND cv_filter."numberValue" < $${paramIndex + 1}
                  )`;
                params.push(columnId, ltValue);
                paramIndex += 2;
              }
              break;
          }

          if (filterCondition) {
            filterSubqueries.push(filterCondition);
          }
        }

        if (filterSubqueries.length > 0) {
          whereConditions.push(`(${filterSubqueries.join(" AND ")})`);
        }
      }

      // Handle search
      if (search?.trim()) {
        const searchTerm = search.trim();
        const numberSearch = parseNumber(searchTerm);

        // Get all columns for this table to search across them
        const tableColumns = await ctx.db.column.findMany({
          where: { tableId },
          select: { id: true, type: true },
        });

        const searchSubqueries: string[] = [];

        for (const column of tableColumns) {
          if (column.type === "TEXT") {
            searchSubqueries.push(`
                EXISTS (
                  SELECT 1 FROM "CellValue" cv_search
                  WHERE cv_search."rowId" = r.id
                  AND cv_search."columnId" = $${paramIndex}
                  AND cv_search."textValue" ILIKE $${paramIndex + 1}
                )`);
            params.push(column.id, `%${searchTerm}%`);
            paramIndex += 2;
          } else if (column.type === "NUMBER" && numberSearch !== null) {
            searchSubqueries.push(`
                EXISTS (
                  SELECT 1 FROM "CellValue" cv_search
                  WHERE cv_search."rowId" = r.id
                  AND cv_search."columnId" = $${paramIndex}
                  AND cv_search."numberValue" = $${paramIndex + 1}
                )`);
            params.push(column.id, numberSearch);
            paramIndex += 2;
          }
        }

        if (searchSubqueries.length > 0) {
          whereConditions.push(`(${searchSubqueries.join(" OR ")})`);
        }
      }

      const whereClause = `WHERE ${whereConditions.join(" AND ")}`;

      // Pagination for raw SQL: Use cursor if provided, otherwise order by sort columns and createdAt
      let paginationClause = "";
      if (cursor) {
        // For raw SQL with custom sorts, simple id-based cursor can be problematic if not combined with the sort key.
        // For now, we'll use a simple ID-based cursor, but a more robust solution for complex sorts with raw SQL pagination
        // would involve passing the last row's sort values and ID to determine the next page.
        // Given the original raw SQL only used r.id > $cursor, we'll replicate that.
        // A truly robust solution would need to build a dynamic WHERE clause based on the combined sort key and ID.
        // For simplicity and matching original V1 raw SQL behavior:
        whereConditions.push(`r.id > $${paramIndex}`);
        params.push(cursor);
        paramIndex++;
      }

      // Build the complete query
      const query = `
        SELECT r.id, r."createdAt", r."tableId"
        FROM "Row" r
        ${joins}
        ${whereClause}
        ORDER BY
          ${orderClauses},
          r."createdAt" ASC
        LIMIT $${paramIndex}
      `;

      params.push(limit + 1); // +1 to check for next page

      // Execute raw query
      const rawRows = (await ctx.db.$queryRawUnsafe(query, ...params)) as any[];

      // Check if there are more rows
      let nextCursor: string | undefined = undefined;
      if (rawRows.length > limit) {
        const nextRow = rawRows.pop();
        nextCursor = nextRow?.id;
      }

      // Get full row data with cell values
      const rowIds = rawRows.map((row: any) => row.id);

      if (rowIds.length === 0) {
        return { formattedRows: [], nextCursor: undefined };
      }

      const fullRows = await ctx.db.row.findMany({
        where: {
          id: { in: rowIds },
        },
        include: {
          cellValues: {
            include: {
              column: true,
            },
          },
        },
      });

      // Re-order the full rows to match our sorted order
      const rowIdToRowMap = new Map(fullRows.map((row) => [row.id, row]));
      const orderedRows = rowIds.map((id) => rowIdToRowMap.get(id)).filter(Boolean);

      const formattedRows = orderedRows.map((row) => ({
        id: row!.id,
        createdAt: row!.createdAt,
        cellValuesByColumnId: Object.fromEntries(row!.cellValues.map((cell) => [cell.columnId, cell])),
      }));

      return { formattedRows, nextCursor };
    }

    // --- PRISMA PATH (for cases without custom sorting requiring raw SQL) ---
    const cellValuesConditions: any[] = [];

    // FILTERING
    if (filters && filters.length > 0) {
      const filterConditions = filters
        .map(({ columnId, operator, value }) => {
          const createTextCondition = (condition: { contains: string; mode: "insensitive" }) => ({
            columnId,
            textValue: condition,
          });

          const createNumberCondition = (condition: { gt: number } | { lt: number }) => ({
            columnId,
            numberValue: condition,
          });

          switch (operator) {
            case "is":
            case "=":
              const numberValue = parseNumber(value);
              const isCondition = {
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
              const isNotCondition = {
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
                OR: [{ textValue: null }, { textValue: "" }, { numberValue: null }],
              };
            case "is not empty":
              return {
                columnId,
                NOT: {
                  OR: [{ textValue: null }, { textValue: "" }, { numberValue: null }],
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
        cellValuesConditions.push(...filterConditions.map((c) => ({ some: c })));
      }
    }

    // Build the where clause
    let whereClause: any = {
      tableId,
    };

    // Combine filters and search with AND logic
    const conditions: any[] = [];

    // Add filter conditions
    if (cellValuesConditions.length > 0) {
      conditions.push({
        AND: cellValuesConditions.map((c) => ({
          cellValues: c,
        })),
      });
    }

    // Add search conditions with OR logic (search across columns)
    if (search?.trim()) {
      const searchTerm = search.trim();
      const numberSearch = parseNumber(searchTerm);

      // Get all columns for this table to search across them
      const tableColumns = await ctx.db.column.findMany({
        where: { tableId },
        select: { id: true, type: true },
      });

      const searchRowConditions: any[] = [];

      tableColumns.forEach((column) => {
        if (column.type === "TEXT") {
          // Text search
          searchRowConditions.push({
            cellValues: {
              some: {
                columnId: column.id,
                textValue: {
                  contains: searchTerm,
                  mode: "insensitive" as const,
                },
              },
            },
          });
        } else if (column.type === "NUMBER" && numberSearch !== null) {
          // Number search - exact match
          searchRowConditions.push({
            cellValues: {
              some: {
                columnId: column.id,
                numberValue: numberSearch,
              },
            },
          });
        }
      });

      if (searchRowConditions.length > 0) {
        conditions.push({
          OR: searchRowConditions,
        });
      }
    }

    // Apply all conditions
    if (conditions.length > 0) {
      whereClause.AND = conditions;
    }

    const rows = await ctx.db.row.findMany({
      where: whereClause,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), // Correct cursor pagination
      orderBy: { createdAt: "asc" }, // Default sort for Prisma path
      include: {
        cellValues: {
          include: {
            column: true,
          },
        },
      },
    });

    let nextCursor: string | undefined = undefined;
    if (rows.length > limit) {
      const next = rows.pop();
      nextCursor = next?.id;
    }

    return { rows, nextCursor };
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