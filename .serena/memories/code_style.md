# Code Style and Conventions

## TypeScript
- Strict TypeScript with noEmit checks
- Use type inference where possible
- Explicit return types for exported functions
- Use Zod for runtime validation

## React Components
- Functional components with hooks
- Use shadcn/ui components from @/components/ui/*
- Tailwind CSS for styling
- Props interfaces defined inline or separately

## Naming Conventions
- PascalCase for components and types
- camelCase for functions and variables
- kebab-case for file names (except components)
- Router files: *-router.ts
- Test files: *.test.ts

## tRPC Procedures
- Use publicProcedure for unauthenticated endpoints
- Use protectedProcedure for authenticated endpoints
- Input validation with Zod schemas
- Return typed responses

## Database
- Drizzle ORM with MySQL
- Schema in drizzle/schema.ts
- Use bigint for large numbers (frequencies, file sizes)
- Timestamps in UTC

## Testing
- Vitest for unit tests
- Mock external dependencies
- Test files alongside source files