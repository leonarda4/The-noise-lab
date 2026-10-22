import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, beforeEach, test } from "node:test";
import { build } from "esbuild";

const storageKey = "emotional-noise-lab:favourites";
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const originalFetch = globalThis.fetch;

const loadPresetModule = async (development) => {
  const result = await build({
    entryPoints: ["src/utils/presets.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    define: { "import.meta.env.DEV": JSON.stringify(development) },
    plugins: [{
      name: "published-preset-url",
      setup(builder) {
        builder.onResolve({ filter: /presets\.json\?url$/ }, () => ({
          path: "published-presets",
          namespace: "test-asset",
        }));
        builder.onLoad({ filter: /.*/, namespace: "test-asset" }, () => ({
          contents: 'export default "/assets/presets-test.json";',
          loader: "js",
        }));
      },
    }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`);
};

const production = await loadPresetModule(false);
const development = await loadPresetModule(true);

const createStorage = (rejectThumbnails = false) => {
  const entries = new Map();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem(key, value) {
      if (rejectThumbnails && JSON.parse(value).presets.some((preset) => preset.thumbnail)) {
        throw new Error("Browser quota exceeded");
      }
      entries.set(key, value);
    },
  };
};

const installStorage = (storage = createStorage()) => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
  production.loadPresets();
  development.loadPresets();
};

const makeLibrary = (ids = ["first", "second"]) =>
  production.importPresetsFromText(JSON.stringify({
    tabs: ids.map((id) => ({ id: `tab-${id}`, name: `Tab ${id}`, createdAt: "2026-05-18T12:00:00Z" })),
    presets: ids.map((id) => ({
      id,
      name: `Recipe ${id}`,
      createdAt: "2026-05-18T12:00:00Z",
      tabId: `tab-${id}`,
      noise: {},
      gradient: {},
      color: {},
      thumbnail: `data:image/png;base64,${id}`,
    })),
  }));

beforeEach(() => {
  installStorage();
  globalThis.fetch = async () => { throw new Error("Unexpected network request"); };
});

after(() => {
  globalThis.fetch = originalFetch;
  if (originalStorage) {
    Object.defineProperty(globalThis, "localStorage", originalStorage);
  } else {
    delete globalThis.localStorage;
  }
});

test("production loads all committed recipes and tabs from the published asset", async () => {
  const committed = JSON.parse(await readFile(new URL("../data/presets.json", import.meta.url), "utf8"));
  const requests = [];
  globalThis.fetch = async (...args) => {
    requests.push(args);
    return { ok: true, json: async () => committed };
  };

  const shared = await production.loadSharedPresets();
  const library = production.mergePublishedPresets(shared, production.loadPresets());

  assert.equal(production.repoPresetSyncEnabled, false);
  assert.deepEqual(requests, [["/assets/presets-test.json", undefined]]);
  assert.deepEqual(library.presets.map((preset) => preset.id), committed.presets.map((preset) => preset.id));
  assert.deepEqual(library.tabs, committed.tabs);
  assert.ok(library.presets.every((preset) => preset.thumbnail));
});

test("the first published load preserves existing browser recipes, edits, and tabs", () => {
  const shared = makeLibrary();
  const cached = makeLibrary(["first", "personal"]);
  cached.presets[0].name = "My renamed recipe";
  cached.presets[0].tabId = "tab-personal";
  delete cached.presets[0].thumbnail;
  cached.tabs[0].name = "My renamed tab";
  localStorage.setItem(storageKey, JSON.stringify(cached));

  const library = production.mergePublishedPresets(shared, production.loadPresets());

  assert.deepEqual(library.presets.map((preset) => preset.id), ["first", "personal", "second"]);
  assert.equal(library.presets[0].name, "My renamed recipe");
  assert.equal(library.presets[0].tabId, "tab-personal");
  assert.equal(library.presets[0].thumbnail, shared.presets[0].thumbnail);
  assert.equal(library.tabs[0].name, "My renamed tab");
});

test("deletions survive reloads while later deployments add new recipe and tab IDs", () => {
  const shared = makeLibrary();
  const initial = production.mergePublishedPresets(shared, production.loadPresets());
  production.savePresets(initial);
  const edited = {
    tabs: [{ ...initial.tabs[0], name: "My tab" }],
    presets: [{ ...initial.presets[0], name: "My recipe" }],
  };
  production.savePresets(edited);

  const reloaded = production.mergePublishedPresets(shared, production.loadPresets());
  assert.deepEqual(reloaded.presets.map((preset) => preset.id), ["first"]);
  assert.deepEqual(reloaded.tabs.map((tab) => tab.id), ["tab-first"]);
  assert.equal(reloaded.presets[0].name, "My recipe");

  const nextDeployment = makeLibrary(["first", "second", "new"]);
  const updated = production.mergePublishedPresets(nextDeployment, production.loadPresets());
  assert.deepEqual(updated.presets.map((preset) => preset.id), ["first", "new"]);
  assert.deepEqual(updated.tabs.map((tab) => tab.id), ["tab-first", "tab-new"]);
  assert.equal(updated.presets[1].tabId, "tab-new");
  assert.equal(updated.tabs[0].name, "My tab");
  production.savePresets(updated);
  assert.deepEqual(
    production.mergePublishedPresets(nextDeployment, production.loadPresets()),
    updated,
  );

  production.savePresets({ tabs: [], presets: [] });
  assert.deepEqual(
    production.mergePublishedPresets(nextDeployment, production.loadPresets()),
    { tabs: [], presets: [] },
  );
});

test("storage fallback keeps published IDs and restores stripped thumbnails without reviving deletes", () => {
  installStorage(createStorage(true));
  const shared = makeLibrary();
  const initial = production.mergePublishedPresets(shared, production.loadPresets());
  initial.presets.pop();

  assert.equal(production.savePresets(initial), "without-thumbnails");
  const stored = JSON.parse(localStorage.getItem(storageKey));
  assert.deepEqual(stored.publishedPresetIds.presets, ["first", "second"]);
  assert.equal(stored.presets[0].thumbnail, undefined);

  const restored = production.mergePublishedPresets(shared, production.loadPresets());
  assert.deepEqual(restored.presets.map((preset) => preset.id), ["first"]);
  assert.equal(restored.presets[0].thumbnail, shared.presets[0].thumbnail);
});

test("production never posts browser changes to the repository API", async () => {
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    return { ok: true };
  };
  assert.equal(await production.syncRepoPresets(makeLibrary()), false);
  assert.equal(requestCount, 0);
});

test("development retains repository reads and writes", async () => {
  const library = makeLibrary();
  const requests = [];
  globalThis.fetch = async (...args) => {
    requests.push(args);
    return { ok: true, json: async () => library };
  };

  assert.equal(development.repoPresetSyncEnabled, true);
  assert.deepEqual(await development.loadSharedPresets(), library);
  assert.equal(await development.syncRepoPresets(library), true);
  assert.deepEqual(requests[0], ["/api/presets", { cache: "no-store" }]);
  assert.equal(requests[1][0], "/api/presets");
  assert.equal(requests[1][1].method, "POST");
  assert.deepEqual(JSON.parse(requests[1][1].body).presets, library.presets);
  development.savePresets(library);
  assert.equal(JSON.parse(localStorage.getItem(storageKey)).publishedPresetIds, undefined);
});

test("an unavailable published asset leaves the browser fallback available", async () => {
  const cached = makeLibrary(["personal"]);
  production.savePresets(cached);
  globalThis.fetch = async () => ({ ok: false });
  assert.equal(await production.loadSharedPresets(), null);
  assert.deepEqual(production.loadPresets(), cached);
});
