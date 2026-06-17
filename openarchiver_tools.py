"""
title: Open Archiver Tools
author: openarchiver-mcp
description: Search, browse, and manage archived emails via the Open Archiver API.
             Configure the base URL and API key in Valves. Set readonly=false to enable
             write/admin operations (ingestion source management, deletions).
version: 1.0.0
"""

import json
import time
from typing import Optional

import requests
from pydantic import BaseModel, Field


class Tools:
    class Valves(BaseModel):
        base_url: str = Field(
            default="http://localhost:3000",
            description="Open Archiver API base URL (no trailing slash)",
        )
        api_key: str = Field(
            default="",
            description="API key sent as X-API-KEY header (leave blank if not required)",
        )
        readonly: bool = Field(
            default=True,
            description="When true, write/admin tools (ingestion management, deletions) are disabled",
        )

    def __init__(self):
        self.valves = self.Valves()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _request(
        self,
        method: str,
        path: str,
        query: Optional[dict] = None,
        body: Optional[dict] = None,
        retries: int = 3,
    ) -> str:
        url = f"{self.valves.base_url.rstrip('/')}/api{path}"
        headers: dict[str, str] = {}
        if self.valves.api_key:
            headers["X-API-KEY"] = self.valves.api_key
        if body is not None:
            headers["Content-Type"] = "application/json"

        params = {k: v for k, v in (query or {}).items() if v is not None}

        for attempt in range(retries):
            try:
                resp = requests.request(
                    method=method,
                    url=url,
                    headers=headers,
                    params=params,
                    json=body,
                    timeout=30,
                )
            except requests.RequestException as exc:
                return f"Request failed: {exc}"

            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", 15))
                time.sleep(retry_after)
                continue

            if not resp.ok:
                try:
                    msg = resp.json().get("message", resp.text)
                except Exception:
                    msg = resp.text
                return f"Error {resp.status_code}: {msg}"

            if resp.status_code == 204:
                return "Success"

            ct = resp.headers.get("content-type", "")
            if "application/json" in ct:
                try:
                    return json.dumps(resp.json(), indent=2, ensure_ascii=False)
                except Exception:
                    pass
            return resp.text

        return "Error: exceeded retry limit (rate limited)"

    def _guard_write(self) -> Optional[str]:
        if self.valves.readonly:
            return (
                "This tool is disabled in read-only mode. "
                "Set readonly=false in the Valves configuration to enable write operations."
            )
        return None

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    def search_emails(
        self,
        keywords: str,
        page: int = 1,
        limit: int = 10,
        matching_strategy: str = "last",
    ) -> str:
        """
        Full-text search across indexed archived emails using Meilisearch.
        :param keywords: Search query string (e.g. 'invoice Q4 2023')
        :param page: Page number for pagination (default: 1)
        :param limit: Results per page, 1–100 (default: 10)
        :param matching_strategy: Meilisearch strategy — last, all, or frequency (default: last)
        :return: JSON with search results
        """
        return self._request(
            "GET",
            "/v1/search",
            query={
                "keywords": keywords,
                "page": page,
                "limit": limit,
                "matchingStrategy": matching_strategy,
            },
        )

    # ------------------------------------------------------------------
    # Archived emails
    # ------------------------------------------------------------------

    def list_archived_emails(
        self,
        ingestion_source_id: str,
        page: int = 1,
        limit: int = 10,
    ) -> str:
        """
        List archived emails for a specific ingestion source (paginated).
        :param ingestion_source_id: ID of the ingestion source
        :param page: Page number (default: 1)
        :param limit: Items per page, 1–100 (default: 10)
        :return: JSON with paginated email list
        """
        return self._request(
            "GET",
            f"/v1/archived-emails/ingestion-source/{ingestion_source_id}",
            query={"page": page, "limit": limit},
        )

    def get_archived_email(self, id: str) -> str:
        """
        Get full details of a single archived email including attachments and thread.
        :param id: ID of the archived email
        :return: JSON with email details
        """
        return self._request("GET", f"/v1/archived-emails/{id}")

    def delete_archived_email(self, id: str) -> str:
        """
        Permanently delete an archived email by ID.
        Requires deletion to be enabled in Open Archiver settings and the email must not be on legal hold.
        Disabled when readonly=true.
        :param id: ID of the archived email to delete
        :return: Success message or error
        """
        err = self._guard_write()
        if err:
            return err
        result = self._request("DELETE", f"/v1/archived-emails/{id}")
        return result if result != "Success" else "Email deleted successfully."

    # ------------------------------------------------------------------
    # Dashboard
    # ------------------------------------------------------------------

    def get_dashboard_stats(self) -> str:
        """
        Get high-level statistics: total archived emails, storage used, and failed ingestions (last 7 days).
        :return: JSON with dashboard stats
        """
        return self._request("GET", "/v1/dashboard/stats")

    def get_ingestion_history(self) -> str:
        """
        Get email ingestion counts per day for the last 30 days.
        :return: JSON with daily ingestion history
        """
        return self._request("GET", "/v1/dashboard/ingestion-history")

    def get_ingestion_source_summaries(self) -> str:
        """
        Get a summary of all ingestion sources with their storage usage.
        :return: JSON with source summaries
        """
        return self._request("GET", "/v1/dashboard/ingestion-sources")

    def get_recent_syncs(self) -> str:
        """
        Get recent sync sessions across all ingestion sources.
        :return: JSON with recent sync sessions
        """
        return self._request("GET", "/v1/dashboard/recent-syncs")

    def get_indexed_insights(self) -> str:
        """
        Get top-sender statistics from the search index.
        :return: JSON with indexed insights
        """
        return self._request("GET", "/v1/dashboard/indexed-insights")

    # ------------------------------------------------------------------
    # Integrity
    # ------------------------------------------------------------------

    def check_integrity(self, id: str) -> str:
        """
        Verify SHA-256 hashes of an archived email and all its attachments against stored hashes.
        :param id: UUID of the archived email to verify
        :return: JSON with integrity check results
        """
        return self._request("GET", f"/v1/integrity/{id}")

    # ------------------------------------------------------------------
    # Storage
    # ------------------------------------------------------------------

    def download_file(self, path: str) -> str:
        """
        Download a file from the configured storage backend (local filesystem or S3-compatible).
        Returns the raw file content as text or a JSON representation.
        :param path: Relative storage path (e.g. 'open-archiver/emails/abc123.eml')
        :return: File content or error
        """
        return self._request("GET", "/v1/storage/download", query={"path": path})

    # ------------------------------------------------------------------
    # Ingestion sources (write — guarded by readonly valve)
    # ------------------------------------------------------------------

    def list_ingestion_sources(self) -> str:
        """
        List all configured ingestion sources (credentials are excluded from the response).
        :return: JSON with ingestion source list
        """
        return self._request("GET", "/v1/ingestion-sources")

    def get_ingestion_source(self, id: str) -> str:
        """
        Get details of a single ingestion source by ID (credentials excluded).
        :param id: ID of the ingestion source
        :return: JSON with ingestion source details
        """
        return self._request("GET", f"/v1/ingestion-sources/{id}")

    def create_ingestion_source(
        self,
        name: str,
        provider: str,
        provider_config: str,
    ) -> str:
        """
        Create a new ingestion source. Disabled when readonly=true.
        :param name: Display name for the ingestion source
        :param provider: Provider type — google_workspace, microsoft_365, imap, eml, pst, or mbox
        :param provider_config: Provider-specific configuration as a JSON string
        :return: JSON with created ingestion source
        """
        err = self._guard_write()
        if err:
            return err
        try:
            config = json.loads(provider_config)
        except json.JSONDecodeError as exc:
            return f"Invalid provider_config JSON: {exc}"
        return self._request(
            "POST",
            "/v1/ingestion-sources",
            body={"name": name, "provider": provider, "providerConfig": config},
        )

    def update_ingestion_source(
        self,
        id: str,
        name: Optional[str] = None,
        provider: Optional[str] = None,
        status: Optional[str] = None,
        provider_config: Optional[str] = None,
    ) -> str:
        """
        Update configuration for an existing ingestion source. Disabled when readonly=true.
        :param id: ID of the ingestion source
        :param name: New display name (optional)
        :param provider: New provider type (optional)
        :param status: New status value (optional)
        :param provider_config: Updated provider configuration as a JSON string (optional)
        :return: JSON with updated ingestion source
        """
        err = self._guard_write()
        if err:
            return err
        body: dict = {}
        if name is not None:
            body["name"] = name
        if provider is not None:
            body["provider"] = provider
        if status is not None:
            body["status"] = status
        if provider_config is not None:
            try:
                body["providerConfig"] = json.loads(provider_config)
            except json.JSONDecodeError as exc:
                return f"Invalid provider_config JSON: {exc}"
        return self._request("PUT", f"/v1/ingestion-sources/{id}", body=body)

    def delete_ingestion_source(self, id: str) -> str:
        """
        Permanently delete an ingestion source. Disabled when readonly=true.
        :param id: ID of the ingestion source to delete
        :return: Success message or error
        """
        err = self._guard_write()
        if err:
            return err
        result = self._request("DELETE", f"/v1/ingestion-sources/{id}")
        return result if result != "Success" else "Ingestion source deleted successfully."

    def trigger_import(self, id: str) -> str:
        """
        Trigger an initial import job for an ingestion source (imports all historical emails).
        Disabled when readonly=true.
        :param id: ID of the ingestion source
        :return: JSON with job details
        """
        err = self._guard_write()
        if err:
            return err
        return self._request("POST", f"/v1/ingestion-sources/{id}/import")

    def pause_ingestion_source(self, id: str) -> str:
        """
        Pause an ingestion source to stop continuous sync. Disabled when readonly=true.
        :param id: ID of the ingestion source to pause
        :return: JSON with updated source
        """
        err = self._guard_write()
        if err:
            return err
        return self._request("POST", f"/v1/ingestion-sources/{id}/pause")

    def force_sync(self, id: str) -> str:
        """
        Trigger an out-of-schedule continuous sync for an ingestion source. Disabled when readonly=true.
        :param id: ID of the ingestion source to sync
        :return: JSON with sync job details
        """
        err = self._guard_write()
        if err:
            return err
        return self._request("POST", f"/v1/ingestion-sources/{id}/sync")
