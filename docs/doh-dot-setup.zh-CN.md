# DNS-over-HTTPS (DoH) 与 DNS-over-TLS (DoT) 配置指南

本指南介绍如何为 Motrix Turbo 配置加密 DNS（DNS-over-HTTPS / DNS-over-TLS），以防范运营商 (ISP) DNS 劫持、嗅探、投毒以及 DNS 泄露风险。

---

## 架构说明

Motrix 的 HTTP、HTTPS 和 FTP 下载任务由内置 `aria2` 引擎驱动。常规配置下，aria2 的域名解析主要通过以下两种方式：
1. 宿主操作系统的 DNS 解析栈（UDP/TCP 端口 53）。
2. c-ares 异步解析器（`async-dns=true`），直接向上游 DNS 服务器发起并发查询。

为了实现端到端的加密 DNS 解析，推荐使用系统级原生 DoH 或搭建本地加密 DNS 代理。

---

## 方法一：Windows 11 原生 DNS-over-HTTPS（推荐 Windows 用户）

Windows 11 原生集成了 DoH 协议支持，无需安装第三方后台服务即可全局开启加密。

### 配置步骤

1. 打开 **Windows 设置**（快捷键 `Win + I`）。
2. 进入 **网络和 Internet** > **以太网**（或 **WLAN**）。
3. 找到 **DNS 服务器分配**，点击 **编辑**。
4. 将分配方式从 **自动 (DHCP)** 切换为 **手动**。
5. 启用 **IPv4**（可选启用 **IPv6**）。
6. 填入主流公共 DoH 解析服务器 IP：
   - **Cloudflare**:
     - 首选 DNS：`1.1.1.1`
     - 备用 DNS：`1.0.0.1`
   - **Google Public DNS**:
     - 首选 DNS：`8.8.8.8`
     - 备用 DNS：`8.8.4.4`
   - **Quad9**:
     - 首选 DNS：`9.9.9.9`
     - 备用 DNS：`149.112.112.112`
   - **阿里 DNS / DNSPod**（国内加速）：
     - 阿里 DNS：`223.5.5.5` / `223.6.6.6`
     - 腾讯 DNSPod：`119.29.29.29`
7. 在 **DNS 加密** 下拉菜单中选择：
   - **仅加密 (通过 HTTPS 的 DNS)**：强制防泄漏模式，禁止明文回退；或
   - **首选加密，允许未加密**：兼顾兼容性的回退模式。
8. 点击 **保存**。

完成设置后，Motrix 与 aria2 的所有域名解析将自动经由 Windows 系统加密通道传输。

---

## 方法二：本地加密 DNS 代理（跨平台通用方案）

对于 Windows 10、Linux、macOS 用户，或者需要高级去广告/分流规则的用户，可以在本地运行轻量级 DNS 转发器，如 **SmartDNS**、**cloudflared**、**dnscrypt-proxy** 或 **AdGuard Home**。

### 使用 cloudflared

1. 安装 `cloudflared`：
   - Windows：`winget install Cloudflare.cloudflared`
   - macOS：`brew install cloudflared`
   - Linux：`apt install cloudflared`
2. 启动本地代理服务：
   ```bash
   cloudflared proxy-dns --port 5353 --upstream https://1.1.1.1/dns-query
   ```
3. 将系统或网络适配器 DNS 指向 `127.0.0.1:5353`。

### 使用 AdGuard Home / SmartDNS

1. 将上游 DNS 设置为 DoH 或 DoT 端点：
   - `https://dns.alidns.com/dns-query`
   - `https://doh.pub/dns-query`
   - `tls://dns.google`
   - `https://dns.quad9.net/dns-query`
2. 本地监听端口绑定为 `127.0.0.1:53`。

---

## 方法三：配合 VPN Kill-Switch 防泄漏联动

使用 Motrix 的**网卡绑定与 VPN Kill-Switch 功能**时：
- 在 **设置** > **网络** > **网络接口绑定** 中，选择当前连接的 VPN 虚拟网卡（例如 WireGuard、OpenVPN、TAP 适配器）。
- 当 VPN 意外断开时，Motrix 的 Kill-Switch 机制将立即冻结任务，防止连接泄露至普通物理网卡。
- 确保 VPN 客户端已配置内部防泄漏 DNS，或在 Windows 系统上将 DNS 加密设置为**仅加密**，杜绝明文 DNS 请求穿透。

---

## 验证与泄露检测

配置完成后，可通过以下步骤检测加密是否生效：

1. **PowerShell 解析测试**：
   ```powershell
   Resolve-DnsName -Name cloudflare.com -Type A
   ```
2. **在线防泄漏测试**：
   - 访问 [dnsleaktest.com](https://www.dnsleaktest.com/) 进行 Standard / Extended Test。
   - 确认列表中没有显示运营商默认的明文 DNS 服务器。
