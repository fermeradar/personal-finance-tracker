exports.up = (pgm) => {
  // Create request_logs table
  pgm.createTable('request_logs', {
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
  });

  // Create user_sessions table
  pgm.createTable('user_sessions', {
    id: 'id',
    user_id: { type: 'integer', notNull: true, references: 'users' },
    timestamp: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    session_duration: { type: 'integer', notNull: true },
    actions_count: { type: 'integer', notNull: true, default: 0 }
  });

  // Create error_logs table
  pgm.createTable('error_logs', {
    id: 'id',
    timestamp: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    error_type: { type: 'varchar(100)', notNull: true },
    message: { type: 'text', notNull: true },
    stack_trace: { type: 'text' },
    severity: { 
      type: 'varchar(20)', 
      notNull: true,
      check: "severity IN ('low', 'medium', 'high', 'critical')"
    },
    user_id: { type: 'integer', references: 'users' },
    request_id: { type: 'varchar(100)' }
  });

  // Create system_metrics table
  pgm.createTable('system_metrics', {
    id: 'id',
    timestamp: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    cpu_usage: { type: 'float', notNull: true },
    memory_usage: { type: 'float', notNull: true },
    disk_usage: { type: 'float', notNull: true },
    active_connections: { type: 'integer', notNull: true }
  });

  // Add indexes
  pgm.createIndex('request_logs', 'timestamp');
  pgm.createIndex('request_logs', 'user_id');
  pgm.createIndex('request_logs', 'status_code');
  
  pgm.createIndex('user_sessions', 'timestamp');
  pgm.createIndex('user_sessions', 'user_id');
  
  pgm.createIndex('error_logs', 'timestamp');
  pgm.createIndex('error_logs', 'severity');
  pgm.createIndex('error_logs', 'user_id');
  
  pgm.createIndex('system_metrics', 'timestamp');

  // Add triggers for updated_at
  pgm.createTrigger(
    'request_logs',
    'update_request_logs_timestamp',
    {
      when: 'BEFORE',
      operation: 'UPDATE',
      level: 'ROW',
      function: 'update_updated_at_column'
    }
  );

  pgm.createTrigger(
    'user_sessions',
    'update_user_sessions_timestamp',
    {
      when: 'BEFORE',
      operation: 'UPDATE',
      level: 'ROW',
      function: 'update_updated_at_column'
    }
  );

  pgm.createTrigger(
    'error_logs',
    'update_error_logs_timestamp',
    {
      when: 'BEFORE',
      operation: 'UPDATE',
      level: 'ROW',
      function: 'update_updated_at_column'
    }
  );

  pgm.createTrigger(
    'system_metrics',
    'update_system_metrics_timestamp',
    {
      when: 'BEFORE',
      operation: 'UPDATE',
      level: 'ROW',
      function: 'update_updated_at_column'
    }
  );
};

exports.down = (pgm) => {
  pgm.dropTable('system_metrics');
  pgm.dropTable('error_logs');
  pgm.dropTable('user_sessions');
  pgm.dropTable('request_logs');
}; 