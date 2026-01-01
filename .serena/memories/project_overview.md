# Ettus SDR Web Application

## Purpose
A web-based control interface for Ettus B210 Software Defined Radio (SDR) hardware. Provides real-time spectrum visualization, device control, frequency scanning, recording capabilities, and AI-assisted signal analysis.

## Tech Stack
- **Frontend**: React 19, TypeScript, Tailwind CSS 4, Vite 7
- **Backend**: Express 4, tRPC 11, Node.js
- **Database**: MySQL/TiDB with Drizzle ORM
- **UI Components**: Radix UI, shadcn/ui
- **State Management**: TanStack Query (React Query)
- **Real-time**: WebSocket for FFT streaming
- **Testing**: Vitest

## Key Features
- WebGL waterfall spectrum display
- Real-time FFT streaming via WebSocket
- Device configuration (frequency, gain, sample rate)
- Frequency scanner with signal detection
- SigMF recording system
- AI-assisted spectrum analysis
- Frequency bookmarks

## Architecture
- Monorepo structure with client/ and server/ directories
- tRPC for type-safe API communication
- Drizzle ORM for database operations
- Hardware abstraction layer (demo mode vs production)