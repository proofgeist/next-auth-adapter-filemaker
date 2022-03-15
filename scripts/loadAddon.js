import fs from "fs-extra";
import os from "os";
import path from "path";

function main() {
  //   return; // ignore this script until AddOn is ready
  let dir = "";
  if (process.platform === "darwin") {
    // Mac OS
    dir = path.join(os.homedir(), "/Library/Application Support");
  } else if (process.platform === "win32") {
    // Windows
    dir = path.join(os.homedir(), "/AppData/Local");
  } else {
    return;
  }

  dir = path.join(dir, "/FileMaker/Extensions/AddonModules");

  // skip if addon directoy doesn't exist
  if (!fs.existsSync(dir)) return;

  const addonFileName = "/NextAuth.fmaddon";
  const addonFolderName = "/NextAuth";
  fs.ensureDirSync(path.join(process.cwd(), "Addon", addonFolderName));

  const addOnFile = path.join(dir, addonFileName);
  const addOnFolder = path.join(dir, addonFolderName);
  fs.copyFileSync(addOnFile, path.join(process.cwd(), "Addon", addonFileName));
  fs.copySync(addOnFolder, path.join(process.cwd(), "Addon", addonFolderName));

  // copy image into proper place
  const imageFile = path.join(process.cwd(), "Addon", "image.png");
  fs.copyFileSync(
    imageFile,
    path.join(process.cwd(), "Addon", "NextAuth/icon.png")
  );
  fs.copyFileSync(
    imageFile,
    path.join(process.cwd(), "Addon", "NextAuth/icon@2x.png")
  );
  fs.copyFileSync(
    imageFile,
    path.join(process.cwd(), "Addon", "NextAuth/preview.png")
  );
}

main();
