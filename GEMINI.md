# AI DEVELOPMENT PROTOCOL: TANGER WEALTH OS

Always follow these rules when writing code for this Next.js project:

## 1. GLOBAL STYLING (Wealth OS Aesthetic)
- **Background**: `bg-[#131b2c]` (Deep Navy).
- **Containers/Cards**: `bg-[#1b253b]` with `border border-slate-700 rounded-xl`.
- **Text Palette**: 
  - `text-slate-200` (Primary)
  - `text-slate-400` (Secondary)
  - `text-slate-500` (Muted/labels)
- **Accents**: 
  - `text-blue-400` for primary actions
  - `text-emerald-400` for positive/income
  - `text-red-400` for negative/expenses

## 2. COMPONENT ARCHITECTURE
- **Iconography**: Always prioritize `lucide-react`.
- **Visualizations**: Use `recharts` for all data visualizations (ResponsiveContainer, PieChart/AreaChart).
- **Interactive Inputs**: Must use dark theme: `bg-[#131b2c] border border-slate-700 text-slate-200 p-2.5 rounded-lg`.

## 3. DATA & BACKEND (Prisma/API)
- **Error Handling**: Always include explicit `try/catch` blocks in API routes.
- **Typing**: Database operations must be typed. Ensure `PrismaClient` is instantiated correctly.
- **Response Structure**: API responses must follow: `{ success: boolean, data?: any, error?: string }`.

## 4. DEVELOPMENT CONSTRAINTS
- **File Organization**: 
  - UI components in `app/components/`
  - Pages in `app/`
  - API logic in `app/api/`
- **Component Types**: Use `'use client'` strictly for components requiring hooks. Keep pages as Server Components whenever possible.
- **Models**: Do not hallucinate database models. Ask before adding new fields to `schema.prisma`.
