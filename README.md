# Personal Finance Tracker

<<<<<<< HEAD
## Setup
1. Copy `.env.example` to `.env` and fill in values
2. Run with Docker:
```bash
docker-compose up --build -d
```

## CI/CD
Push to GitHub and deployment will auto-trigger via GitHub Actions.
=======
A Telegram bot-based Personal Finance Tracker built with Node.js that allows users to track expenses, process receipts, and analyze spending habits using intelligent services such as currency conversion, language detection, and location intelligence.

---

## 🚀 Features

- 📊 Add and benchmark expenses via Telegram
- 🧾 OCR & validation for receipts
- 🌍 Automatic currency conversion
- 🌐 Multi-language support
- 📍 Enhanced location-based insights
- 🔐 Secure architecture with middleware
- 🗃️ PostgreSQL database schema with migrations
- 🐳 Dockerized with CI/CD via GitHub Actions

---

## 📁 Project Structure

```
📦PersonalFinanceTracker
 ┣ 📂.github/workflows
 ┃ ┗ 📜deploy.yml
 ┣ 📂config
 ┃ ┣ 📜.env.example
 ┃ ┗ 📜.gitignore
 ┣ 📂scenes
 ┃ ┣ 📜add-expense-scene.js
 ┃ ┣ 📜benchmark-scene.js
 ┃ ┣ 📜receipt-processing-scene.js
 ┃ ┗ 📜settings-scene.js
 ┣ 📂services
 ┃ ┣ 📜backup-service.js
 ┃ ┣ 📜currency-conversion-service.js
 ┃ ┣ 📜cross-language-analytics-service.js
 ┃ ┣ 📜document-source-handler.js
 ┃ ┣ 📜deployment-service.js
 ┃ ┣ 📜enhanced-location-intelligence.js
 ┃ ┣ 📜expense-benchmarking-service.js
 ┃ ┣ 📜language-handling-service.js
 ┃ ┣ 📜product-normalization-service.js
 ┃ ┗ 📜receipt-processor-service.js
 ┣ 📂bot
 ┃ ┣ 📜telegram-bot-implementation.js
 ┃ ┣ 📜telegram-bot-command-handlers.js
 ┃ ┗ 📜admin-handlers.js
 ┣ 📂utils
 ┃ ┣ 📜logger-utility.js
 ┃ ┗ 📜receipt-validator.js
 ┣ 📜app-js.js
 ┣ 📜i18n-service.js
 ┣ 📜Dockerfile
 ┣ 📜docker-compose.yml
 ┣ 📜initial-migration.sql
 ┗ 📜updated-database-schema.sql
```

---

## ⚙️ Requirements

- Node.js
- PostgreSQL
- Docker & Docker Compose
- Telegram Bot Token

---

## 🛠️ Setup

1. **Clone the repo**
```bash
git clone git@github.com:fermeradar/personal-finance-tracker.git
cd personal-finance-tracker
```

2. **Configure environment**
```bash
cp config/.env.example .env
```

3. **Start with Docker**
```bash
docker-compose -f docker-compose.yml up --build
```

---

## 🔐 .env Format

```
TELEGRAM_BOT_TOKEN=your-bot-token
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=personal_finance
DEFAULT_LANGUAGE=en
```

---

## 📦 Deployment (CI/CD)

This project supports auto-deploy via GitHub Actions to a DigitalOcean VPS using SSH keys and GitHub secrets.

```yaml
VPS_SSH_KEY
VPS_HOST
VPS_USER
ENV_FILE
```

---

## 📚 License

MIT License
>>>>>>> a3b27c4 (Push complete local project to GitHub)
