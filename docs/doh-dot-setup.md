# DNS-over-HTTPS (DoH) and DNS-over-TLS (DoT) Setup Guide

This guide explains how to configure encrypted DNS (DNS-over-HTTPS and DNS-over-TLS) for Motrix Turbo to protect against ISP DNS hijacking, eavesdropping, poisoning, and DNS leaks.

---

## Architecture Overview

Motrix downloads rely on the integrated `aria2` engine for HTTP, HTTPS, and FTP name resolution. In standard configurations, aria2 resolves domain names through:
1. The host operating system's configured DNS resolvers (UDP/TCP port 53).
2. The asynchronous c-ares DNS resolver (`async-dns=true`), which queries configured nameservers directly.

To achieve end-to-end encrypted DNS resolution, you can configure system-level native DoH or use a dedicated local DNS proxy.

---

## Method 1: Windows 11 Native DNS-over-HTTPS (Recommended for Windows)

Windows 11 includes built-in support for DNS-over-HTTPS without requiring third-party background software.

### Steps to Configure

1. Open **Windows Settings** (`Win + I`).
2. Navigate to **Network & internet** > **Ethernet** (or **Wi-Fi**).
3. Under **DNS server assignment**, click **Edit**.
4. Switch from **Automatic (DHCP)** to **Manual**.
5. Enable **IPv4** (and optionally **IPv6**).
6. Enter a known DoH provider's IP address:
   - **Cloudflare**:
     - Preferred DNS: `1.1.1.1`
     - Alternate DNS: `1.0.0.1`
   - **Google Public DNS**:
     - Preferred DNS: `8.8.8.8`
     - Alternate DNS: `8.8.4.4`
   - **Quad9**:
     - Preferred DNS: `9.9.9.9`
     - Alternate DNS: `149.112.112.112`
7. In the **DNS encryption** dropdown for each server, select:
   - **Encrypted only (DNS over HTTPS)** for strict leak-proof encryption, or
   - **Encrypted preferred, unencrypted allowed** for fallback compatibility.
8. Click **Save**.

Once configured, all Motrix and aria2 queries automatically route through the encrypted Windows DNS resolver.

---

## Method 2: Local Encrypted DNS Proxy (Cross-Platform)

For Windows 10, Linux, macOS, or advanced filtering setups, run a local encrypted DNS stub resolver such as **SmartDNS**, **cloudflared**, **dnscrypt-proxy**, or **AdGuard Home**.

### Using cloudflared

1. Install `cloudflared`:
   - Windows: `winget install Cloudflare.cloudflared`
   - macOS: `brew install cloudflared`
   - Linux: `apt install cloudflared`
2. Start the local DNS proxy service:
   ```bash
   cloudflared proxy-dns --port 5353 --upstream https://1.1.1.1/dns-query
   ```
3. Point your local or engine DNS configuration to `127.0.0.1:5353`.

### Using AdGuard Home / SmartDNS

1. Configure upstream DNS servers to use DoH or DoT endpoints:
   - `https://dns.cloudflare.com/dns-query`
   - `tls://dns.google`
   - `https://dns.quad9.net/dns-query`
2. Bind the local listener to `127.0.0.1:53`.

---

## Method 3: Engine-Level Nameserver Tuning

For advanced users running custom aria2 configurations or containerized/headless servers (`src/server`):

1. Specify custom nameservers in your engine settings or proxy configuration:
   ```ini
   # In aria2.conf or engine parameters
   async-dns=true
   dns-cache=true
   ```
2. When pointing to a local DoH/DoT proxy running on `127.0.0.1`, set:
   ```ini
   server-stat-if=127.0.0.1
   ```

---

## Preventing DNS Leaks with VPN Kill-Switch (F3)

When using Motrix's **Network Interface Binding & VPN Kill-Switch**:
- In **Settings** > **Network** > **Network Interface Binding**, select your active VPN adapter (e.g., WireGuard, OpenVPN, TAP).
- When the VPN adapter disconnects, Motrix's kill-switch immediately pauses all downloads, preventing requests from falling back to your default physical network adapter.
- Ensure your VPN connection is configured to push its own internal DNS servers or that your system DoH is enforced via **Encrypted only**, ensuring zero plaintext DNS queries escape over physical interfaces.

---

## Verification & Leak Testing

To verify that your DNS requests are encrypted:

1. **PowerShell Test (Windows)**:
   ```powershell
   Resolve-DnsName -Name cloudflare.com -Type A
   ```
2. **Online Leak Test**:
   - Visit [dnsleaktest.com](https://www.dnsleaktest.com/) or [1.1.1.1/help](https://1.1.1.1/help).
   - Verify that your ISP's nameservers do not appear and that "Using DNS over HTTPS (DoH)" reports **Yes**.
