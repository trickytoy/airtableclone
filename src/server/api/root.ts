import { baseRouter } from "~/server/api/routers/base";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { tableRouter } from "./routers/table";
import { rowRouter } from "./routers/row";
import { columnRouter } from "./routers/column";
import { cellValueRouter } from "./routers/cellValue";
import { utilsRouter } from "./routers/utils";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  base: baseRouter,
  table: tableRouter,
  row: rowRouter,
  column: columnRouter,
  cellValue: cellValueRouter,
  utils: utilsRouter
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
