import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { faker } from '@faker-js/faker';
import { randomUUID } from 'crypto';



export const utilsRouter = createTRPCRouter({
  deleteAllRowsAndCellsByTable: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { tableId } = input;

      // Step 1: Get all row IDs for the given table
      const rows = await ctx.db.row.findMany({
        where: { tableId },
        select: { id: true },
      });

      const rowIds = rows.map((row) => row.id);
      const BATCH_SIZE = 32767;

      if (rowIds.length === 0) {
        return { deletedRows: 0, deletedCells: 0 };
      }

      let deletedCellsTotal = 0;
      let deletedRowsTotal = 0;

      for (let i = 0; i < rowIds.length; i += BATCH_SIZE) {
        const batch = rowIds.slice(i, i + BATCH_SIZE);
        const deleted = await ctx.db.cellValue.deleteMany({
          where: { rowId: { in: batch } },
        });
        deletedCellsTotal += deleted.count;
      }

      for (let i = 0; i < rowIds.length; i += BATCH_SIZE) {
        const batch = rowIds.slice(i, i + BATCH_SIZE);
        const deleted = await ctx.db.row.deleteMany({
          where: { id: { in: batch } },
        });
        deletedRowsTotal += deleted.count;
      }

      return {
        deletedRows: deletedRowsTotal,
        deletedCells: deletedCellsTotal,
      };
    }),

generateLargeTable: protectedProcedure
  .input(
    z.object({
      tableId: z.string(),
      count: z.number().min(1).max(100000),
      batchSize: z.number().default(50000),
      columns: z.array(
        z.object({
          Column_id: z.string(),
          Column_type: z.string(),
        })
      ),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { tableId, count, batchSize, columns } = input;
    const operationBatchId = randomUUID();

    // Ensure extensions are enabled
    await ctx.db.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    // Pre-generate a pool of names using Faker.js
    // We'll generate a larger pool to ensure enough variety, e.g., 1000 unique names.
    const namePoolSize = count;
    const preGeneratedNames = Array.from({ length: namePoolSize }, () => faker.person.firstName());

    // Convert the JavaScript array to a PostgreSQL array literal string
    // e.g., '{ "John", "Jane", "Mike" }'
    const pgArrayLiteral = `ARRAY[${preGeneratedNames.map(name => `'${name.replace(/'/g, "''")}'`).join(', ')}]`;

    // Build the cell value generation SQL dynamically
    const cellValueSelects = columns
      .map((column) => {
        if (column.Column_type === 'TEXT') {
          return `
          SELECT
            gen_random_uuid() as id,
            r.id as "rowId",
            '${column.Column_id}' as "columnId",
            -- Select a random name from the pre-generated array
            (${pgArrayLiteral})[1 + (abs(hashtext(r.id::text || '${column.Column_id}')) % ${namePoolSize})] as "textValue",
            NULL::numeric as "numberValue",
            NOW() as "createdAt",
            NOW() as "updatedAt"
          FROM rows_cte r`;
        } else {
          return `
          SELECT
            gen_random_uuid() as id,
            r.id as "rowId",
            '${column.Column_id}' as "columnId",
            NULL as "textValue",
            (10 + (abs(hashtext(r.id::text || '${column.Column_id}')) % 90000)::numeric / 100) as "numberValue",
            NOW() as "createdAt",
            NOW() as "updatedAt"
          FROM rows_cte r`;
        }
      })
      .join(' UNION ALL ');

    const massiveQuery = `
      WITH RECURSIVE
      generate_sequence AS (
        SELECT 1 AS i
        UNION ALL
        SELECT i + 1 FROM generate_sequence WHERE i < ${count}
      ),
      rows_cte AS (
        INSERT INTO "Row" (id, "tableId", "batchId", "createdAt")
        SELECT
          gen_random_uuid() as id,
          '${tableId}' as "tableId",
          '${operationBatchId}-batch-' || CEIL(i::numeric / ${batchSize}) as "batchId",
          NOW() as "createdAt"
        FROM generate_sequence
        RETURNING id
      )
      INSERT INTO "CellValue" (id, "rowId", "columnId", "textValue", "numberValue", "createdAt", "updatedAt")
      ${cellValueSelects};
    `;

    // Execute the entire operation in one massive query
    await ctx.db.$executeRawUnsafe(massiveQuery);

    // Calculate batch information
    const batchCount = Math.ceil(count / batchSize);
    const batchIds = Array.from({ length: batchCount }, (_, i) =>
      `${operationBatchId}-batch-${i + 1}`
    );

    return {
      success: true,
      rowsCreated: count,
      operationBatchId,
      batchIds,
      batchCount,
    };
  })
});
