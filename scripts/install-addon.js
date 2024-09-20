import fs from "fs/promises";
import path from "path";
import os from "os";

const sourceDir = path.join(process.cwd(), "addon");
let targetDir;

if (process.platform === "win32") {
  targetDir = path.join(
    os.homedir(),
    "AppData",
    "Local",
    "FileMaker",
    "Extensions",
    "AddonModules"
  );
} else if (process.platform === "darwin") {
  targetDir = path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "FileMaker",
    "Extensions",
    "AddonModules"
  );
} else {
  console.error("Unsupported operating system");
  process.exit(1);
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function installAddon() {
  try {
    // Check if FileMaker folder exists
    const fileMakerDir = path.dirname(path.dirname(targetDir));
    try {
      await fs.access(fileMakerDir);
    } catch (error) {
      console.error(
        "FileMaker folder not found. Please make sure FileMaker is installed."
      );
      process.exit(1);
    }

    await copyDir(sourceDir, targetDir);
    console.log("NextAuth addon installed successfully!");
  } catch (error) {
    console.error("Error installing NextAuth addon:", error);
    process.exit(1);
  }
}

installAddon();
