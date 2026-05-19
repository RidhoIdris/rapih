# Rapih Mobile Monorepo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the initial pnpm + Turborepo monorepo for Rapih with a working Expo mobile app and placeholders for future API/admin apps.

**Architecture:** The repository root owns workspace orchestration, package manager pinning, and Turborepo task definitions. The only real app created now is `apps/mobile`, generated from the latest stable Expo template and configured with the provided EAS project id.

**Tech Stack:** pnpm 11.1.3, Turborepo 2.9.14, Expo SDK 55.0.24, React 19.2.x, React Native Expo-compatible 0.83.x.

---

### Task 1: Root Workspace

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `README.md`
- Create: `apps/api/.gitkeep`
- Create: `apps/admin/.gitkeep`
- Create: `packages/config/.gitkeep`
- Create: `packages/shared/.gitkeep`
- Create: `packages/ui/.gitkeep`

- [ ] **Step 1: Create root package files**

Create a private workspace package that pins pnpm and exposes `dev`, `build`, `lint`, `check`, and mobile helper scripts.

- [ ] **Step 2: Create Turborepo pipeline**

Configure `turbo.json` with persistent uncached `dev` and dependency-aware `build`, `lint`, and `check` tasks.

- [ ] **Step 3: Create placeholder directories**

Keep future `apps/api`, `apps/admin`, and shared package folders empty except for `.gitkeep`.

### Task 2: Expo Mobile App

**Files:**
- Create: `apps/mobile/**`
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/app.json`

- [ ] **Step 1: Generate Expo app**

Run `corepack pnpm@11.1.3 dlx create-expo-app@latest apps/mobile --template default@sdk-55 --no-install` from the repository root.

- [ ] **Step 2: Rename mobile package**

Set `apps/mobile/package.json` name to `@rapih/mobile` and keep scripts compatible with Expo CLI.

- [ ] **Step 3: Configure EAS project id**

Set `extra.eas.projectId` in `apps/mobile/app.json` to `e9b42083-492c-4215-b124-2c6f2b15a4f3`.

### Task 3: Install And Verify

**Files:**
- Create: `pnpm-lock.yaml`

- [ ] **Step 1: Install dependencies**

Run `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm@11.1.3 install`.

- [ ] **Step 2: Verify workspace scripts**

Run `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm@11.1.3 turbo run lint --filter=@rapih/mobile`.

- [ ] **Step 3: Verify Expo config**

Run `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm@11.1.3 --filter @rapih/mobile expo config --json`.
