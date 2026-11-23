import { Client } from "pg";
import * as fs from "fs";
import * as path from "path";

const PG_HOST = process.env.PGHOST || "localhost";
const PG_PORT = parseInt(process.env.PGPORT || "5432", 10);
const PG_USER = process.env.PGUSER || "postgres";
const PG_PASSWORD = process.env.PGPASSWORD || "postgres";

async function runMigration() {
  console.log("=== LabLink 2026 Database Migration Runner ===");
  console.log(`Connecting to PostgreSQL host: ${PG_HOST}:${PG_PORT} as ${PG_USER}`);

  // Step 1: Connect to maintenance db to check / create lablink db
  const maintClient = new Client({
    host: PG_HOST,
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASSWORD,
    database: "postgres",
  });

  try {
    await maintClient.connect();
    const checkDbRes = await maintClient.query(
      "SELECT 1 FROM pg_database WHERE datname = 'lablink';"
    );

    if (checkDbRes.rows.length === 0) {
      console.log("Database 'lablink' does not exist. Creating 'lablink' database...");
      await maintClient.query("CREATE DATABASE lablink;");
      console.log("Database 'lablink' created successfully.");
    } else {
      console.log("Database 'lablink' already exists. Skipping creation.");
    }
  } catch (err: any) {
    console.error("Error checking or creating lablink database:", err.message);
    throw err;
  } finally {
    await maintClient.end();
  }

  // Step 2: Connect to lablink database to run schema migration
  const lablinkClient = new Client({
    host: PG_HOST,
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASSWORD,
    database: "lablink",
  });

  try {
    await lablinkClient.connect();
    console.log("Connected to 'lablink' database. Reading schema.sql...");

    const schemaPath = path.join(__dirname, "../src/lib/db/schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");

    console.log("Executing schema SQL...");
    await lablinkClient.query(schemaSql);
    console.log("Schema SQL executed successfully.");

    // Step 3: Verification of created tables and constraints
    const tablesRes = await lablinkClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log("\nVerified Tables in 'lablink':");
    tablesRes.rows.forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.table_name}`);
    });

    // Verify GiST exclusion constraint on bookings
    const gistRes = await lablinkClient.query(`
      SELECT conname, contype 
      FROM pg_constraint 
      WHERE conname = 'no_overlapping_confirmed_bookings';
    `);

    if (gistRes.rows.length > 0) {
      console.log("\n[VERIFIED] GiST exclusion constraint 'no_overlapping_confirmed_bookings' is active.");
    } else {
      console.warn("\n[WARNING] GiST exclusion constraint 'no_overlapping_confirmed_bookings' not found.");
    }

    console.log("\n=== Migration completed successfully! ===");
  } catch (err: any) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await lablinkClient.end();
  }
}

runMigration().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
