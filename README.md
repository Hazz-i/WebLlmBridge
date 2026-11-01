<div align="center">

# WebLlmBridge (Hermes Web-to-API Edition)

<p><b>Ubah Chat AI Web Browser Gratisan (Claude.ai / ChatGPT / Gemini) menjadi OpenAI-Compatible API untuk Hermes Agent & Local Workflows</b></p>

[![License](https://img.shields.io/badge/LICENSE-GPL--3.0-FACC15?style=flat-square&labelColor=111111&logo=opensourceinitiative&logoColor=FACC15)](LICENSE)
[![Manifest](https://img.shields.io/badge/MANIFEST-V3-FACC15?style=flat-square&labelColor=111111&logo=googlechrome&logoColor=FACC15)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3/)
[![Hermes](https://img.shields.io/badge/Hermes-Agent-blue?style=flat-square&logo=robot)](https://github.com/NousResearch/Hermes-Agent)
[![Protocol](https://img.shields.io/badge/API-OpenAI%20Compatible-green?style=flat-square)](https://platform.openai.com/docs/api-reference)

</div>

---

## 01. Gambaran Umum & Konsep
 
**WebLlmBridge** adalah bridge penghubung antara AI web chat browser (Claude.ai, ChatGPT, Gemini, dll.) dengan **Hermes Agent** maupun workflow lokal lainnya. Fitur utama **Reverse Web-to-API Bridge**:

1. **Gunakan Akun Web Gratisan**: Memanfaatkan sesi login pribadi kamu di `claude.ai` atau `chatgpt.com` pada browser Chrome/Edge tanpa perlu membayar langganan API token mahal.
2. **OpenAI-Compatible Local API**: Local bridge otomatis menyediakan endpoint HTTP standar `/v1/models` dan `/v1/chat/completions` di port `17614`.
3. **Terintegrasi Penuh ke Hermes Agent**: Hermes (baik di Telegram, Discord, atau CLI) dapat langsung mengirim chat ke browser dan menerima respons teks dari Claude 3.5 Sonnet / GPT-4o.
4. **Cloudflare Tunnel Ready**: Dilengkapi skrip one-click tunnel (`run_tunnel.sh` / `run_tunnel.bat`) agar bridge lokal di PC/laptop bisa diakses secara remote oleh server Hermes di mana saja.

---

## 02. Arsitektur Alur Kerja

```
┌─────────────────────────────────┐
│     Hermes Agent (Telegram/CLI) │
└─────────────────────────────────┘
                │ HTTP POST /v1/chat/completions
                ▼
┌─────────────────────────────────┐
│   Local Bridge (bridge.py :17614)│ ◄─── (Bisa ditunneling via Cloudflare Tunnel)
└─────────────────────────────────┘
                │ WebSocket (ws://127.0.0.1:17613)
                ▼
┌─────────────────────────────────┐
│   WebLlmBridge Extension        │
└─────────────────────────────────┘
                │ DOM Automation (Ketik & Klik Kirim)
                ▼
┌─────────────────────────────────┐
│ Web Chat (Claude.ai / ChatGPT)  │
│ (Login Akun Pribadi di Browser) │
└─────────────────────────────────┘
```

---

## 03. Cara Pemasangan & Menjalankan

### Langkah 1: Pasang Ekstensi Browser
1. Buka browser **Google Chrome** atau **Microsoft Edge**.
2. Buka halaman ekstensi: `chrome://extensions` atau `edge://extensions`.
3. Aktifkan **Developer mode** (di pojok kanan atas).
4. Klik **Load unpacked** dan pilih folder `snapgent-extension` dari repo ini.
5. Buka tab baru ke [Claude.ai](https://claude.ai) atau [ChatGPT](https://chatgpt.com) dan login dengan akun lu seperti biasa.

### Langkah 2: Jalankan Local Bridge
Buka terminal di folder project ini:

```bash
# Pastikan dependensi websockets terpasang
pip install websockets

# Jalankan bridge (akan membuka WebSocket :17613 dan OpenAI API :17614)
python3 bridge.py
```

Output log terminal:
```text
listening on ws://127.0.0.1:17613 - load the extension and open a supported AI chat
hermes openai-compatible api listening on http://0.0.0.0:17614/v1
extension connected
```

### Langkah 3: Test Endpoint Lokal
Di terminal lain, jalankan script pengujian:

```bash
python3 test_hermes_endpoint.py
```

### Langkah 4: Tunneling ke Hermes Remote (Opsional)
Jika server Hermes berada di mesin berbeda (misal server homelab/VPS) dan PC browser lu ada di laptop/desktop:

```bash
# Linux / macOS
./run_tunnel.sh

# Windows
run_tunnel.bat
```
Salin URL publik yang dihasilkan (contoh: `https://xxxx-xxxx.trycloudflare.com/v1`).

---

## 04. Konfigurasi di Hermes Agent

Tambahkan provider custom ke file `config.yaml` Hermes (`~/.hermes/config.yaml`):

```yaml
model:
  default: web-claude
  provider: custom
  base_url: http://127.0.0.1:17614/v1  # atau https://xxxx-xxxx.trycloudflare.com/v1
  api_mode: chat_completions
```

Atau pilih melalui CLI Hermes:
```bash
hermes config set model.default web-claude
hermes config set model.provider custom
hermes config set model.base_url http://127.0.0.1:17614/v1
```

---

## 05. Model yang Didukung

Endpoint `/v1/models` menyediakan pilihan model berikut:
- `web-claude` — Mengarahkan chat ke tab `claude.ai` yang aktif.
- `web-chatgpt` — Mengarahkan chat ke tab `chatgpt.com` yang aktif.
- `web-active-tab` — Menggunakan tab browser AI mana pun yang sedang dibuka.

---

## 06. Lisensi

GPL-3.0 License. Lihat file [LICENSE](LICENSE) untuk detail lisensi.
