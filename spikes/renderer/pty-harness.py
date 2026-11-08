"""F00-T03 only: native ConPTY/Linux PTY evidence, no synthetic stdin events."""
import argparse
import ctypes
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import threading
import time


def save(path, value):
    Path(path).write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def modes():
    if os.name == "nt":
        kernel = ctypes.windll.kernel32
        kernel.GetStdHandle.restype = ctypes.c_void_p
        values = []
        for stream in (-10, -11):
            value = ctypes.c_ulong()
            if not kernel.GetConsoleMode(ctypes.c_void_p(kernel.GetStdHandle(stream)), ctypes.byref(value)):
                raise ctypes.WinError()
            values.append(value.value)
        return values
    import termios
    return repr(termios.tcgetattr(0))


def child(config_path):
    config = json.loads(Path(config_path).read_text())
    before = modes()
    with open(config["stderr"], "wb") as error:
        result = subprocess.run(config["command"], cwd=config["cwd"], stderr=error)
    after = modes()
    save(config["terminal"], {"before": before, "after": after, "restored": before == after, "exitCode": result.returncode})


class Terminal:
    def __init__(self, command, env):
        self.output = ""
        if os.name == "nt":
            from winpty import PtyProcess
            self.proc = PtyProcess.spawn(command, dimensions=(30, 120), env=env, backend=0)
        else:
            import pty
            self.pid, self.fd = pty.fork()
            if self.pid == 0:
                self.resize(120)
                os.execvpe(command[0], command, env)
        self.reader = threading.Thread(target=self.read, daemon=True)
        self.reader.start()

    def read(self):
        try:
            while True:
                data = self.proc.read(65536) if os.name == "nt" else os.read(self.fd, 65536).decode("utf-8", errors="replace")
                if not data:
                    return
                self.output += data
        except (EOFError, OSError):
            pass

    def write(self, data):
        if os.name == "nt":
            self.proc.write(data)
        else:
            os.write(self.fd, data.encode())

    def resize(self, columns):
        if os.name == "nt":
            self.proc.setwinsize(30, columns)
        else:
            import fcntl
            import struct
            import termios
            fcntl.ioctl(self.fd if hasattr(self, "fd") else 0, termios.TIOCSWINSZ, struct.pack("HHHH", 30, columns, 0, 0))

    def close(self):
        if os.name == "nt":
            self.proc.close(force=True)
        else:
            import signal
            if os.waitpid(self.pid, os.WNOHANG)[0] == 0:
                os.kill(self.pid, signal.SIGKILL)
                os.waitpid(self.pid, 0)
            os.close(self.fd)
        self.reader.join(timeout=2)


def wait_for(predicate, seconds=10):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(0.02)
    return False


def validate(metrics, terminal, control):
    return (metrics is not None and terminal.get("restored") and terminal.get("exitCode") == 0
            and len(metrics["samplesMs"]) == 100 and metrics["unanswered"] == 0
            and metrics["ticks"] > 10 and metrics["submits"] == 2
            and 80 in metrics["widths"] and metrics["widths"][-1] == 120
            and metrics["exitControl"] == control and metrics["rawRestored"]
            and metrics["listenersRestored"] and metrics["error"] is None)


def controls_restored(output):
    for mode, expected in ((25, "h"), (1049, "l"), (2004, "l"), (2026, "l")):
        changes = re.findall(rf"\x1b\[\?{mode}([hl])", output)
        if changes and changes[-1] != expected:
            return False
    kitty = re.findall(r"\x1b\[([<>])[0-9]*u", output)
    modify = re.findall(r"\x1b\[>4;([0-9])m", output)
    return (not kitty or kitty[-1] == "<") and (not modify or modify[-1] == "0")


