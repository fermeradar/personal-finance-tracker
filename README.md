# Personal Finance Tracker

## Setup
1. Copy `.env.example` to `.env` and fill in values
2. Run with Docker:
```bash
docker-compose up --build -d
```

## CI/CD
Push to GitHub and deployment will auto-trigger via GitHub Actions.

## Monitoring and Analytics

The application includes comprehensive monitoring and analytics features accessible through the dashboard at `/dashboard`. The dashboard provides real-time insights into application performance, user behavior, and system health.

### Dashboard Features

1. **Overview Tab** (`/dashboard`)
   - System health status
   - Performance metrics (response time, request count, error rate)
   - User analytics (active users, engagement score, retention)
   - Error rates visualization
   - Feature usage statistics

2. **Historical Trends** (`/dashboard#historical`)
   - User engagement trends
   - Performance trends over time
   - Customizable time periods (last 7/30/90 days)
   - Interactive charts with zoom and pan capabilities

3. **Error Analysis** (`/dashboard#errors`)
   - Error trends and patterns
   - Detailed error information
   - Error categorization by type and severity
   - Stack trace analysis

4. **User Behavior** (`/dashboard#user-behavior`)
   - Session analysis
   - Peak usage times
   - Common user flows
   - Feature adoption rates

5. **System Resources** (`/dashboard#system`)
   - Real-time resource usage (CPU, Memory, Disk)
   - Resource usage trends
   - Component health status
   - Performance bottlenecks

### Filtering and Analysis

The dashboard includes powerful filtering capabilities:

1. **Time Period Filters**
   - Last hour
   - Last 24 hours
   - Last 7 days
   - Last 30 days
   - Last 90 days
   - Custom date range

2. **Geographic Filters**
   - North America
   - Europe
   - Asia
   - South America
   - Africa
   - Oceania

3. **User Type Filters**
   - Free users
   - Premium users
   - Enterprise users

4. **Feature Filters**
   - Transactions
   - Budgeting
   - Reports
   - Alerts

### Filter Presets

Common filter combinations are available as presets:

1. **Performance Analysis**
   - Key performance metrics
   - Last 24 hours timeframe
   - Major regions (NA, EU, Asia)

2. **Error Investigation**
   - All error types
   - High and critical severity
   - Last 7 days timeframe

3. **User Engagement**
   - Active users and engagement metrics
   - Premium and enterprise users
   - Core features

4. **System Health**
   - Resource usage metrics
   - Critical components
   - Last 24 hours timeframe

### Data Export

The dashboard supports data export in multiple formats:

1. **Metrics Export** (`/dashboard/api/export/metrics`)
   - CSV format (default)
   - Excel format (with formatting and summary statistics)
   - PDF format (with charts and detailed analysis)
   - JSON format (raw data)

2. **Error Export** (`/dashboard/api/export/errors`)
   - CSV format with detailed error information
   - Includes error type, count, last occurrence, and stack trace

### API Endpoints

The monitoring system exposes several API endpoints:

1. **Metrics API**
   ```http
   GET /dashboard/api/metrics
   ```
   Returns current metrics, health status, and analytics data.

2. **Feature Analytics**
   ```http
   GET /dashboard/api/analytics/features
   ```
   Returns feature usage statistics.

3. **Historical Data**
   ```http
   GET /dashboard/api/analytics/historical?timeframe=daily&days=30
   ```
   Returns historical analytics data with customizable timeframe.

4. **Error Statistics**
   ```http
   GET /dashboard/api/analytics/errors?timeframe=daily&days=7
   ```
   Returns error statistics and analysis.

5. **User Behavior**
   ```http
   GET /dashboard/api/analytics/user-behavior?timeframe=daily&days=30
   ```
   Returns user behavior analytics.

6. **System Resources**
   ```http
   GET /dashboard/api/analytics/system-resources?timeframe=daily&days=7
   ```
   Returns system resource usage data.

### Auto-Refresh

The dashboard automatically refreshes data every 5 minutes to ensure up-to-date information. Manual refresh is also available through the refresh button.

### Security

The dashboard is protected by authentication and authorization mechanisms. Access is restricted to authorized users with appropriate permissions.

## Development Setup

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- Docker & Docker Compose
- Telegram Bot Token

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone git@github.com:fermeradar/personal-finance-tracker.git
   cd personal-finance-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration:
   ```
   TELEGRAM_BOT_TOKEN=your-bot-token
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=yourpassword
   DB_NAME=personal_finance
   DEFAULT_LANGUAGE=en
   ```

4. **Set up database**
   ```bash
   # Start PostgreSQL
   docker-compose up -d postgres

   # Run migrations
   npm run migrate
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

### Running Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/unit/expense-service.test.js

# Run with coverage
npm run test:coverage
```

## API Documentation

