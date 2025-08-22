import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

interface QueryPerformanceMetrics {
  query: string;
  calls: number;
  totalTime: number;
  meanTime: number;
  minTime: number;
  maxTime: number;
}

export interface DatabaseMetrics {
  connectionCount: number;
  activeConnections: number;
  idleConnections: number;
  slowQueries: QueryPerformanceMetrics[];
  indexUsage: any[];
  tableStats: any[];
}

@Injectable()
export class DatabasePerformanceService {
  private readonly logger = new Logger(DatabasePerformanceService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get current database performance metrics
   */
  async getDatabaseMetrics(): Promise<DatabaseMetrics> {
    try {
      const [
        connectionStats,
        slowQueries,
        indexUsage,
        tableStats,
      ] = await Promise.all([
        this.getConnectionStats(),
        this.getSlowQueries(),
        this.getIndexUsage(),
        this.getTableStats(),
      ]);

      return {
        connectionCount: connectionStats.total,
        activeConnections: connectionStats.active,
        idleConnections: connectionStats.idle,
        slowQueries,
        indexUsage,
        tableStats,
      };
    } catch (error) {
      this.logger.error('Failed to get database metrics', error);
      throw error;
    }
  }

  /**
   * Get connection pool statistics
   */
  private async getConnectionStats(): Promise<{
    total: number;
    active: number;
    idle: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE state = 'active') as active,
        COUNT(*) FILTER (WHERE state = 'idle') as idle
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `;

    const result = await this.dataSource.query(query);
    return {
      total: parseInt(result[0]?.total || '0'),
      active: parseInt(result[0]?.active || '0'),
      idle: parseInt(result[0]?.idle || '0'),
    };
  }

  /**
   * Get slow query statistics
   */
  private async getSlowQueries(limit: number = 10): Promise<QueryPerformanceMetrics[]> {
    // Enable pg_stat_statements extension if available
    try {
      await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS pg_stat_statements');
    } catch (error) {
      this.logger.warn('pg_stat_statements extension not available');
      return [];
    }

    const query = `
      SELECT 
        query,
        calls,
        total_exec_time as total_time,
        mean_exec_time as mean_time,
        min_exec_time as min_time,
        max_exec_time as max_time
      FROM pg_stat_statements 
      WHERE query NOT LIKE '%pg_stat_statements%'
        AND query NOT LIKE '%information_schema%'
      ORDER BY mean_exec_time DESC 
      LIMIT $1
    `;

    try {
      const results = await this.dataSource.query(query, [limit]);
      return results.map((row: any) => ({
        query: row.query.substring(0, 200) + (row.query.length > 200 ? '...' : ''),
        calls: parseInt(row.calls),
        totalTime: parseFloat(row.total_time),
        meanTime: parseFloat(row.mean_time),
        minTime: parseFloat(row.min_time),
        maxTime: parseFloat(row.max_time),
      }));
    } catch (error) {
      this.logger.warn('Failed to get slow queries', error);
      return [];
    }
  }

  /**
   * Get index usage statistics
   */
  private async getIndexUsage(): Promise<any[]> {
    const query = `
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch
      FROM pg_stat_user_indexes 
      WHERE schemaname = 'public'
      ORDER BY idx_scan DESC
    `;

    try {
      return await this.dataSource.query(query);
    } catch (error) {
      this.logger.warn('Failed to get index usage', error);
      return [];
    }
  }

  /**
   * Get table statistics
   */
  private async getTableStats(): Promise<any[]> {
    const query = `
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_tuples,
        n_dead_tup as dead_tuples,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze
      FROM pg_stat_user_tables 
      WHERE schemaname = 'public'
      ORDER BY n_live_tup DESC
    `;

    try {
      return await this.dataSource.query(query);
    } catch (error) {
      this.logger.warn('Failed to get table stats', error);
      return [];
    }
  }

  /**
   * Analyze query performance for a specific query
   */
  async analyzeQuery(query: string, params?: any[]): Promise<any> {
    try {
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
      const result = await this.dataSource.query(explainQuery, params);
      return result[0]['QUERY PLAN'][0];
    } catch (error) {
      this.logger.error('Failed to analyze query', error);
      throw error;
    }
  }

  /**
   * Get database size information
   */
  async getDatabaseSize(): Promise<{
    databaseSize: string;
    tablesSizes: Array<{ tableName: string; size: string; rowCount: number }>;
  }> {
    // Get database size
    const dbSizeQuery = `
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `;
    const dbSizeResult = await this.dataSource.query(dbSizeQuery);

    // Get table sizes
    const tableSizesQuery = `
      SELECT 
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        n_live_tup as row_count
      FROM pg_stat_user_tables 
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `;
    const tableSizesResult = await this.dataSource.query(tableSizesQuery);

    return {
      databaseSize: dbSizeResult[0]?.size || '0 bytes',
      tablesSizes: tableSizesResult.map((row: any) => ({
        tableName: row.tablename,
        size: row.size,
        rowCount: parseInt(row.row_count || '0'),
      })),
    };
  }

  /**
   * Optimize database performance by updating statistics
   */
  async optimizeDatabase(): Promise<void> {
    try {
      this.logger.log('Starting database optimization...');

      // Update table statistics
      await this.dataSource.query('ANALYZE');

      // Vacuum analyze for better performance
      const tables = ['users', 'conversations', 'messages', 'participants'];
      
      for (const table of tables) {
        await this.dataSource.query(`VACUUM ANALYZE ${table}`);
        this.logger.log(`Optimized table: ${table}`);
      }

      this.logger.log('Database optimization completed');
    } catch (error) {
      this.logger.error('Database optimization failed', error);
      throw error;
    }
  }

  /**
   * Check for missing indexes based on query patterns
   */
  async checkMissingIndexes(): Promise<string[]> {
    const suggestions: string[] = [];

    try {
      // Check for sequential scans on large tables
      const seqScanQuery = `
        SELECT 
          schemaname,
          tablename,
          seq_scan,
          seq_tup_read,
          n_live_tup,
          CASE 
            WHEN seq_scan > 0 AND n_live_tup > 10000 
            THEN seq_tup_read / seq_scan 
            ELSE 0 
          END as avg_seq_read
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
          AND seq_scan > 100
          AND n_live_tup > 10000
        ORDER BY avg_seq_read DESC
      `;

      const seqScanResults = await this.dataSource.query(seqScanQuery);
      
      seqScanResults.forEach((row: any) => {
        if (row.avg_seq_read > 1000) {
          suggestions.push(
            `Consider adding indexes to table '${row.tablename}' - high sequential scan ratio (${Math.round(row.avg_seq_read)} avg rows per scan)`
          );
        }
      });

      // Check for unused indexes
      const unusedIndexQuery = `
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
          AND idx_scan < 10
        ORDER BY idx_scan
      `;

      const unusedIndexResults = await this.dataSource.query(unusedIndexQuery);
      
      unusedIndexResults.forEach((row: any) => {
        if (row.idx_scan === 0) {
          suggestions.push(
            `Consider dropping unused index '${row.indexname}' on table '${row.tablename}'`
          );
        }
      });

    } catch (error) {
      this.logger.warn('Failed to check for missing indexes', error);
    }

    return suggestions;
  }

  /**
   * Scheduled task to monitor database performance
   */
  @Cron(CronExpression.EVERY_HOUR)
  async monitorPerformance(): Promise<void> {
    try {
      const metrics = await this.getDatabaseMetrics();
      
      // Log warnings for performance issues
      if (metrics.activeConnections > 15) {
        this.logger.warn(`High number of active connections: ${metrics.activeConnections}`);
      }

      if (metrics.slowQueries.length > 0) {
        this.logger.warn(`Found ${metrics.slowQueries.length} slow queries`);
        metrics.slowQueries.forEach((query, index) => {
          if (query.meanTime > 1000) { // More than 1 second
            this.logger.warn(`Slow query ${index + 1}: ${query.meanTime.toFixed(2)}ms avg - ${query.query}`);
          }
        });
      }

      // Check for missing indexes
      const indexSuggestions = await this.checkMissingIndexes();
      if (indexSuggestions.length > 0) {
        this.logger.warn('Index optimization suggestions:');
        indexSuggestions.forEach(suggestion => {
          this.logger.warn(`- ${suggestion}`);
        });
      }

    } catch (error) {
      this.logger.error('Performance monitoring failed', error);
    }
  }

  /**
   * Scheduled task to optimize database (runs daily)
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledOptimization(): Promise<void> {
    try {
      await this.optimizeDatabase();
    } catch (error) {
      this.logger.error('Scheduled optimization failed', error);
    }
  }
}