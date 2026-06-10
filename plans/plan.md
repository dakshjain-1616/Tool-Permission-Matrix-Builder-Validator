# Tool Permission Matrix Builder & Validator

## Goal
A production-ready visual policy management system for AI agents and tool ecosystems with drag-and-drop permission matrix, role management, tool registry, policy generation (JSON/YAML/Python), Claude-powered agent validation, and tool sprawl analysis.

## Research Summary
- @dnd-kit/core is the current standard for React 18+ drag-and-drop (modern, maintained, TypeScript-native)
- FastAPI + SQLAlchemy async with SQLite is well-documented — use async def routes with async sessionmaker
- Anthropic Python SDK supports `claude-sonnet-4-20250514` — the exact model specified
- Zustand with TypeScript is the recommended lightweight state management for React
- Vite + React + TypeScript + Tailwind is the standard modern frontend toolchain

## Approach
Build backend first (models, schemas, services), then frontend (stores, components, UI), then Docker + integration. All Claude integrations use `claude-sonnet-4-20250514` exclusively.

## Subtasks
1. **Backend Database + Models** — SQLAlchemy models (Tool, Role, Permission), database.py with async SQLite setup, all risk categories as an Enum
2. **Backend Schemas** — Pydantic schemas for Tool, Role, Permission, and all API request/response types
3. **Backend API Routes (main.py)** — CRUD endpoints for tools, roles, permissions, plus policy generation, agent validation, sprawl analysis endpoints
4. **Backend Policy Generator** — Generate valid JSON policy, YAML policy, and syntactically correct Python `permissions.py` module
5. **Backend Agent Validator Service** — Claude-powered service that analyzes agent code/config, checks tool calls against permission matrix, produces security score
6. **Backend Sprawl Analyzer Service** — Claude-powered analysis of permission matrix for over-exposure, redundant tools, unused tools, sprawl score
7. **Backend Tests + Fixtures** — pytest tests for policy generator, validator, and a realistic sample_agent.py fixture with real tool call patterns
8. **Frontend Types + API Client** — TypeScript types mirroring backend schemas, Zustand stores (toolStore, roleStore, matrixStore), API client
9. **Frontend Components — Tool Registry & Role Manager** — CRUD UIs with risk-category colored badges, filter, JSON import/export
10. **Frontend Component — Permission Matrix (Drag & Drop)** — DnD grid with @dnd-kit/core showing roles × tools, green/red/grey cells, click to toggle, real-time validation warnings
11. **Frontend Components — Policy Exporter, Agent Validator, Sprawl Analysis** — UI for generation/download, paste/upload agent code, analysis display with score
12. **Frontend App Root + Vite Config** — App.tsx with routing, Tailwind config, vite.config.ts, package.json
13. **Docker Compose + .env.example** — Docker setup, env template
14. **Integration Verification** — Build frontend, start backend, verify all endpoints work end-to-end

## Deliverables
| File Path | Description |
|-----------|-------------|
| backend/models.py | SQLAlchemy ORM models |
| backend/schemas.py | Pydantic request/response schemas |
| backend/database.py | Async SQLite database setup |
| backend/main.py | FastAPI application with all endpoints |
| backend/services/policy_generator.py | Policy export to JSON/YAML/Python |
| backend/services/agent_validator.py | Claude-powered agent code analysis |
| backend/services/sprawl_analyzer.py | Claude-powered matrix analysis |
| backend/tests/* | pytest test suite with fixtures |
| frontend/src/stores/*.ts | Zustand state stores |
| frontend/src/components/*.tsx | All React components |
| frontend/src/api/client.ts | API client |
| frontend/src/types/index.ts | TypeScript type definitions |
| frontend/src/App.tsx | Root app component |
| frontend/vite.config.ts | Vite configuration |
| frontend/package.json | NPM dependencies |
| docker-compose.yml | Docker Compose setup |
| .env.example | Environment template |

## Evaluation Criteria
- All 6 risk categories implemented (read-only, internal-write, external-api, financial, destructive, administrative)
- Drag-and-drop matrix updates state (not just styled)
- Policy generation produces valid JSON, YAML, and syntactically correct Python module
- All Claude services use ONLY claude-sonnet-4-20250514
- Frontend builds without TypeScript errors
- Backend starts and all CRUD endpoints respond correctly
- Sample fixture has realistic tool call patterns

## Notes
- Frontend will be served by Vite dev server during development, nginx in Docker
- Backend runs on port 8000, frontend on port 5173 (dev) / 80 (Docker)
- No GPU needed — all services are CPU-based API calls