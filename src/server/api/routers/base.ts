import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";

export const baseRouter = createTRPCRouter({
  getById: protectedProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ input: { id }, ctx }) => {
    return await ctx.db.base.findUnique({
      where: { id },
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
    return await ctx.db.base.delete({
      where: { id },
    });
  }),
});
