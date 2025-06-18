import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import { faker } from "@faker-js/faker";

export const baseRouter = createTRPCRouter({
  getById: protectedProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ input: { id }, ctx }) => {
    return await ctx.db.base.findUnique({
      where: { id },
    });
  }),
  setLastOpenedTable: protectedProcedure
  .input(z.object({ baseId: z.string(), tableId: z.string() }))
  .mutation(async ({ input: { baseId, tableId }, ctx }) => {
    // Optional: check if user owns the base

    return await ctx.db.base.update({
      where: { id: baseId },
      data: { lastOpenedTableId: tableId },
    });
  }),
  create: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input: { name }, ctx }) => {
      const base = await ctx.db.base.create({
        data: {
          name,
          createdById: ctx.session.user.id,
        },
      });

      // Create default table with faker department name
      const table = await ctx.db.table.create({
        data: {
          name: faker.commerce.department(),
          baseId: base.id,
        },
      });

      await ctx.db.view.create({
        data: {
            tableId: table.id,
            viewName: "Default View",
            viewData: {
              filters: [],
              sortCriteria: [],
              hiddenColumns: []
            }
          },
      })

      await ctx.db.base.update({
        where: { id: base.id },
        data: { lastOpenedTableId: table.id },
      })

    // Create three columns with position ordering
    const nameColumn = await ctx.db.column.create({
      data: {
        name: "Name",
        type: "TEXT",
        position: 1,
        tableId: table.id,
      },
    });

    const notesColumn = await ctx.db.column.create({
      data: {
        name: "Notes",
        type: "TEXT",
        position: 2,
        tableId: table.id,
      },
    });

    const amountColumn = await ctx.db.column.create({
      data: {
        name: "Amount",
        type: "NUMBER",
        position: 3,
        tableId: table.id,
      },
    });

    // Generate 5 sample rows
    const sampleRows = [];
    for (let i = 0; i < 5; i++) {
      const row = await ctx.db.row.create({
        data: {
          tableId: table.id,
        },
      });

      // Create cell values for each column
      await ctx.db.cellValue.createMany({
        data: [
          {
            rowId: row.id,
            columnId: nameColumn.id,
            textValue: faker.person.firstName(),
          },
          {
            rowId: row.id,
            columnId: notesColumn.id,
            textValue: faker.person.lastName(),
          },
          {
            rowId: row.id,
            columnId: amountColumn.id,
            numberValue: parseFloat(faker.finance.amount({ min: 30000, max: 150000 })),
          },
        ],
      });

      sampleRows.push(row);
    }

    return base;
  }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.base.findMany({
      where: {
        createdById: ctx.session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }),

  edit: protectedProcedure
  .input(z.object({ id: z.string(), name: z.string() }))
  .mutation(async ({ input: { id, name }, ctx }) => {
    return await ctx.db.base.update({
      where: { id },
      data: { name },
    });
  }),

delete: protectedProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ input: { id }, ctx }) => {
    // First verify the base belongs to the current user
    const base = await ctx.db.base.findUnique({
      where: { id },
      select: { 
        createdById: true,
        tables: {
          select: {
            id: true,
            columns: {
              select: { id: true }
            },
            rows: {
              select: { id: true }
            }
          }
        }
      },
    });

    if (!base) {
      throw new Error("Base not found");
    }

    if (base.createdById !== ctx.session.user.id) {
      throw new Error("Unauthorized: You can only delete your own bases");
    }

    // Manual cascade delete to handle foreign key constraints
    // 1. Delete all cell values first
    const columnIds = base.tables.flatMap(table => table.columns.map(col => col.id));
    if (columnIds.length > 0) {
      await ctx.db.cellValue.deleteMany({
        where: {
          columnId: { in: columnIds }
        }
      });
    }

    // 2. Delete all rows
    const rowIds = base.tables.flatMap(table => table.rows.map(row => row.id));
    if (rowIds.length > 0) {
      await ctx.db.row.deleteMany({
        where: {
          id: { in: rowIds }
        }
      });
    }

    // 3. Delete all columns
    if (columnIds.length > 0) {
      await ctx.db.column.deleteMany({
        where: {
          id: { in: columnIds }
        }
      });
    }

    // 4. Delete all views
    const tableIds = base.tables.map(table => table.id);
    if (tableIds.length > 0) {
      await ctx.db.view.deleteMany({
        where: {
          tableId: { in: tableIds }
        }
      });
    }

    // 5. Delete all tables
    if (tableIds.length > 0) {
      await ctx.db.table.deleteMany({
        where: {
          id: { in: tableIds }
        }
      });
    }

    // 6. Finally delete the base
    return await ctx.db.base.delete({
      where: { id },
    });
  }),
});
