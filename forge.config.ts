import fs from 'node:fs/promises';
import path from 'node:path';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

// Electron Packager appends the platform-specific extension itself
// (.icns on macOS, .ico on Windows, .png on Linux) — see assets/icons/.
const iconPath = path.join(__dirname, 'assets/icons/icon');

// Native modules kept `external` in vite.main.config.ts. The Forge Vite
// plugin ships only the .vite build output (no node_modules), so these must
// be copied into the package by the packageAfterCopy hook below.
// better-sqlite3 v13 is self-contained at runtime (bundled prebuilds, no
// runtime npm dependencies), so copying its folder is sufficient.
const EXTERNAL_NATIVE_MODULES = ['better-sqlite3'];

const config: ForgeConfig = {
  hooks: {
    packageAfterCopy: async (_forgeConfig, buildPath) => {
      for (const name of EXTERNAL_NATIVE_MODULES) {
        await fs.cp(
          path.join(__dirname, 'node_modules', name),
          path.join(buildPath, 'node_modules', name),
          { recursive: true, dereference: true },
        );
      }
    },
  },
  packagerConfig: {
    asar: true,
    icon: iconPath,
    // Bundled so main.ts can set the window/Dock icon at runtime (the OS
    // package icon alone doesn't update an already-running app's Dock icon
    // in dev, and the raw src/assets/logo.png isn't copied into the Vite
    // main-process build output).
    extraResource: ['assets/icons/icon.png', 'dist/web'],
  },
  rebuildConfig: {},
  makers: [
    // The Squirrel Setup.exe can only be assembled on Windows (electron-
    // winstaller needs Mono + Wine elsewhere). On other hosts, win32 targets
    // fall back to a portable ZIP: unzip on the PC and run the .exe inside.
    ...(process.platform === 'win32'
      ? [new MakerSquirrel({ setupIcon: `${iconPath}.ico` })]
      : []),
    new MakerZIP(
      {},
      process.platform === 'win32' ? ['darwin'] : ['darwin', 'win32'],
    ),
    new MakerRpm({
      options: { icon: `${iconPath}.png` },
    }),
    new MakerDeb({
      options: { icon: `${iconPath}.png` },
    }),
  ],
  plugins: [
    // better-sqlite3 ships a native .node binding — must be unpacked from asar.
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