### Bot Commands

#### Expense Management
1. **Add Expense**
   ```
   /add <amount> <category> [description]
   ```
   - Adds a new expense
   - Example: `/add 25.50 food Dinner at restaurant`

2. **Add Receipt**
   ```
   /receipt
   ```
   - Initiates receipt processing flow
   - Supports image upload
   - Automatically extracts expense details

3. **View Expenses**
   ```
   /expenses [period]
   ```
   - Lists recent expenses
   - Optional period: today, week, month, year
   - Example: `/expenses month`

4. **Delete Expense**
   ```
   /delete <expense_id>
   ```
   - Removes an expense
   - Example: `/delete 123`

#### Budgeting
1. **Set Budget**
   ```
   /budget <category> <amount> [period]
   ```
   - Sets budget for a category
   - Example: `/budget food 500 month`

2. **View Budgets**
   ```
   /budgets
   ```
   - Shows all active budgets
   - Includes progress and remaining amounts

3. **Delete Budget**
   ```
   /deletebudget <category>
   ```
   - Removes budget for a category
   - Example: `/deletebudget food`

#### Reports
1. **Generate Report**
   ```
   /report [period] [format]
   ```
   - Generates spending report
   - Optional period: week, month, year
   - Optional format: text, csv, pdf
   - Example: `/report month pdf`

2. **Category Analysis**
   ```
   /categories [period]
   ```
   - Shows spending by category
   - Optional period: week, month, year
   - Example: `/categories month`

#### Settings
1. **Change Language**
   ```
   /language <code>
   ```
   - Changes bot interface language
   - Example: `/language es`

2. **Set Currency**
   ```
   /currency <code>
   ```
   - Changes default currency
   - Example: `/currency EUR`

3. **Set Timezone**
   ```
   /timezone <zone>
   ```
   - Sets user's timezone
   - Example: `/timezone America/New_York`

### API Response Formats

#### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation successful"
}
```

#### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": {
      // Additional error details
    }
  }
}
```

### API Response Examples

#### Metrics API Response
```json
{
  "success": true,
  "data": {
    "system": {
      "status": "healthy",
      "uptime": "5d 12h 30m",
      "version": "1.0.0"
    },
    "performance": {
      "responseTime": {
        "current": 150,
        "average": 180,
        "p95": 250,
        "p99": 350
      },
      "requestCount": {
        "total": 12500,
        "success": 12400,
        "error": 100
      },
      "errorRate": 0.8
    },
    "users": {
      "active": 450,
      "total": 1200,
      "new": 25,
      "engagement": {
        "score": 0.85,
        "trend": "up"
      }
    }
  },
  "message": "Metrics retrieved successfully"
}
```

#### Feature Analytics Response
```json
{
  "success": true,
  "data": {
    "features": {
      "expenses": {
        "usage": 850,
        "adoption": 0.75,
        "trend": "up"
      },
      "budgets": {
        "usage": 600,
        "adoption": 0.50,
        "trend": "stable"
      },
      "reports": {
        "usage": 400,
        "adoption": 0.33,
        "trend": "up"
      }
    },
    "topActions": [
      {
        "action": "add_expense",
        "count": 450,
        "percentage": 35
      },
      {
        "action": "view_budget",
        "count": 300,
        "percentage": 25
      },
      {
        "action": "generate_report",
        "count": 200,
        "percentage": 15
      }
    ]
  },
  "message": "Feature analytics retrieved successfully"
}
```

#### Historical Data Response
```json
{
  "success": true,
  "data": {
    "timeframe": "daily",
    "days": 30,
    "metrics": {
      "activeUsers": [
        {
          "date": "2024-03-01",
          "count": 420
        },
        {
          "date": "2024-03-02",
          "count": 450
        }
      ],
      "responseTime": [
        {
          "date": "2024-03-01",
          "average": 180,
          "p95": 250
        },
        {
          "date": "2024-03-02",
          "average": 175,
          "p95": 245
        }
      ],
      "errorRate": [
        {
          "date": "2024-03-01",
          "rate": 0.8
        },
        {
          "date": "2024-03-02",
          "rate": 0.7
        }
      ]
    }
  },
  "message": "Historical data retrieved successfully"
}
```

#### Error Statistics Response
```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 150,
      "critical": 5,
      "high": 20,
      "medium": 75,
      "low": 50
    },
    "errors": [
      {
        "type": "DatabaseConnectionError",
        "count": 25,
        "severity": "high",
        "lastOccurrence": "2024-03-02T15:30:00Z",
        "affectedUsers": 150,
        "stackTrace": "Error: Connection timeout..."
      },
      {
        "type": "ValidationError",
        "count": 45,
        "severity": "medium",
        "lastOccurrence": "2024-03-02T16:15:00Z",
        "affectedUsers": 45,
        "stackTrace": "Error: Invalid input format..."
      }
    ],
    "trends": {
      "daily": [
        {
          "date": "2024-03-01",
          "count": 30
        },
        {
          "date": "2024-03-02",
          "count": 25
        }
      ]
    }
  },
  "message": "Error statistics retrieved successfully"
}
```

