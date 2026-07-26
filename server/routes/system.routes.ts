import { Router } from "express";
import {
  count,
  sum,
} from "drizzle-orm";
import {
  requireAuth,
  requireRole,
} from "../middleware/auth";
import { sql as sqlRaw } from "../db";
import { storage } from "../storage";

export const systemRoutes = Router();

// System Health Check
systemRoutes.get(
  "/api/system/health",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const healthStart = Date.now();

      // Check database connectivity
      const dbCheck = await sqlRaw`SELECT 1 as check`;
      const dbLatency = Date.now() - healthStart;

      // Get table row counts
      const tableCounts = await sqlRaw`
      SELECT schemaname, relname as table_name, n_live_tup as row_count
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC
    `;

      // Get database size
      const dbSize = await sqlRaw`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `;

      // Get total rows across all tables
      const totalRows = tableCounts.reduce(
        (sum: number, t: any) => sum + parseInt(t.row_count || "0"),
        0,
      );

      // Get index usage stats
      const indexStats = await sqlRaw`
      SELECT count(*) as total_indexes,
             sum(idx_scan) as total_index_scans
      FROM pg_stat_user_indexes
    `;

      // Get dead tuple count (rows needing vacuum)
      const deadTuples = await sqlRaw`
      SELECT sum(n_dead_tup) as total_dead_tuples
      FROM pg_stat_user_tables
    `;

      res.json({
        status: "healthy",
        database: {
          connected: true,
          latency: `${dbLatency}ms`,
          size: dbSize[0]?.size || "Unknown",
          totalTables: tableCounts.length,
          totalRows,
          totalIndexes: parseInt(indexStats[0]?.total_indexes || "0"),
          totalIndexScans: parseInt(indexStats[0]?.total_index_scans || "0"),
          deadTuples: parseInt(deadTuples[0]?.total_dead_tuples || "0"),
        },
        tables: tableCounts.map((t: any) => ({
          name: t.table_name,
          rows: parseInt(t.row_count || "0"),
        })),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Health check error:", error);
      res
        .status(500)
        .json({ status: "unhealthy", error: "Database connection failed" });
    }
  },
);

// Optimize Database
systemRoutes.post(
  "/api/system/optimize",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const startTime = Date.now();

      // Get dead tuples before optimization
      const beforeStats = await sqlRaw`
      SELECT sum(n_dead_tup) as dead_tuples
      FROM pg_stat_user_tables
    `;

      // Run VACUUM ANALYZE on all tables
      await sqlRaw`VACUUM ANALYZE`;

      // Reindex all user tables
      const tables = await sqlRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;

      let reindexedTables = 0;
      for (const table of tables) {
        try {
          await sqlRaw.unsafe(`REINDEX TABLE "${table.tablename}"`);
          reindexedTables++;
        } catch (e) {
          // Some tables may fail to reindex, skip them
        }
      }

      // Get dead tuples after optimization
      const afterStats = await sqlRaw`
      SELECT sum(n_dead_tup) as dead_tuples
      FROM pg_stat_user_tables
    `;

      const duration = Date.now() - startTime;

      res.json({
        success: true,
        duration: `${duration}ms`,
        details: {
          vacuumAnalyze: "Completed",
          tablesReindexed: reindexedTables,
          totalTables: tables.length,
          deadTuplesBefore: parseInt(beforeStats[0]?.dead_tuples || "0"),
          deadTuplesAfter: parseInt(afterStats[0]?.dead_tuples || "0"),
        },
      });
    } catch (error) {
      console.error("Optimize database error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to optimize database" });
    }
  },
);

// Download System Backup (JSON)
systemRoutes.get(
  "/api/system/backup",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const tables = await sqlRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `;

      const backup: Record<string, any[]> = {};
      for (const table of tables) {
        try {
          const rows = await sqlRaw.unsafe(
            `SELECT * FROM "${table.tablename}"`,
          );
          backup[table.tablename] = rows;
        } catch (e) {
          backup[table.tablename] = [];
        }
      }

      const backupData = JSON.stringify(
        {
          version: "1.0.0",
          exportDate: new Date().toISOString(),
          database: "aquanav_erp",
          tables: backup,
        },
        null,
        2,
      );

      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=aquanav_backup_${new Date().toISOString().split("T")[0]}.json`,
      );
      res.send(backupData);
    } catch (error) {
      console.error("Backup error:", error);
      res.status(500).json({ error: "Failed to generate backup" });
    }
  },
);

