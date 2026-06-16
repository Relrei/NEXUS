#!/usr/bin/env python3
"""NEXUS OS の waybar 用ローカルstatsリーダー。
/proc と nvidia-smi を読み取り専用で読み、localhost に JSON を出すだけ(書き込み一切なし)。
NEXUS(web)が http://127.0.0.1:8799/stats を2秒ごとに取得して表示する。

起動:  python3 ~/nexus/tools/nexus-stats.py   (止めるのは Ctrl-C)
ネイティブには一切触らない/書かない=安全。CPU/RAM/GPU/VRAM/温度/SWAP を返す。
"""
import json
import subprocess
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = 8799
_prev = {"idle": 0, "total": 0}
_net = {"rx": 0, "tx": 0, "t": 0.0}


def net() -> dict:
    try:
        rx = tx = 0
        with open("/proc/net/dev") as f:
            for line in f.readlines()[2:]:
                name, rest = line.split(":")
                if name.strip() == "lo":
                    continue
                cols = rest.split()
                rx += int(cols[0])
                tx += int(cols[8])
        now = time.time()
        dt = now - _net["t"] if _net["t"] else 0
        d = {
            "net_dn": round((rx - _net["rx"]) / dt) if dt > 0 else 0,
            "net_up": round((tx - _net["tx"]) / dt) if dt > 0 else 0,
        }
        _net.update(rx=rx, tx=tx, t=now)
        return d
    except Exception:
        return {"net_dn": -1, "net_up": -1}


def volume() -> int:
    for cmd in (["wpctl", "get-volume", "@DEFAULT_AUDIO_SINK@"], ["pactl", "get-sink-volume", "@DEFAULT_SINK@"]):
        try:
            out = subprocess.run(cmd, capture_output=True, text=True, timeout=1).stdout
            if "wpctl" in cmd[0]:
                # "Volume: 0.50 [MUTED]"
                v = float(out.split()[1])
                return 0 if "MUTED" in out else round(v * 100)
            import re
            m = re.search(r"(\d+)%", out)
            if m:
                return int(m.group(1))
        except Exception:
            continue
    return -1


def brightness() -> int:
    import glob as _g
    for base in _g.glob("/sys/class/backlight/*"):
        try:
            with open(f"{base}/brightness") as f:
                cur = int(f.read())
            with open(f"{base}/max_brightness") as f:
                mx = int(f.read())
            return round(100 * cur / mx) if mx else -1
        except Exception:
            pass
    return -1


def lan() -> int:
    # 1=有線/無線でcarrierあり, 0=リンクなし, -1=不明
    import glob as _g
    state = -1
    for base in _g.glob("/sys/class/net/*"):
        name = base.rsplit("/", 1)[1]
        if name == "lo":
            continue
        try:
            with open(f"{base}/carrier") as f:
                if f.read().strip() == "1":
                    return 1
            state = 0
        except Exception:
            pass
    return state


def battery() -> dict:
    import glob as _g
    for base in _g.glob("/sys/class/power_supply/BAT*"):
        try:
            with open(f"{base}/capacity") as f:
                cap = int(f.read())
            with open(f"{base}/status") as f:
                st = f.read().strip()
            return {"bat": cap, "charging": 1 if st == "Charging" else 0}
        except Exception:
            pass
    return {"bat": -1, "charging": 0}


def cpu_percent() -> int:
    try:
        with open("/proc/stat") as f:
            parts = f.readline().split()[1:]
        nums = list(map(int, parts))
        idle = nums[3] + nums[4]
        total = sum(nums)
        di = idle - _prev["idle"]
        dt = total - _prev["total"]
        _prev["idle"], _prev["total"] = idle, total
        return round(100 * (1 - di / dt)) if dt > 0 else 0
    except Exception:
        return -1


def mem() -> dict:
    info = {}
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                k, v, *_ = line.replace(":", "").split()
                info[k] = int(v)
        used = info["MemTotal"] - info.get("MemAvailable", info["MemFree"])
        ram = round(100 * used / info["MemTotal"])
        sw_t = info.get("SwapTotal", 0)
        swp = round(100 * (sw_t - info.get("SwapFree", 0)) / sw_t) if sw_t else 0
        return {"ram": ram, "swp": swp}
    except Exception:
        return {"ram": -1, "swp": 0}


def gpu() -> dict:
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=2,
        ).stdout.strip().split("\n")[0]
        g, mu, mt, temp = [x.strip() for x in out.split(",")]
        return {"gpu": int(g), "vram": round(100 * int(mu) / int(mt)), "temp": int(temp)}
    except Exception:
        return {"gpu": -1, "vram": -1, "temp": -1}


_weather = {"t": 0.0, "data": {"wtemp": -999, "wcode": -1}}


def weather() -> dict:
    import urllib.request
    if time.time() - _weather["t"] < 600:
        return _weather["data"]
    try:
        with urllib.request.urlopen("http://ip-api.com/json/?fields=lat,lon", timeout=3) as r:
            loc = json.load(r)
        lat, lon = loc["lat"], loc["lon"]
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,weather_code"
        with urllib.request.urlopen(url, timeout=3) as r:
            cur = json.load(r)["current"]
        d = {"wtemp": round(cur["temperature_2m"]), "wcode": cur["weather_code"]}
        _weather.update(t=time.time(), data=d)
        return d
    except Exception:
        _weather["t"] = time.time()  # 失敗も10分は再試行しない
        return _weather["data"]


class H(BaseHTTPRequestHandler):
    def do_GET(self):
        data = {
            "cpu": cpu_percent(), **mem(), **gpu(), **net(),
            "vol": volume(), "bright": brightness(), "lan": lan(),
            **battery(), **weather(), "t": int(time.time()),
        }
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    cpu_percent()  # prime
    print(f"NEXUS stats → http://127.0.0.1:{PORT}/stats  (Ctrl-C で停止)")
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