## Database Schema

### Tables

#### users
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    language_code VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50),
    default_currency VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### expenses
```sql
CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### budgets
```sql
CREATE TABLE budgets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    category VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    period VARCHAR(20) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### categories
```sql
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name VARCHAR(50) NOT NULL,
    icon VARCHAR(50),
    color VARCHAR(7),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### receipts
```sql
CREATE TABLE receipts (
    id SERIAL PRIMARY KEY,
    expense_id INTEGER REFERENCES expenses(id),
    image_url TEXT NOT NULL,
    processed_data JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes
```sql
-- Users
CREATE INDEX idx_users_telegram_id ON users(telegram_id);

-- Expenses
CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);

-- Budgets
CREATE INDEX idx_budgets_user_id ON budgets(user_id);
CREATE INDEX idx_budgets_category ON budgets(category);
CREATE INDEX idx_budgets_period ON budgets(period);

-- Categories
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_categories_name ON categories(name);

-- Receipts
CREATE INDEX idx_receipts_expense_id ON receipts(expense_id);
CREATE INDEX idx_receipts_status ON receipts(status);
```

### Triggers
```sql
-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at
    BEFORE UPDATE ON budgets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_receipts_updated_at
    BEFORE UPDATE ON receipts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

## Database Migrations

### Migration Setup

1. **Install Migration Tools**
   ```bash
   npm install -g node-pg-migrate
   ```

2. **Create Migration Directory**
   ```bash
   mkdir -p migrations
   ```

### Creating Migrations

1. **Create a New Migration**
   ```bash
   node-pg-migrate create add_user_preferences --migrations-dir migrations
   ```

2. **Migration File Structure**
   ```javascript
   /* migrations/YYYYMMDDHHMMSS_add_user_preferences.js */

   exports.up = (pgm) => {
     pgm.createTable('user_preferences', {
       id: 'id',
       user_id: { type: 'integer', notNull: true, references: 'users' },
       theme: { type: 'varchar(20)', notNull: true, default: 'light' },
       notifications_enabled: { type: 'boolean', notNull: true, default: true },
       created_at: {
         type: 'timestamp with time zone',
         notNull: true,
         default: pgm.func('current_timestamp')
       },
       updated_at: {
         type: 'timestamp with time zone',
         notNull: true,
         default: pgm.func('current_timestamp')
       }
     });

     // Add indexes
     pgm.createIndex('user_preferences', 'user_id');
     pgm.createIndex('user_preferences', 'theme');

     // Add trigger for updated_at
     pgm.createTrigger(
       'user_preferences',
       'update_updated_at',
       {
         when: 'BEFORE',
         operation: 'UPDATE',
         level: 'ROW',
         function: 'update_updated_at_column'
       }
     );
   };

   exports.down = (pgm) => {
     pgm.dropTable('user_preferences');
   };
   ```

### Running Migrations

1. **Apply Migrations**
   ```bash
   # Apply all pending migrations
   node-pg-migrate up

   # Apply specific number of migrations
   node-pg-migrate up 2

   # Apply migrations with custom database URL
   DATABASE_URL=postgres://user:pass@localhost:5432/dbname node-pg-migrate up
   ```

2. **Rollback Migrations**
   ```bash
   # Rollback last migration
   node-pg-migrate down

   # Rollback specific number of migrations
   node-pg-migrate down 2
   ```

3. **Check Migration Status**
   ```bash
   # List all migrations and their status
   node-pg-migrate list
   ```

### Migration Best Practices

1. **Naming Conventions**
   - Use descriptive names: `add_user_preferences`, `create_expenses_table`
   - Include date prefix automatically added by the tool
   - Use snake_case for consistency

2. **Version Control**
   - Always commit migration files to version control
   - Never modify existing migrations
   - Create new migrations for changes

3. **Testing Migrations**
   ```bash
   # Test migration up
   node-pg-migrate up --dry-run

   # Test migration down
   node-pg-migrate down --dry-run
   ```

4. **Production Deployment**
   ```bash
   # Run migrations with logging
   node-pg-migrate up --log-level debug

   # Run migrations in transaction
   node-pg-migrate up --single-transaction
   ```

### Migration Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "migrate:create": "node-pg-migrate create",
    "migrate:up": "node-pg-migrate up",
    "migrate:down": "node-pg-migrate down",
    "migrate:list": "node-pg-migrate list",
    "migrate:test": "node-pg-migrate up --dry-run && node-pg-migrate down --dry-run"
  }
}
```
