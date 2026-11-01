#!/usr/bin/env python3
"""Headless Claude.ai Web Client with persistent single-session & SVG rendering."""

import json
import os
import re
import subprocess
import sys
import time
import uuid
from pathlib import Path
from curl_cffi import requests

TOKENS_PATH = Path(__file__).resolve().parent / "web_tokens.json"
SCRATCH_DIR = Path("/home/wahid/.hermes/cache/scratch")
SCRATCH_DIR.mkdir(parents=True, exist_ok=True)
LAST_REQUEST_FILE = SCRATCH_DIR / "claude_last_request.txt"
MIN_COOLDOWN_SECONDS = 30.0

def wait_for_cooldown():
    now = time.time()
    if LAST_REQUEST_FILE.exists():
        try:
            last_ts = float(LAST_REQUEST_FILE.read_text().strip())
            elapsed = now - last_ts
            if elapsed < MIN_COOLDOWN_SECONDS:
                wait_sec = MIN_COOLDOWN_SECONDS - elapsed
                print(f"[Claude Client] Cooldown active: waiting {wait_sec:.1f}s to avoid 429...")
                time.sleep(wait_sec)
        except Exception:
            pass
    LAST_REQUEST_FILE.write_text(str(time.time()))



def load_tokens() -> dict:
    if not TOKENS_PATH.exists():
        return {}
    try:
        return json.loads(TOKENS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_tokens(tokens: dict) -> None:
    TOKENS_PATH.write_text(json.dumps(tokens, indent=2), encoding="utf-8")


def get_claude_organization(session_key: str) -> str:
    url = "https://claude.ai/api/organizations"
    cookies = {"sessionKey": session_key}
    resp = requests.get(url, cookies=cookies, impersonate="chrome124", timeout=15)
    if resp.status_code != 200:
        raise RuntimeError(f"Gagal mengambil organisasi Claude: HTTP {resp.status_code} - {resp.text}")
    data = json.loads(resp.text)
    if not data or not isinstance(data, list):
        raise RuntimeError("Tidak ada organisasi yang ditemukan untuk sessionKey ini.")
    return data[0]["uuid"]


def create_new_claude_conversation(org_uuid: str, session_key: str, title: str = "Hermes Chat") -> str:
    conv_uuid = str(uuid.uuid4())
    create_url = f"https://claude.ai/api/organizations/{org_uuid}/chat_conversations"
    cookies = {"sessionKey": session_key}
    headers = {
        "Content-Type": "application/json",
        "Origin": "https://claude.ai",
        "Referer": f"https://claude.ai/chat/{conv_uuid}",
        "Accept": "text/event-stream",
    }
    resp = requests.post(
        create_url,
        json={"uuid": conv_uuid, "name": title},
        cookies=cookies,
        headers=headers,
        impersonate="chrome124",
        timeout=15,
    )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Gagal membuat percakapan: HTTP {resp.status_code} - {resp.text}")
    return conv_uuid


def render_svg_to_media(text: str) -> str:
    """Detect <svg> tags, render to high-res PNG, and append MEDIA: tag for Telegram."""
    svg_matches = re.findall(r"(<svg[\s\S]*?</svg>)", text, re.IGNORECASE)
    if not svg_matches:
        return text

    media_tags = []
    ts = int(time.time())
    for idx, svg_code in enumerate(svg_matches):
        svg_file = SCRATCH_DIR / f"claude_svg_{ts}_{idx}.svg"
        png_file = SCRATCH_DIR / f"claude_img_{ts}_{idx}.png"
        try:
            svg_file.write_text(svg_code, encoding="utf-8")
            cmd = ["convert", "-background", "none", "-density", "300", str(svg_file), str(png_file)]
            res = subprocess.run(cmd, capture_output=True)
            if res.returncode == 0 and png_file.exists():
                media_tags.append(f"MEDIA:{png_file}")
        except Exception:
            pass

    if media_tags:
        return text + "\n\n" + "\n".join(media_tags)
    return text


def send_claude_web_chat(prompt: str, timeout: float = 120.0) -> str:
    tokens = load_tokens()
    session_key = tokens.get("claude_session_key")
    if not session_key:
        raise RuntimeError("sessionKey Claude tidak ditemukan di web_tokens.json.")

    org_uuid = tokens.get("claude_org_uuid")
    if not org_uuid:
        org_uuid = get_claude_organization(session_key)
        tokens["claude_org_uuid"] = org_uuid
        save_tokens(tokens)

    # Cek perintah reset sesi /newclaude atau /new
    clean_p = prompt.strip().lower()
    if "/newclaude" in clean_p or "/new" in clean_p.split() or "/reset" in clean_p.split() or clean_p.endswith("/newclaude"):
        new_conv = create_new_claude_conversation(org_uuid, session_key, title="Hermes Main Session")
        tokens["active_claude_conv_uuid"] = new_conv
        save_tokens(tokens)
        return "Sesi percakapan Claude baru berhasil dibuat! Riwayat sebelumnya telah di-reset."

    # Gunakan sesi yang sedang aktif agar rapi di 1 chat
    conv_uuid = tokens.get("active_claude_conv_uuid")
    if not conv_uuid:
        conv_uuid = create_new_claude_conversation(org_uuid, session_key, title="Hermes Main Session")
        tokens["active_claude_conv_uuid"] = conv_uuid
        save_tokens(tokens)

    chat_url = f"https://claude.ai/api/organizations/{org_uuid}/chat_conversations/{conv_uuid}/completion"
    cookies = {"sessionKey": session_key}
    headers = {
        "Content-Type": "application/json",
        "Origin": "https://claude.ai",
        "Referer": f"https://claude.ai/chat/{conv_uuid}",
        "Accept": "text/event-stream",
    }

    # Instruksi otomatis agar Claude mengeluarkan kode SVG utuh langsung di teks (bukan artifact)
    enhanced_prompt = prompt
    lower_prompt = prompt.lower()
    if any(k in lower_prompt for k in ("gambar", "gambarkeun", "draw", "generate image", "buatkan gambar", "ilustrasi")):
        enhanced_prompt = f"{prompt}\n(Catatan: Jika menghasilkan gambar/vektor, tuliskan kode SVG utuh langsung di dalam blok kode ```xml ... ``` agar langsung di-render)."

    wait_for_cooldown()
    # Ambil parent leaf UUID agar percakapan bercabang dengan benar
    parent_uuid = ""
    try:
        r_info = requests.get(f"https://claude.ai/api/organizations/{org_uuid}/chat_conversations/{conv_uuid}", cookies=cookies, impersonate="chrome124", timeout=10)
        if r_info.status_code == 200:
            parent_uuid = json.loads(r_info.text).get("current_leaf_message_uuid") or ""
    except Exception:
        pass

    payload = {
        "prompt": enhanced_prompt,
        "timezone": "Asia/Jakarta",
        "attachments": [],
        "files": [],
    }
    if parent_uuid:
        payload["parent_message_uuid"] = parent_uuid

    resp = requests.post(
        chat_url,
        json=payload,
        cookies=cookies,
        headers=headers,
        impersonate="chrome124",
        timeout=timeout,
        stream=True,
    )

    # Jika sesi lama kedaluwarsa atau terhapus di web, buatkan sesi baru dan coba lagi sekali
    if resp.status_code in (404, 400):
        conv_uuid = create_new_claude_conversation(org_uuid, session_key, title="Hermes Main Session")
        tokens["active_claude_conv_uuid"] = conv_uuid
        save_tokens(tokens)
        chat_url = f"https://claude.ai/api/organizations/{org_uuid}/chat_conversations/{conv_uuid}/completion"
        headers["Referer"] = f"https://claude.ai/chat/{conv_uuid}"
        resp = requests.post(
            chat_url,
            json=payload,
            cookies=cookies,
            headers=headers,
            impersonate="chrome124",
            timeout=timeout,
            stream=True,
        )

    # Jika terkena burst rate limit sesaat (cooldown antar pesan cepat), tunggu 6 detik dan coba lagi sekali
    if resp.status_code == 429:
        time.sleep(6)
        resp = requests.post(
            chat_url,
            json=payload,
            cookies=cookies,
            headers=headers,
            impersonate="chrome124",
            timeout=timeout,
            stream=True,
        )

    if resp.status_code != 200:
        if resp.status_code == 429:
            raise RuntimeError("Akun Claude web lu sedang terkena batas pesan (Rate Limit / Cooldown dari Anthropic). Silakan tunggu 1-2 menit lalu coba lagi.")
        raise RuntimeError(f"Claude Web mengembalikan status HTTP {resp.status_code}: {resp.text}")

    full_reply = []
    for line in resp.iter_lines():
        if not line:
            continue
        s = line.decode("utf-8", "replace")
        if s.startswith("data: "):
            try:
                d = json.loads(s[6:])
                if "completion" in d:
                    full_reply.append(d["completion"])
            except Exception:
                pass

    raw_result = "".join(full_reply).strip()
    if not raw_result:
        return "(Respon kosong dari Claude)"

    # Render SVG ke PNG jika ada tag SVG di teks
    final_output = render_svg_to_media(raw_result)
    return final_output


if __name__ == "__main__":
    p = sys.argv[1] if len(sys.argv) > 1 else "Halo"
    print("Testing prompt:", p)
    res = send_claude_web_chat(p)
    print("=== RESULT ===")
    print(res)
