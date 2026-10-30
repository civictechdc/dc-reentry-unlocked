/**
 * Public surface of the API app: the factory that builds a ready Fastify
 * instance and the data source seam it serves from. `server.ts` wires
 * environment configuration around these when booting a real server.
 */
export { buildApp, type HousingApi, type HousingApiOptions } from "./app";
export {
  createMemoryHousingUnitsSource,
  createDatasetHousingUnitsSource,
  defaultDatasetPath,
  matchesFilterSelection,
  type HousingUnitsSource,
  type FilterSelection,
} from "./datasource";
