# Open Archiver MCP

MCP (Model Context Protocol) server for the [Open Archiver API](https://docs.openarchiver.com/api/).

Provides 20 tools to interact with your Open Archiver instance — search archived emails, manage ingestion sources, view dashboard stats, check integrity, upload/download files, and more.

## Installation

```bash
npm install
npm run build
```

## Configuration

Set the following environment variables:

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENARCHIVER_BASE_URL` | Yes | `http://localhost:3000` | Base URL of your Open Archiver instance |
| `OPENARCHIVER_API_KEY` | Yes | — | API key from **Settings > API Keys** |

## Usage

### Run directly

```bash
npm run dev     # Development (tsx)
node dist/index.js  # Production
```

### MCP Client Configuration

Add to your MCP client config (e.g., `claude_desktop_config.json`, `opencode.json`):

```json
{
  "mcpServers": {
    "openarchiver": {
      "command": "node",
      "args": ["path/to/openarchiver-mcp/dist/index.js"],
      "env": {
        "OPENARCHIVER_BASE_URL": "https://archive.example.com",
        "OPENARCHIVER_API_KEY": "oa_live_your_key"
      }
    }
  }
}
```

### OpenWebUI Configuration

OpenWebUI supports MCP over Streamable HTTP only. Use [mcpo](https://github.com/open-webui/mcpo) to bridge this stdio-based MCP server:

```bash
# Start mcpo proxy
uvx mcpo --port 8000 -- node dist/index.js

# With environment variables (PowerShell)
$env:OPENARCHIVER_BASE_URL="https://archive.example.com"; $env:OPENARCHIVER_API_KEY="oa_live_your_key"; uvx mcpo --port 8000 -- node dist/index.js
```

Then in OpenWebUI: **Admin Settings → External Tools → + Add Server**:

| Field | Value |
|---|---|
| Type | `MCP (Streamable HTTP)` |
| URL | `http://host.docker.internal:8000` (Docker) or `http://localhost:8000` |
| Auth | `None` |

Alternatively, use an mcpo config file (supports hot-reload with `--hot-reload`):

```json
{
  "mcpServers": {
    "openarchiver": {
      "command": "node",
      "args": ["path/to/openarchiver-mcp/dist/index.js"],
      "env": {
        "OPENARCHIVER_BASE_URL": "https://archive.example.com",
        "OPENARCHIVER_API_KEY": "oa_live_your_key"
      }
    }
  }
}
```

```bash
uvx mcpo --port 8000 --config mcp-config.json
```

## Tools

### Search

| Tool | Description |
|---|---|
| `search_emails` | Full-text search across indexed archived emails (Meilisearch) |

### Archived Emails

| Tool | Description |
|---|---|
| `list_archived_emails` | List archived emails for an ingestion source (paginated) |
| `get_archived_email` | Get full details of a single archived email |
| `delete_archived_email` | Permanently delete an archived email |

### Dashboard

| Tool | Description |
|---|---|
| `get_dashboard_stats` | High-level statistics (total emails, storage, failed ingestions) |
| `get_ingestion_history` | Email ingestion counts per day (last 30 days) |
| `get_ingestion_source_summaries` | Summary of sources with storage usage |
| `get_recent_syncs` | Recent sync sessions across all sources |
| `get_indexed_insights` | Top-sender statistics from the search index |

### Ingestion

| Tool | Description |
|---|---|
| `create_ingestion_source` | Create a new ingestion source |
| `list_ingestion_sources` | List all ingestion sources |
| `get_ingestion_source` | Get a single ingestion source |
| `update_ingestion_source` | Update an ingestion source |
| `delete_ingestion_source` | Delete an ingestion source |
| `trigger_import` | Trigger initial import of historical emails |
| `pause_ingestion_source` | Pause continuous sync |
| `force_sync` | Trigger an out-of-schedule sync |

### Integrity

| Tool | Description |
|---|---|
| `check_integrity` | Verify SHA-256 hashes of email and attachments |

### Storage & Upload

| Tool | Description |
|---|---|
| `download_file` | Download a file from the storage backend |
| `upload_file` | Upload a PST/EML/MBOX file for ingestion |
