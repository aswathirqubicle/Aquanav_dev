import * as dotenv from "dotenv";
dotenv.config();
 
console.log("ENV TEST:", process.env.DATABASE_URL);
 
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../shared/schema';
 
const connectionString = process.env.DATABASE_URL || process.env.REPLIT_DB_URL!;
 
// Create the connection
export const sql = postgres(connectionString);
export const db = drizzle(sql, { schema });