// Export All Data (CSV format in JSON wrapper)
systemRoutes.get(
  "/api/system/export",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const tables = await sqlRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `;

      const exportData: Record<string, { headers: string[]; rows: any[][] }> =
        {};

      for (const table of tables) {
        try {
          const rows = await sqlRaw.unsafe(
            `SELECT * FROM "${table.tablename}"`,
          );
          if (rows.length > 0) {
            const headers = Object.keys(rows[0]);
            exportData[table.tablename] = {
              headers,
              rows: rows.map((row: any) =>
                headers.map((h) => {
                  const val = row[h];
                  if (val === null || val === undefined) return "";
                  if (val instanceof Date) return val.toISOString();
                  if (typeof val === "object") return JSON.stringify(val);
                  return String(val);
                }),
              ),
            };
          } else {
            exportData[table.tablename] = { headers: [], rows: [] };
          }
        } catch (e) {
          exportData[table.tablename] = { headers: [], rows: [] };
        }
      }

      // Build CSV content for each table
      const csvFiles: Record<string, string> = {};
      for (const [tableName, data] of Object.entries(exportData)) {
        if (data.headers.length === 0) continue;
        const escapeCsv = (val: string) => {
          if (val.includes(",") || val.includes('"') || val.includes("\n")) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        };
        const headerLine = data.headers.map(escapeCsv).join(",");
        const dataLines = data.rows.map((row) =>
          row.map(escapeCsv).join(","),
        );
        csvFiles[tableName] = [headerLine, ...dataLines].join("\n");
      }

      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=aquanav_export_${new Date().toISOString().split("T")[0]}.json`,
      );
      res.json({
        version: "1.0.0",
        exportDate: new Date().toISOString(),
        format: "csv",
        tables: csvFiles,
      });
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ error: "Failed to export data" });
    }
  },
);

// ===========================================================================
// General ledger rebuild (Phase 11)
// ---------------------------------------------------------------------------
// Preview is read-only and safe to call at any time. Execute is destructive:
// it replaces the chart of accounts with the canonical list if it has drifted,
// then deletes and re-posts the ledger from the documents that currently exist.
// Both are admin-only. Storage takes a snapshot of everything it touches first
// and refuses to write a ledger whose debits do not equal its credits.
// ===========================================================================

systemRoutes.post(
  "/api/system/gl-rebuild/preview",
  requireAuth,
  requireRole(["admin"]),
  async (_req, res) => {
    try {
      const [chart, plan, current] = await Promise.all([
        storage.verifyChartOfAccounts(),
        storage.computeLedgerRebuild(),
        sqlRaw`select count(*)::int rows,
                      coalesce(sum(debit_amount),0)::numeric dr,
                      coalesce(sum(credit_amount),0)::numeric cr
               from general_ledger_entries`,
      ]);

      const cur = new Map<string, number>();
      const currentByAccount = (await sqlRaw`
        select account_name, sum(debit_amount - credit_amount)::numeric net
        from general_ledger_entries group by account_name`) as any[];
      for (const r of currentByAccount) cur.set(r.account_name, Number(r.net));

      const accounts = plan.byAccount.map((a: any) => ({
        accountName: a.accountName,
        currentNet: cur.get(a.accountName) ?? 0,
        rebuiltNet: a.net,
        delta: Math.round((a.net - (cur.get(a.accountName) ?? 0)) * 100) / 100,
      }));
      // accounts that exist today but would disappear
      for (const [name, net] of Array.from(cur.entries())) {
        if (!plan.byAccount.some((a: any) => a.accountName === name)) {
          accounts.push({ accountName: name, currentNet: net, rebuiltNet: 0, delta: -net });
        }
      }

      res.json({
        chart: {
          ok: chart.ok,
          missing: chart.missing,
          renamed: chart.renamed,
          unexpected: chart.unexpected,
          willBeReseeded: !chart.ok,
        },
        current: {
          rows: (current as any[])[0].rows,
          debit: Number((current as any[])[0].dr),
          credit: Number((current as any[])[0].cr),
        },
        rebuilt: {
          rows: plan.rows.length,
          debit: plan.totalDebit,
          credit: plan.totalCredit,
          balanced: plan.balanced,
        },
        skipped: plan.skipped,
        accounts: accounts.sort((a: any, b: any) => a.accountName.localeCompare(b.accountName)),
      });
    } catch (error: any) {
      console.error("GL rebuild preview error:", error);
      res.status(500).json({ message: error?.message || "Failed to compute rebuild preview" });
    }
  },
);

systemRoutes.post(
  "/api/system/gl-rebuild/execute",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      // Typed confirmation, so this cannot fire from a stray click.
      if (req.body?.confirm !== "REBUILD LEDGER") {
        return res.status(400).json({
          message:
            'Confirmation required. Send { "confirm": "REBUILD LEDGER" } to proceed.',
        });
      }
      const result = await storage.executeLedgerRebuild(req.session.userId);
      res.json(result);
    } catch (error: any) {
      console.error("GL rebuild error:", error);
      res.status(500).json({ message: error?.message || "Failed to rebuild ledger" });
    }
  },
);
