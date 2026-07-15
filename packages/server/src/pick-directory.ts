import { spawnSync } from "node:child_process";

type DirectoryPickerResult =
  | { path: string }
  | { cancelled: true }
  | { unavailable: true };

function parseChildProcessErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  const code = (error as NodeJS.ErrnoException).code;
  return typeof code === "string" ? code : null;
}

function runDirectoryPicker(
  command: string,
  args: readonly string[],
): DirectoryPickerResult {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (parseChildProcessErrorCode(result.error) === "ENOENT") {
    return { unavailable: true };
  }
  if (result.error) {
    throw new Error(result.error.message || String(result.error));
  }
  if (result.status !== 0) {
    const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";
    if (
      stderr.toLowerCase().includes("user cancel") ||
      stderr.includes("(-128)")
    ) {
      return { cancelled: true };
    }
    if (stderr) throw new Error(stderr);
    return { cancelled: true };
  }
  const selectedPath =
    typeof result.stdout === "string" ? result.stdout.trim() : "";
  return selectedPath ? { path: selectedPath } : { cancelled: true };
}

/**
 * Open a native OS folder dialog and return the selected path.
 * Returns null when the user cancels. Throws when no picker is available.
 */
export function pickProjectDirectoryFromSystemDialog(): string | null {
  if (process.platform === "darwin") {
    const result = runDirectoryPicker("osascript", [
      "-e",
      'POSIX path of (choose folder with prompt "Select a Beancount Studio project folder")',
    ]);
    if ("path" in result) return result.path;
    if ("cancelled" in result) return null;
    throw new Error(
      'Could not open directory picker. Command "osascript" is not available.',
    );
  }

  if (process.platform === "linux") {
    const candidates: Array<readonly [string, readonly string[]]> = [
      [
        "zenity",
        [
          "--file-selection",
          "--directory",
          "--title=Select Beancount Studio project folder",
        ],
      ],
      [
        "kdialog",
        [
          "--getexistingdirectory",
          process.cwd(),
          "Select Beancount Studio project folder",
        ],
      ],
    ];
    for (const [command, args] of candidates) {
      const result = runDirectoryPicker(command, args);
      if ("unavailable" in result) continue;
      if ("path" in result) return result.path;
      return null;
    }
    throw new Error(
      'Could not open directory picker. Install "zenity" or "kdialog" and try again.',
    );
  }

  if (process.platform === "win32") {
    const script = [
      "$ErrorActionPreference = 'Stop'",
      "Add-Type -AssemblyName System.Windows.Forms",
      "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
      "$dialog.Description = 'Select a Beancount Studio project folder'",
      "$dialog.ShowNewFolderButton = $false",
      "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.SelectedPath) }",
    ].join("; ");
    for (const command of ["powershell", "pwsh"]) {
      const result = runDirectoryPicker(command, [
        "-NoProfile",
        "-STA",
        "-Command",
        script,
      ]);
      if ("unavailable" in result) continue;
      if ("path" in result) return result.path;
      return null;
    }
    throw new Error(
      "Could not open directory picker. Install PowerShell and try again.",
    );
  }

  return null;
}
