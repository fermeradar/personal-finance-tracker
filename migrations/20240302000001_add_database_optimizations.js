exports.up = (pgm) => {
  // Create partitioned tables for time-series data
  pgm.createTable('request_logs_partitioned', {
    id: 'id',
    timestamp: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    method: { type: 'varchar(10)', notNull: true },
    path: { type: 'varchar(255)', notNull: true },
    status_code: { type: 'integer', notNull: true },
    response_time: { type: 'integer', notNull: true },
    user_id: { type: 'integer', references: 'users' },
    ip_address: { type: 'varchar(45)' },
    user_agent: { type: 'varchar(255)' }
  }, {
    partitionBy: 'RANGE (timestamp)'
  });

  // Create partitions for request_logs
  pgm.sql(`
    CREATE TABLE request_logs_y2024m01 PARTITION OF request_logs_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
    
    CREATE TABLE request_logs_y2024m02 PARTITION OF request_logs_partitioned
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
    
    CREATE TABLE request_logs_y2024m03 PARTITION OF request_logs_partitioned
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
    
    CREATE TABLE request_logs_future PARTITION OF request_logs_partitioned
    FOR VALUES FROM ('2024-04-01') TO (MAXVALUE);
  `);

  // Create materialized views for frequently accessed aggregated data
  pgm.sql(`
    CREATE MATERIALIZED VIEW daily_metrics AS
    SELECT 
      DATE_TRUNC('day', timestamp) as date,
      COUNT(*) as total_requests,
      AVG(response_time) as avg_response_time,
      COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
      COUNT(DISTINCT user_id) as unique_users
    FROM request_logs
    GROUP BY DATE_TRUNC('day', timestamp)
    WITH DATA;

    CREATE MATERIALIZED VIEW hourly_error_stats AS
    SELECT 
      DATE_TRUNC('hour', timestamp) as hour,
      error_type,
      COUNT(*) as count,
      MAX(severity) as max_severity
    FROM error_logs
    GROUP BY DATE_TRUNC('hour', timestamp), error_type
    WITH DATA;
  `);

  // Create indexes on materialized views
  pgm.createIndex('daily_metrics', 'date');
  pgm.createIndex('hourly_error_stats', 'hour');
  pgm.createIndex('hourly_error_stats', 'error_type');

  // Add partial indexes for common queries
  pgm.createIndex('request_logs', 'timestamp', {
    where: 'status_code >= 400',
    name: 'idx_error_requests'
  });

  pgm.createIndex('request_logs', 'response_time', {
    where: 'response_time > 1000',
    name: 'idx_slow_requests'
  });

  // Add GiST index for path pattern matching
  pgm.createIndex('request_logs', 'path', {
    using: 'gist',
    operator: 'gist_trgm_ops',
    name: 'idx_path_pattern'
  });

  // Create function for automatic partition creation
  pgm.sql(`
    CREATE OR REPLACE FUNCTION create_request_logs_partition()
    RETURNS void AS $$
    DECLARE
      next_month date;
      partition_name text;
    BEGIN
      next_month := date_trunc('month', now() + interval '1 month');
      partition_name := 'request_logs_y' || to_char(next_month, 'YYYYmMM');
      
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF request_logs_partitioned
         FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        next_month,
        next_month + interval '1 month'
      );
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Create function for materialized view refresh
  pgm.sql(`
    CREATE OR REPLACE FUNCTION refresh_daily_metrics()
    RETURNS void AS $$
    BEGIN
      REFRESH MATERIALIZED VIEW CONCURRENTLY daily_metrics;
      REFRESH MATERIALIZED VIEW CONCURRENTLY hourly_error_stats;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Create scheduled job for partition creation
  pgm.sql(`
    SELECT cron.schedule('0 0 1 * *', $$
      SELECT create_request_logs_partition();
    $$);
  `);

  // Create scheduled job for materialized view refresh
  pgm.sql(`
    SELECT cron.schedule('0 * * * *', $$
      SELECT refresh_daily_metrics();
    $$);
  `);

  // Add table statistics
  pgm.sql(`
    ANALYZE request_logs;
    ANALYZE error_logs;
    ANALYZE user_sessions;
    ANALYZE system_metrics;
  `);

  // Create function for data archival
  pgm.sql(`
    CREATE OR REPLACE FUNCTION archive_old_request_logs(months_old integer)
    RETURNS void AS $$
    BEGIN
      INSERT INTO request_logs_archive
      SELECT *
      FROM request_logs
      WHERE timestamp < NOW() - (months_old || ' months')::interval;
      
      DELETE FROM request_logs
      WHERE timestamp < NOW() - (months_old || ' months')::interval;
    END;
    $$ LANGUAGE plpgsql;
  `);
};

exports.down = (pgm) => {
  // Drop scheduled jobs
  pgm.sql(`
    SELECT cron.unschedule('0 0 1 * *');
    SELECT cron.unschedule('0 * * * *');
  `);

  // Drop functions
  pgm.sql(`
    DROP FUNCTION IF EXISTS create_request_logs_partition();
    DROP FUNCTION IF EXISTS refresh_daily_metrics();
    DROP FUNCTION IF EXISTS archive_old_request_logs(integer);
  `);

  // Drop materialized views
  pgm.sql(`
    DROP MATERIALIZED VIEW IF EXISTS daily_metrics;
    DROP MATERIALIZED VIEW IF EXISTS hourly_error_stats;
  `);

  // Drop partitioned table and its partitions
  pgm.dropTable('request_logs_partitioned', { cascade: true });

  // Drop additional indexes
  pgm.dropIndex('request_logs', 'idx_error_requests');
  pgm.dropIndex('request_logs', 'idx_slow_requests');
  pgm.dropIndex('request_logs', 'idx_path_pattern');
}; 