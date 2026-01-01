# Development Commands

## Start Development Server
```bash
pnpm dev
```
Starts the development server with hot reload on http://localhost:3000

## Run Tests
```bash
pnpm test
# or for watch mode
npx vitest
```

## Type Check
```bash
pnpm check
# or
npx tsc --noEmit
```

## Format Code
```bash
pnpm format
```

## Database Operations
```bash
# Push schema changes to database
pnpm db:push
```

## Build for Production
```bash
pnpm build
pnpm start
```

## Useful System Commands
```bash
# Find files
find . -name "*.ts" -type f

# Search in files
grep -r "pattern" --include="*.ts"

# Check server logs
tail -f /tmp/server.log
```