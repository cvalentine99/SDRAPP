# Ettus SDR Web - Refactoring Audit Report

## Executive Summary

Comprehensive analysis of frontend-backend architecture identifying key refactoring opportunities for improved maintainability, consistency, and code quality.

---

## Backend Analysis

### Router Structure

**Current State:**
- 6 routers: auth, device, scanner, recording, telemetry, settings, ai
- Each router handles its own error handling
- Inconsistent validation patterns
- Some duplicate hardware interaction code

**Issues Found:**
1. **Duplicate Hardware Calls** - Multiple routers call `hardware.getConfig()` and `hardware.getStatus()`
2. **Inconsistent Error Messages** - Different error formats across routers
3. **Validation Duplication** - Frequency/sample rate validation repeated in multiple places
4. **No Shared Utilities** - Frequency conversion (Hz ↔ MHz) done inline everywhere

**Refactoring Opportunities:**
- Extract `hardware-utils.ts` with shared functions
- Create validation schemas in `shared/validation.ts`
- Standardize error response format
- Add middleware for common operations

### Hardware Abstraction

**Current State:**
- `hardware.ts` - Demo mode implementation
- `production-hardware.ts` - Production mode with C++ daemon spawning
- Mode switching via environment variable

**Issues Found:**
1. **Mode Detection Scattered** - `process.env.SDR_MODE` checked in multiple files
2. **No Type Safety** - Hardware interface not strictly typed
3. **Error Handling Inconsistent** - Different approaches in demo vs production

**Refactoring Opportunities:**
- Create `IHardware` interface with strict typing
- Centralize mode detection
- Unified error handling strategy

---

## Frontend Analysis

### Component Structure

**Current State:**
- 7 pages: Spectrum, Scanner, Device, Recordings, Settings, Home
- Shared components: SDRLayout, GlobalAIChat, WaterfallDisplay, SpectrographDisplay
- Custom hooks: useWebSocketFFT, useAuth

**Issues Found:**
1. **Duplicate Control Logic** - Frequency/gain controls repeated across Spectrum, Scanner, Device pages
2. **Inconsistent Loading States** - Some pages use skeletons, others use spinners, some show nothing
3. **Error Display Patterns** - Toast, inline errors, and alert dialogs all used inconsistently
4. **Form Validation** - Repeated validation logic for frequency/sample rate inputs

**Refactoring Opportunities:**
- Extract `useSDRControls` hook for frequency/gain/sample rate management
- Create `SDRControlPanel` shared component
- Standardize loading states with skeleton components
- Create `ErrorDisplay` component for consistent error handling
- Extract form validation to shared utilities

---

## Priority Refactoring Tasks

### Phase 1: Backend Utilities (High Priority)
1. Create `server/utils/hardware-utils.ts` - Shared hardware interaction functions
2. Create `shared/validation.ts` - Zod schemas for frequency/sample rate/gain
3. Create `server/utils/error-utils.ts` - Standardized error formatting
4. Add `IHardware` interface with strict typing

### Phase 2: Frontend Hooks & Components (High Priority)
5. Extract `useSDRControls` hook - Manage frequency/gain/sample rate state
6. Create `SDRControlPanel` component - Reusable control UI
7. Standardize loading states across all pages
8. Add error boundaries

### Phase 3: Type Safety (Medium Priority)
9. Add explicit return types to all tRPC procedures
10. Replace `any` types with proper types
11. Add comprehensive Zod validation

### Phase 4: Code Quality (Low Priority)
12. Add JSDoc comments to complex functions
13. Improve error messages with actionable guidance
14. Add memoization to expensive operations

---

## Estimated Impact

- **Code Quality:** ⭐⭐⭐⭐⭐ (Significant improvement)
- **Maintainability:** ⭐⭐⭐⭐⭐ (Much easier to maintain)
- **Type Safety:** ⭐⭐⭐⭐ (Fewer runtime errors)
- **Developer Experience:** ⭐⭐⭐⭐⭐ (Easier to work with)

---

## Recommendation

Proceed with refactoring in 4 phases with comprehensive testing after each phase.
