# ERP Frontend - Sales & Inventory Management System

Modern ERP system built with Next.js 15, TypeScript, Tailwind CSS, and shadcn/ui.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **State Management**: Zustand
- **Data Fetching**: React Query (@tanstack/react-query)
- **Forms**: React Hook Form + Zod
- **i18n**: next-i18next
- **Icons**: Lucide React
- **Charts**: Recharts

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Format code
npm run format
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

```
/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── (auth)/          # Authentication routes
│   │   ├── (dashboard)/     # Main application routes
│   │   ├── layout.tsx       # Root layout
│   │   └── globals.css      # Global styles
│   ├── components/          # Reusable components
│   │   ├── ui/              # shadcn/ui components
│   │   ├── layout/          # Layout components
│   │   └── shared/          # Shared components
│   ├── hooks/               # Custom React hooks
│   ├── stores/              # Zustand stores
│   ├── lib/                 # Utilities and helpers
│   ├── i18n/                # Internationalization
│   └── types/               # TypeScript type definitions
├── public/                  # Static assets
├── supabase/                # Migrations, config, edge functions
├── docs/                    # Project documentation
└── ...config files
```

## Development Workflow

### Phase 1: Foundation (Current)

- ✅ Project setup
- ⏳ Authentication & Layout
- ⏳ Core components library

### Phase 2: Inventory Module

- Item Master
- Warehouse Management
- Stock Transactions
- Reorder Management

### Phase 3: Sales Module

- Customer Master
- Sales Orders
- Delivery Notes
- Invoices
- Payments

## Features

- 🌐 Multi-language support
- 💱 Multi-currency support
- 🌓 Dark mode
- 📱 Responsive design
- ♿ Accessibility (WCAG 2.1)
- 🔐 Role-based access control
- 📊 Real-time analytics
- 🎨 Modern UI with shadcn/ui

## Contributing

Please refer to the main project documentation for contribution guidelines.

## License

Private - All rights reserved
