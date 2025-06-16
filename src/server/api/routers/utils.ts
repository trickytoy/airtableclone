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
            Column_type: z.string()
          })
        )
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { tableId, count, batchSize, columns } = input;
      const operationBatchId = randomUUID();

      // Ensure extensions are enabled
      await ctx.db.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

      // Single massive query that generates everything in PostgreSQL
      const textColumns = columns.filter(col => col.Column_type === 'TEXT');
      const numberColumns = columns.filter(col => col.Column_type === 'NUMBER');

      // Build the cell value generation SQL dynamically
      const cellValueSelects = columns.map(column => {
        if (column.Column_type === 'TEXT') {
          return `
          SELECT 
            gen_random_uuid() as id,
            r.id as "rowId",
            '${column.Column_id}' as "columnId",
            (ARRAY['John', 'Jane', 'Mike', 'Sarah', 'David', 'Lisa', 'Tom', 'Anna', 'Chris', 'Emma', 
                  'James', 'Mary', 'Robert', 'Patricia', 'Michael', 'Jennifer', 'William', 'Linda',
                  'Richard', 'Elizabeth', 'Joseph', 'Barbara', 'Thomas', 'Susan', 'Charles', 'Jessica',
                  'Christopher', 'Karen', 'Daniel', 'Nancy', 'Matthew', 'Betty', 'Anthony', 'Helen',
                  'Mark', 'Sandra', 'Donald', 'Donna', 'Steven', 'Carol', 'Paul', 'Ruth', 'Andrew', 'Sharon',
                  'Joshua', 'Michelle', 'Kenneth', 'Laura', 'Kevin', 'Sarah', 'Brian', 'Kimberly', 'George', 'Deborah',
                  'Timothy', 'Dorothy', 'Ronald', 'Lisa', 'Jason', 'Nancy', 'Edward', 'Karen', 'Jeffrey', 'Betty',
                  'Ryan', 'Helen', 'Jacob', 'Sandra', 'Gary', 'Donna', 'Nicholas', 'Carol', 'Eric', 'Ruth',
                  'Jonathan', 'Sharon', 'Stephen', 'Michelle', 'Larry', 'Laura', 'Justin', 'Sarah', 'Scott', 'Kimberly',
                  'Brandon', 'Deborah', 'Benjamin', 'Dorothy', 'Samuel', 'Amy', 'Gregory', 'Angela', 'Alexander', 'Ashley',
                  'Frank', 'Brenda', 'Raymond', 'Emma', 'Jack', 'Olivia', 'Dennis', 'Cynthia', 'Jerry', 'Marie'])[
              1 + (abs(hashtext(r.id::text || '${column.Column_id}')) % 100)
            ] as "textValue",
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
      }).join(' UNION ALL ');

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
