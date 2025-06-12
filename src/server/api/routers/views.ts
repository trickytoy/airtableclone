import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const viewRouter = createTRPCRouter({
  // Route to create a new view
  create: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        viewName: z.string(),
        filters: z.array(
          z.object({
            id: z.string(),
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
            value: z.string(),
          })
        ),
        sortCriteria: z.array(
          z.object({
            id: z.string(),
            columnId: z.string(),
            direction: z.enum(["asc", "desc"]),
          })
        ),
        hiddenColumns: z.array(z.string()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const viewData = {
        filters: input.filters,
        sortCriteria: input.sortCriteria,
        hiddenColumns: input.hiddenColumns,
      };

      const newView = await ctx.db.view.create({
        data: {
          tableId: input.tableId,
          viewName: input.viewName,
          viewData: viewData,
        },
      });

      // Transform the response to match your component's expected type
      return {
        id: newView.id,
        viewName: newView.viewName,
        viewData: viewData, // Use the original viewData object instead of the JsonValue
        createdAt: newView.createdAt.toISOString(),
        updatedAt: newView.updatedAt.toISOString(),
      };
    }),

  // Route to get all views for a specific table
  getAllForTable: protectedProcedure
    .input(z.string()) // tableId
    .query(async ({ input, ctx }) => {
      const views = await ctx.db.view.findMany({
        where: {
          tableId: input, // tableId matches the passed tableId
        },
      });

      // Transform the response to match your component's expected type
      return views.map(view => ({
        id: view.id,
        viewName: view.viewName,
        viewData: view.viewData as {
          filters: Array<{
            id: string;
            columnId: string;
            operator: "is" | "is not" | "contains" | "does not contain" | "is empty" | "is not empty" | "=" | "!=" | ">" | "<";
            value: string;
          }>;
          sortCriteria: Array<{
            id: string;
            columnId: string;
            direction: "asc" | "desc";
          }>;
          hiddenColumns: string[];
        },
        createdAt: view.createdAt.toISOString(),
        updatedAt: view.updatedAt.toISOString(),
      }));
    }),
});