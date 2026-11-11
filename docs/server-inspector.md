# Download Server Geolocation and Latency Inspector

Motrix Turbo provides real-time visibility into active download mirrors, server endpoints, and network connections for HTTP, HTTPS, and FTP tasks.

## Overview

When downloading multi-source or multi-connection tasks, the underlying engine connects to primary servers and mirrors concurrently. The **Servers** inspector tab provides real-time telemetry into these connections:

- **Server Endpoints**: The resolved remote IP address and destination port (`IP:Port`) actively serving download segments.
- **Source URIs**: The effective mirror URI and request endpoint.
- **Download Throughput**: Real-time per-server transfer rate.
- **GeoIP Resolution**: Flag and country code identifying the geographical location of each server using the local GeoIP database.
- **Estimated Latency**: Measured round-trip network ping/latency in milliseconds.

## Accessing the Servers Tab

1. Select any active, paused, or completed HTTP/HTTPS/FTP download task in the list.
2. Open the **Task Inspector** drawer.
3. Click the **Servers** tab icon in the inspector header.

> [!NOTE]
> BitTorrent and Magnet tasks feature dedicated **Peers** and **Trackers** inspector tabs instead of the HTTP/FTP Servers tab.

## Geolocation Data

Geolocation resolution uses Motrix's offline GeoIP lookup service:
- IP addresses are resolved entirely locally against offline database files.
- No network requests are sent to third-party tracking services during IP lookup.
- If GeoIP is disabled or offline databases are not yet installed, the table continues to display endpoints, URIs, throughput, and latency.
