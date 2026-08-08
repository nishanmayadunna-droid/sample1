# GitHub Copilot Toolbox — MCP & Skills awareness

_Generated: 2026-08-08T20:01:54.633Z_

## How to use this report

- **Saved copy:** This file is **`.github/copilot-toolbox-mcp-skills-awareness.md`** — refreshed whenever the toolbox runs an MCP & Skills scan (including on workspace open when auto-scan is enabled). It is meant for **Copilot workspace context** together with `.github/copilot-instructions.md` (which gets a shorter replaceable summary when auto-merge is on).
- **MCP:** Lists **configured** servers from `mcp.json`. **Live tool use** still requires **Copilot Chat → Agent** with those servers **trusted/started** in the MCP tools UI.
- **Skills:** **On-disk** folders with `SKILL.md`. Copilot does not auto-load them; attach `SKILL.md` or paths in chat when useful.
- **Task routing:** When the user’s request matches a server’s purpose (e.g. Confluence → Confluence/Atlassian MCP), prefer that **server id** from the tables below.

---

## MCP — workspace

Workspace `mcp.json` _(folder: market-round)_

- **c:\Users\nisha\OneDrive\Desktop\saas\market-round\.vscode\mcp.json** — _File missing_

_No active workspace servers in mcp.json._

## MCP — user profile

- **C:\Users\nisha\AppData\Roaming\Code\User\mcp.json** — _File missing_

_No active user-scoped servers in mcp.json._

## Skills (local `SKILL.md` folders)

### Project-scoped

_None found (or no workspace open)._

### User-scoped

- **agent-browser** — `C:\Users\nisha\.agents\skills\agent-browser`
  - Browser automation CLI for AI agents. Use when the user needs to interact with websites, including navigating pages, filling forms, clicking buttons, taking screenshots, extracting data, testing web apps, or automating a

- **brainstorming** — `C:\Users\nisha\.agents\skills\brainstorming`
  - You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design before implementation.

- **brainstorming-axelmrak-ai** — `C:\Users\nisha\.agents\skills\brainstorming-axelmrak-ai`
  - >

- **canvas-design** — `C:\Users\nisha\.agents\skills\canvas-design`
  - Create beautiful visual art in .png and .pdf documents using design philosophy. You should use this skill when the user asks to create a poster, piece of art, design, or other static piece. Create original visual designs

- **caveman** — `C:\Users\nisha\.agents\skills\caveman`
  - Compress and simplify prompts to preserve meaning while reducing use

- **claude-mem** — `C:\Users\nisha\.agents\skills\claude-mem`
  - Persistent memory compression system for Claude Code enabling context preservation across sessions with automatic observations, semantic search, and privacy controls

- **django-dev** — `C:\Users\nisha\.agents\skills\django-dev`
  - Django development patterns and conventions (2025). Auto-loads when working with Django models, views, URLs, forms, templates, management commands, or project structure. Includes async support and type hints.

- **docx** — `C:\Users\nisha\.agents\skills\docx`
  - Use this skill whenever the user wants to create, read, edit, or manipulate Word documents (.docx files). Triggers include: any mention of 'Word doc', 'word document', '.docx', or requests to produce professional documen

- **excalidraw-diagram-generator** — `C:\Users\nisha\.agents\skills\excalidraw-diagram-generator`
  - Generate Excalidraw diagrams from natural language descriptions. Use when asked to "create a diagram", "make a flowchart", "visualize a process", "draw a system architecture", "create a mind map", or "generate an Excalid

- **find-skills** — `C:\Users\nisha\.agents\skills\find-skills`
  - Helps users discover and install agent skills when they ask questions like "how do I do X", "find a skill for X", "is there a skill that can...", or express interest in extending capabilities. This skill should be used w

- **frontend-design** — `C:\Users\nisha\.agents\skills\frontend-design`
  - Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one. Helps with aesthetic direction, typography, and making choices that don't read as templated defaults.

- **pdf** — `C:\Users\nisha\.agents\skills\pdf`
  - Use this skill whenever the user wants to do anything with PDF files. This includes reading or extracting text/tables from PDFs, combining or merging multiple PDFs into one, splitting PDFs apart, rotating pages, adding w

- **pptx** — `C:\Users\nisha\.agents\skills\pptx`
  - Use this skill any time a .pptx file is involved in any way — as input, output, or both. This includes: creating slide decks, pitch decks, or presentations; reading, parsing, or extracting text from any .pptx file (even 

- **prd** — `C:\Users\nisha\.agents\skills\prd`
  - Generate high-quality Product Requirements Documents (PRDs) for software systems and AI-powered features. Includes executive summaries, user stories, technical specifications, and risk analysis.

- **skill-creator** — `C:\Users\nisha\.agents\skills\skill-creator`
  - Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill, benchmark skill pe

- **superpowers-test-driven-development** — `C:\Users\nisha\.agents\skills\superpowers-test-driven-development`
  - Use when implementing any feature or bugfix, before writing implementation code

- **systematic-debugging** — `C:\Users\nisha\.agents\skills\systematic-debugging`
  - Structured debugging methodology using hypothesis-driven investigation, log analysis, and bisection to isolate and resolve defects.

- **technical-writer-erichowens-some-claude-skills** — `C:\Users\nisha\.agents\skills\technical-writer-erichowens-some-claude-skills`
  - Expert technical documentation specialist for developer docs, API references, and runbooks. Activate on: documentation, docs, README, API reference, technical writing, user guide, runbook, ADR, changelog, release notes, 

- **using-superpowers** — `C:\Users\nisha\.agents\skills\using-superpowers`
  - Use when starting any conversation - establishes how to find and use skills, requiring skill invocation before ANY response including clarifying questions

- **vibesec-skill** — `C:\Users\nisha\.agents\skills\vibesec-skill`
  - This skill helps Claude write secure web applications. Use this when working on any web application or when a user requests a scan or audit to ensure security best practices are followed.

- **web-access** — `C:\Users\nisha\.agents\skills\web-access`
  - 所有联网操作必须通过此 skill 处理，包括：搜索、网页抓取、登录后操作、网络交互等。

- **webapp-testing-sickn33** — `C:\Users\nisha\.agents\skills\webapp-testing-sickn33`
  - Toolkit for interacting with and testing local web applications using Playwright. Supports verifying frontend functionality, debugging UI behavior, capturing browser screenshots, and viewing browse...

- **xlsx** — `C:\Users\nisha\.agents\skills\xlsx`
  - Use this skill any time a spreadsheet file is the primary input or output. This means any task where the user wants to: open, read, edit, or fix an existing .xlsx, .xlsm, .csv, or .tsv file (e.g., adding columns, computi

---

## Suggested next steps

- **MCP:** Command Palette → `MCP: List Servers` (or this extension’s hub **MCP** tab) → start/trust servers in **Copilot Chat → Agent → tools**.
- **Edit config:** `MCP: Open Workspace Folder MCP Configuration` / `MCP: Open User Configuration`.
- **Refresh this report:** run **Intelligence — scan MCP & Skills awareness** again after changing `mcp.json` or adding skills.

_Report from GitHub Copilot Toolbox extension._
