Act as an expert full-stack developer. We are building a personal finance web application that tracks expenses (via an Apple Pay iOS Shortcut webhook), automatically allocates salary to savings goals (épargne), and tracks investment portfolios.

TECH STACK:

- Framework: Next.js (App Router) with TypeScript
- Styling: Tailwind CSS
- Database/ORM: Prisma with SQLite (for easy local setup)
- UI Components: shadcn/ui (or basic Tailwind if easier)

INFO:

- for the usage of the node you can use nvm use command to switch to the correct version
- For the database, you can use SQLite for simplicity, and Prisma will handle the schema and migrations.

Please execute the following steps in order, providing the terminal commands and the exact code for each file:

STEP 1: DATABASE SCHEMA
Generate the `schema.prisma` file with the following models:

- Account: id, name, type (checking, savings, investment), balance
- Category: id, name, type (income, expense, transfer)
- Transaction: id, accountId, categoryId, merchant, amount, date
- SavingsGoal: id, name, targetAmount, currentAmount, autoAllocatePct
- PortfolioAsset: id, accountId, tickerSymbol, sharesOwned, averageBuyPrice

STEP 2: APPLE PAY WEBHOOK (Expense Tracker)
Create a Next.js API route at `app/api/webhook/apple-pay/route.ts` that:

- Accepts a POST request with JSON: { "merchant": string, "amount": number, "date": string }
- Finds the "Main Checking" account and "Uncategorized" category (creates them if they don't exist).
- Creates a new Transaction with a negative amount.
- Decrements the checking account balance.

STEP 3: SALARY ALLOCATOR ENGINE
Create a Next.js API route at `app/api/webhook/salary/route.ts` that:

- Accepts a POST request: { "amount": number }
- Adds the amount to the "Main Checking" account balance.
- Queries all `SavingsGoal` records.
- Loops through the goals, calculates the allocation based on `autoAllocatePct`, and updates each goal's `currentAmount`.

STEP 4: DASHBOARD UI
Create the main dashboard page at `app/page.tsx` that:

- Fetches the total checking balance, total savings locked, and calculates the "Safe to Spend" amount (Checking Balance - Total Savings).
- Displays a clean, mobile-responsive summary dashboard using Tailwind CSS.

Start by giving me the terminal commands to initialize the Next.js project and install Prisma, then provide the code for Steps 1 through 4.
