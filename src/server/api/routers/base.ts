import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure
} from "~/server/api/trpc";

export const baseRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input: { name }, ctx }) => {
      const base = await ctx.db.base.create({
        data: {
          name,
          createdById: ctx.session.user.id,
        },
      });

      return base;
    }),

  getAll: protectedProcedure
    .query(async ({ ctx }) => {
      return await ctx.db.base.findMany({
        where: {
          createdById: ctx.session.user.id,
        },
        orderBy: {
          createdAt: "desc", // Optional: newest first
        },
      });
    }),
});