def session(args, root, directory, backend, mode, control, failure=False):
    name = f"{backend}-{mode}-{control}" + ("-failure" if failure else "")
    prefix = args.output / name
    command = [args.bun, str(root / "spikes" / "renderer" / f"{backend}-entry.ts")] if mode == "source" else [str(directory / f"{backend}-spike{'.exe' if os.name == 'nt' else ''}")]
    config = {"command": command, "cwd": str(root if mode == "source" else directory),
              "stderr": str(prefix) + ".stderr", "terminal": str(prefix) + ".terminal.json"}
    config_path = str(prefix) + ".config.json"
    save(config_path, config)
    env = {**os.environ, "TERM": "xterm-256color", "RENDERER_SPIKE_FAIL": "1" if failure else "0"}
    launch = [sys.executable, str(Path(__file__).resolve()), "--child", config_path]
    if args.rtk:
        launch = [args.rtk, "run", "-c", subprocess.list2cmdline(launch) if os.name == "nt" else shlex.join(launch)]
    terminal = Terminal(launch, env)
    terminal_result = Path(config["terminal"])
    ready = wait_for(lambda: "token-" in terminal.output or terminal_result.exists())
    if ready and not terminal_result.exists() and not failure:
        for index in range(100):
            terminal.write(chr(97 + index % 26))
            time.sleep(0.07)
            if (index + 1) % 50 == 0:
                terminal.write("\r")
                time.sleep(0.12)
        terminal.resize(80)
        time.sleep(0.35)
        terminal.resize(120)
        time.sleep(0.35)
        terminal.write("\x1b" if control == "escape" else "\x03")
    finished = wait_for(terminal_result.exists)
    time.sleep(0.1)
    output = terminal.output
    terminal.close()
    Path(str(prefix) + ".pty.log").write_text(output, encoding="utf-8")
    terminal_data = json.loads(terminal_result.read_text()) if finished else {"timeout": True}
    metrics = None
    for line in Path(config["stderr"]).read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith('{"kind":'):
            metrics = json.loads(line)
    success = validate(metrics, terminal_data, control) and controls_restored(output)
    if failure:
        success = bool(metrics and metrics["error"] == "Injected lifecycle failure" and terminal_data.get("restored") and terminal_data.get("exitCode") != 0 and metrics["listenersRestored"] and metrics["rawRestored"])
    success = success and controls_restored(output)
    result = {"name": name, "success": bool(success), "terminal": terminal_data, "metrics": metrics,
              "controlsRestored": controls_restored(output), "launch": launch, "rawOutput": str(prefix) + ".pty.log"}
    save(str(prefix) + ".result.json", result)
    print(json.dumps({"name": name, "success": bool(success), "p95": metrics and metrics["inputToWriteP95Ms"], "samples": metrics and len(metrics["samplesMs"]), "exit": terminal_data.get("exitCode")} ), flush=True)
    return result


def self_test():
    good = dict(samplesMs=[1] * 100, unanswered=0, ticks=20, submits=2, widths=[120, 80, 120], exitControl="escape", rawRestored=True, listenersRestored=True, error=None)
    terminal = dict(restored=True, exitCode=0)
    assert validate(good, terminal, "escape")
    for key, value in [("samplesMs", [1] * 99), ("unanswered", 1), ("widths", [120]), ("submits", 1), ("listenersRestored", False)]:
        assert not validate({**good, key: value}, terminal, "escape")
    assert not validate(good, {**terminal, "restored": False}, "escape")
    assert not validate(None, terminal, "escape")
    assert controls_restored("\x1b[?25l\x1b[?25h\x1b[>7u\x1b[<u\x1b[>4;2m\x1b[>4;0m")
    assert not controls_restored("\x1b[?25l")
    assert not controls_restored("\x1b[>7u")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--child")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--bun", default=shutil.which("bun"))
    parser.add_argument("--rtk")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.child:
        return child(args.child)
    self_test()
    if args.self_test:
        print("harness self-check passed")
        return
    args.output = args.output.resolve()
    args.output.mkdir(parents=True, exist_ok=True)
    root = Path(__file__).resolve().parents[2]
    builds = []
    with tempfile.TemporaryDirectory(prefix="lizzy-renderer-") as temporary:
        directory = Path(temporary)
        for backend in ("minimal", "pi"):
            for compiled in (False, True):
                suffix = (".exe" if os.name == "nt" else "") if compiled else ".js"
                artifact = directory / f"{backend}-spike{suffix}"
                command = [args.bun, "build", str(root / "spikes" / "renderer" / f"{backend}-entry.ts"), "--target=bun", "--outfile", str(artifact)]
                if compiled:
                    command.append("--compile")
                subprocess.run(([args.rtk, "proxy"] if args.rtk else []) + command, check=True, capture_output=True)
                builds.append({"command": command, "bytes": artifact.stat().st_size, "sha256": hashlib.sha256(artifact.read_bytes()).hexdigest()})
        environment = {"os": platform.platform(), "arch": platform.machine(), "python": platform.python_version(), "bun": subprocess.check_output([args.bun, "--version"], text=True).strip(),
                       "commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip(), "viewport": [120, 30], "terminal": "ConPTY (pywinpty 2.0.15)" if os.name == "nt" else "Linux PTY (Python stdlib)", "builds": builds}
        save(args.output / "environment.json", environment)
        results = [session(args, root, directory, backend, mode, control) for backend in ("minimal", "pi") for mode in ("source", "compiled") for control in ("escape", "ctrl+c")]
        results += [session(args, root, directory, backend, "source", "escape", failure=True) for backend in ("minimal", "pi")]
        save(args.output / "summary.json", results)
        # A candidate failure is valid evidence, but the owned candidate must work.
        if not all(result["success"] for result in results if result["name"].startswith("minimal")):
            raise SystemExit("Owned renderer did not meet the spike workload")


if __name__ == "__main__":
    main()
