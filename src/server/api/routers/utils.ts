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
      const BATCH_SIZE = 30000;

      if (rowIds.length === 0) {
        return { deletedRows: 0, deletedCells: 0 };
      }

      let deletedCellsTotal = 0;
      let deletedRowsTotal = 0;

      // Step 2: Delete cell values in batches
      for (let i = 0; i < rowIds.length; i += BATCH_SIZE) {
        const batch = rowIds.slice(i, i + BATCH_SIZE);
        const deleted = await ctx.db.cellValue.deleteMany({
          where: { rowId: { in: batch } },
        });
        deletedCellsTotal += deleted.count;
      }

      // Step 3: Delete rows in batches
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
    .input(z.object({ 
      tableId: z.string(), 
      count: z.number().min(1).max(100000),
      batchSize: z.number().min(100).max(50000).optional().default(50000)
    }))
    .mutation(async ({ ctx, input }) => {
      const { tableId, count, batchSize } = input;

      // Generate a unique batch ID for this operation
      const operationBatchId = randomUUID();

      const columns = await ctx.db.column.findMany({
        where: { tableId },
        select: { id: true, type: true },
      });

      if (columns.length === 0) {
        throw new Error("No columns found for this table");
      }

      let created = 0;
      const batchIds: string[] = [];

      while (created < count) {
        const remainingCount = count - created;
        const currentBatchSize = Math.min(batchSize, remainingCount);
        
        // Generate a unique batch ID for each batch
        const currentBatchId = `${operationBatchId}-batch-${Math.floor(created / batchSize) + 1}`;
        batchIds.push(currentBatchId);

        // Create rows with batchId
        const batchRows = Array.from({ length: currentBatchSize }).map(() => ({
          tableId,
          batchId: currentBatchId,
        }));

        await ctx.db.row.createMany({
          data: batchRows,
        });

        // Fetch the newly created rows by batchId (more efficient than ordering by createdAt)
        const newRows = await ctx.db.row.findMany({
          where: {
            tableId,
            batchId: currentBatchId,
          },
          select: { id: true },
        });

        // Generate cell values with appropriate data types
        const cellValuesData = newRows.flatMap((row) =>
          columns.map((col) => {
            const baseData = {
              rowId: row.id,
              columnId: col.id,
              textValue: null as string | null,
              numberValue: null as number | null,
            };

            // Generate appropriate data based on column type
            if (col.type === 'TEXT') {
              baseData.textValue = faker.person.firstName();
            } else if (col.type === 'NUMBER') {
              baseData.numberValue = faker.number.float({ min: 1, max: 1000, fractionDigits: 2 });
            }

            return baseData;
          })
        );

        // Insert cell values in smaller chunks to avoid memory issues
        const cellBatchSize = 5000;
        for (let i = 0; i < cellValuesData.length; i += cellBatchSize) {
          const cellBatch = cellValuesData.slice(i, i + cellBatchSize);
          await ctx.db.cellValue.createMany({
            data: cellBatch,
          });
        }

        created += newRows.length;
      }

      return { 
        success: true, 
        rowsCreated: created,
        operationBatchId,
        batchIds,
        batchCount: batchIds.length
      };
    }),
});
