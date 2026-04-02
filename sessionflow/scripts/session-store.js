/**
 * SessionFlow - Session Data Store
 * Encapsulates all CRUD operations on the sessions array.
 * @module session-store
 */

const MODULE_ID = 'sessionflow';
const SETTING_KEY = 'sessions';

/* ---------------------------------------- */
/*  Read Operations                         */
/* ---------------------------------------- */

/**
 * Get all sessions, sorted by number.
 * @returns {object[]}
 */
export function getSessions() {
  const sessions = game.settings.get(MODULE_ID, SETTING_KEY) ?? [];
  return [...sessions].sort((a, b) => a.number - b.number);
}

/**
 * Get a single session by ID.
 * @param {string} id
 * @returns {object|undefined}
 */
export function getSession(id) {
  const sessions = game.settings.get(MODULE_ID, SETTING_KEY) ?? [];
  return sessions.find(s => s.id === id);
}

/**
 * Calculate the next sequential session number.
 * @returns {number}
 */
export function getNextSessionNumber() {
  const sessions = getSessions();
  if (!sessions.length) return 1;
  return Math.max(...sessions.map(s => s.number)) + 1;
}

/* ---------------------------------------- */
/*  Write Operations                        */
/* ---------------------------------------- */

/**
 * Create a new session with the given data.
 * @param {object} data
 * @param {string} [data.name]
 * @param {string} [data.icon]
 * @param {string} [data.color]
 * @returns {Promise<object>} The created session.
 */
export async function createSession({ name, icon, color } = {}) {
  const sessions = game.settings.get(MODULE_ID, SETTING_KEY) ?? [];
  const number = getNextSessionNumber();

  const session = {
    id: foundry.utils.randomID(),
    number,
    name: name || `${game.i18n.localize('SESSIONFLOW.Panel.DefaultSessionName')} ${number}`,
    icon: icon || 'fa-solid fa-book-open',
    color: color || '#7c5cbf',
    createdAt: Date.now()
  };

  sessions.push(session);
  await game.settings.set(MODULE_ID, SETTING_KEY, sessions);
  return session;
}

/**
 * Update an existing session with partial changes.
 * @param {string} id - Session ID.
 * @param {object} changes - Partial session data to merge.
 * @returns {Promise<object|null>} The updated session, or null if not found.
 */
export async function updateSession(id, changes) {
  const sessions = game.settings.get(MODULE_ID, SETTING_KEY) ?? [];
  const index = sessions.findIndex(s => s.id === id);
  if (index === -1) return null;

  sessions[index] = { ...sessions[index], ...changes };
  await game.settings.set(MODULE_ID, SETTING_KEY, sessions);
  return sessions[index];
}

/**
 * Delete a session by ID.
 * @param {string} id
 * @returns {Promise<boolean>} True if deleted, false if not found.
 */
export async function deleteSession(id) {
  const sessions = game.settings.get(MODULE_ID, SETTING_KEY) ?? [];
  const filtered = sessions.filter(s => s.id !== id);
  if (filtered.length === sessions.length) return false;

  await game.settings.set(MODULE_ID, SETTING_KEY, filtered);
  return true;
}

/**
 * Reorder sessions by applying new number values based on array order.
 * @param {string[]} sessionIds - Session IDs in the desired display order.
 * @returns {Promise<boolean>} True if reordered.
 */
export async function reorderSessions(sessionIds) {
  const sessions = game.settings.get(MODULE_ID, SETTING_KEY) ?? [];
  for (let i = 0; i < sessionIds.length; i++) {
    const session = sessions.find(s => s.id === sessionIds[i]);
    if (session) session.number = i + 1;
  }
  await game.settings.set(MODULE_ID, SETTING_KEY, sessions);
  return true;
}

/* ---------------------------------------- */
/*  Beat Operations                         */
/* ---------------------------------------- */

/**
 * Get all beats for a session, sorted by order.
 * @param {string} sessionId
 * @returns {object[]}
 */
export function getBeats(sessionId) {
  const session = getSession(sessionId);
  if (!session) return [];
  return [...(session.beats ?? [])].sort((a, b) => a.order - b.order);
}

/**
 * Create a new beat within a session.
 * @param {string} sessionId
 * @param {object} data
 * @param {string} [data.title]
 * @param {string} [data.text]
 * @param {string} [data.image]
 * @returns {Promise<object|null>} The created beat, or null if session not found.
 */
export async function createBeat(sessionId, { title, text, image, color } = {}) {
  const sessions = game.settings.get(MODULE_ID, SETTING_KEY) ?? [];
  const index = sessions.findIndex(s => s.id === sessionId);
  if (index === -1) return null;

  const beats = sessions[index].beats ?? [];
  const order = beats.length > 0 ? Math.max(...beats.map(b => b.order)) + 1 : 0;

  const beat = {
    id: foundry.utils.randomID(),
    title: title || '',
    text: text || '',
    image: image || '',
    color: color || '',
    order,
    createdAt: Date.now()
  };

  beats.push(beat);
  sessions[index] = { ...sessions[index], beats };
  await game.settings.set(MODULE_ID, SETTING_KEY, sessions);
  return beat;
}

/**
 * Update a beat within a session.
 * @param {string} sessionId
 * @param {string} beatId
 * @param {object} changes - Partial beat data to merge.
 * @returns {Promise<object|null>} The updated beat, or null if not found.
 */
export async function updateBeat(sessionId, beatId, changes) {
  const sessions = game.settings.get(MODULE_ID, SETTING_KEY) ?? [];
  const sIndex = sessions.findIndex(s => s.id === sessionId);
  if (sIndex === -1) return null;

  const beats = sessions[sIndex].beats ?? [];
  const bIndex = beats.findIndex(b => b.id === beatId);
  if (bIndex === -1) return null;

  beats[bIndex] = { ...beats[bIndex], ...changes };
  sessions[sIndex] = { ...sessions[sIndex], beats };
  await game.settings.set(MODULE_ID, SETTING_KEY, sessions);
  return beats[bIndex];
}

/**
 * Delete a beat from a session.
 * @param {string} sessionId
 * @param {string} beatId
 * @returns {Promise<boolean>} True if deleted, false if not found.
 */
export async function deleteBeat(sessionId, beatId) {
  const sessions = game.settings.get(MODULE_ID, SETTING_KEY) ?? [];
  const sIndex = sessions.findIndex(s => s.id === sessionId);
  if (sIndex === -1) return false;

  const beats = sessions[sIndex].beats ?? [];
  const filtered = beats.filter(b => b.id !== beatId);
  if (filtered.length === beats.length) return false;

  sessions[sIndex] = { ...sessions[sIndex], beats: filtered };
  await game.settings.set(MODULE_ID, SETTING_KEY, sessions);
  return true;
}

/**
 * Reorder beats within a session by applying new order values.
 * @param {string} sessionId
 * @param {string[]} beatIds - Beat IDs in the desired display order.
 * @returns {Promise<boolean>} True if reordered, false if session not found.
 */
export async function reorderBeats(sessionId, beatIds) {
  const sessions = game.settings.get(MODULE_ID, SETTING_KEY) ?? [];
  const sIndex = sessions.findIndex(s => s.id === sessionId);
  if (sIndex === -1) return false;

  const beats = sessions[sIndex].beats ?? [];
  for (let i = 0; i < beatIds.length; i++) {
    const beat = beats.find(b => b.id === beatIds[i]);
    if (beat) beat.order = i;
  }

  sessions[sIndex] = { ...sessions[sIndex], beats };
  await game.settings.set(MODULE_ID, SETTING_KEY, sessions);
  return true;
}

/* ---------------------------------------- */
/*  Scene Operations                        */
/* ---------------------------------------- */

/**
 * Get all scenes for a beat, sorted by order.
 * @param {string} sessionId
 * @param {string} beatId
 * @returns {object[]}
 */
export function getScenes(sessionId, beatId) {
  const session = getSession(sessionId);
  if (!session) return [];

  const beat = (session.beats ?? []).find(b => b.id === beatId);
  if (!beat) return [];

  return [...(beat.scenes ?? [])].sort((a, b) => a.order - b.order);
}

/**
 * Create a new scene within a beat.
 * @param {string} sessionId
 * @param {string} beatId
 * @param {object} data
 * @param {string} [data.title]
 * @param {string} [data.exaltedSceneId]
 * @returns {Promise<object|null>} The created scene, or null if not found.
 */
export async function createScene(sessionId, beatId, { title, exaltedSceneId } = {}) {
  const sessions = game.settings.get(MODULE_ID, SETTING_KEY) ?? [];
  const sIndex = sessions.findIndex(s => s.id === sessionId);
  if (sIndex === -1) return null;

  const beats = sessions[sIndex].beats ?? [];
  const bIndex = beats.findIndex(b => b.id === beatId);
  if (bIndex === -1) return null;

  const scenes = beats[bIndex].scenes ?? [];
  const order = scenes.length > 0 ? Math.max(...scenes.map(sc => sc.order)) + 1 : 0;

  const scene = {
    id: foundry.utils.randomID(),
    title: title || '',
    exaltedSceneId: exaltedSceneId || '',
    order,
    createdAt: Date.now()
  };

  scenes.push(scene);
  beats[bIndex] = { ...beats[bIndex], scenes };
  sessions[sIndex] = { ...sessions[sIndex], beats };
  await game.settings.set(MODULE_ID, SETTING_KEY, sessions);
  return scene;
}

/**
 * Update a scene within a beat.
 * @param {string} sessionId
 * @param {string} beatId
 * @param {string} sceneId
 * @param {object} changes - Partial scene data to merge.
 * @returns {Promise<object|null>} The updated scene, or null if not found.
 */
export async function updateScene(sessionId, beatId, sceneId, changes) {
  const sessions = game.settings.get(MODULE_ID, SETTING_KEY) ?? [];
  const sIndex = sessions.findIndex(s => s.id === sessionId);
  if (sIndex === -1) return null;

  const beats = sessions[sIndex].beats ?? [];
  const bIndex = beats.findIndex(b => b.id === beatId);
  if (bIndex === -1) return null;

  const scenes = beats[bIndex].scenes ?? [];
  const scIndex = scenes.findIndex(sc => sc.id === sceneId);
  if (scIndex === -1) return null;

  scenes[scIndex] = { ...scenes[scIndex], ...changes };
  beats[bIndex] = { ...beats[bIndex], scenes };
  sessions[sIndex] = { ...sessions[sIndex], beats };
  await game.settings.set(MODULE_ID, SETTING_KEY, sessions);
  return scenes[scIndex];
}

/**
 * Delete a scene from a beat.
 * @param {string} sessionId
 * @param {string} beatId
 * @param {string} sceneId
 * @returns {Promise<boolean>} True if deleted, false if not found.
 */
export async function deleteScene(sessionId, beatId, sceneId) {
  const sessions = game.settings.get(MODULE_ID, SETTING_KEY) ?? [];
  const sIndex = sessions.findIndex(s => s.id === sessionId);
  if (sIndex === -1) return false;

  const beats = sessions[sIndex].beats ?? [];
  const bIndex = beats.findIndex(b => b.id === beatId);
  if (bIndex === -1) return false;

  const scenes = beats[bIndex].scenes ?? [];
  const filtered = scenes.filter(sc => sc.id !== sceneId);
  if (filtered.length === scenes.length) return false;

  beats[bIndex] = { ...beats[bIndex], scenes: filtered };
  sessions[sIndex] = { ...sessions[sIndex], beats };
  await game.settings.set(MODULE_ID, SETTING_KEY, sessions);
  return true;
}

/* ---------------------------------------- */
/*  Canvas Operations                       */
/* ---------------------------------------- */

/**
 * Update canvas layout for a scene (widget positions, sizes, z-index, panel height).
 * Separate from updateScene to avoid race conditions between frequent canvas saves
 * and rare metadata edits.
 * @param {string} sessionId
 * @param {string} beatId
 * @param {string} sceneId
 * @param {object} changes - { widgets?, canvasHeight?, nextZIndex? }
 * @returns {Promise<object|null>} The updated scene, or null if not found.
 */
export async function updateSceneCanvas(sessionId, beatId, sceneId, changes) {
  const sessions = game.settings.get(MODULE_ID, SETTING_KEY) ?? [];
  const sIndex = sessions.findIndex(s => s.id === sessionId);
  if (sIndex === -1) return null;

  const beats = sessions[sIndex].beats ?? [];
  const bIndex = beats.findIndex(b => b.id === beatId);
  if (bIndex === -1) return null;

  const scenes = beats[bIndex].scenes ?? [];
  const scIndex = scenes.findIndex(sc => sc.id === sceneId);
  if (scIndex === -1) return null;

  // Only merge canvas-specific fields
  const canvasFields = {};
  if (changes.widgets !== undefined) canvasFields.widgets = changes.widgets;
  if (changes.canvasHeight !== undefined) canvasFields.canvasHeight = changes.canvasHeight;
  if (changes.nextZIndex !== undefined) canvasFields.nextZIndex = changes.nextZIndex;

  scenes[scIndex] = { ...scenes[scIndex], ...canvasFields };
  beats[bIndex] = { ...beats[bIndex], scenes };
  sessions[sIndex] = { ...sessions[sIndex], beats };
  await game.settings.set(MODULE_ID, SETTING_KEY, sessions);
  return scenes[scIndex];
}

/* ---------------------------------------- */
/*  Scene Page Operations                   */
/* ---------------------------------------- */

/**
 * Resolve the active page data for a scene, handling backward compatibility.
 * If the scene has no pages array, returns the flat widget data as a single implicit page.
 * @param {object} scene - The scene object.
 * @param {string|null} [pageId=null] - Specific page ID, or null for active/first.
 * @returns {{ pageId: string|null, widgets: object[], canvasHeight: number, nextZIndex: number, pages: object[] }}
 */
export function resolveScenePageData(scene, pageId = null) {
  if (!scene) return { pageId: null, widgets: [], canvasHeight: 420, nextZIndex: 2, pages: [] };

  const pages = scene.pages ?? [];

  // No pages array → single implicit page from flat fields
  if (!pages.length) {
    return {
      pageId: null,
      widgets: scene.widgets ?? [],
      canvasHeight: scene.canvasHeight ?? 420,
      nextZIndex: scene.nextZIndex ?? 2,
      pages: []
    };
  }

  // Find requested page, or active page, or first page
  const sorted = [...pages].sort((a, b) => a.order - b.order);
  const target = (pageId && sorted.find(p => p.id === pageId))
    || (scene.activePageId && sorted.find(p => p.id === scene.activePageId))
    || sorted[0];

  return {
    pageId: target.id,
    widgets: target.widgets ?? [],
    canvasHeight: target.canvasHeight ?? 420,
    nextZIndex: target.nextZIndex ?? 2,
    pages: sorted
  };
}

/**
 * Migrate a scene's flat widget data into pages array. Internal helper.
 * @param {object} scene - Scene object (mutated in place).
 * @returns {object} The first page created from flat data.
 */
function _migrateSceneToPages(scene) {
  const firstPage = {
    id: foundry.utils.randomID(),
    name: 'Page 1',
    icon: '',
    color: '',
    widgets: scene.widgets ?? [],
    canvasHeight: scene.canvasHeight ?? 420,
    nextZIndex: scene.nextZIndex ?? 2,
    order: 0
  };
  scene.pages = [firstPage];
  scene.activePageId = firstPage.id;
  return firstPage;
}

/**
 * Create a new page in a scene. Migrates flat data to pages if needed.
 * @param {string} sessionId
 * @param {string} beatId
 * @param {string} sceneId
 * @param {object} [data] - { name?, icon?, color? }
 * @returns {Promise<object|null>} The created page, or null if scene not found.
 */
export async function createScenePage(sessionId, beatId, sceneId, data = {}) {
  const sessions = game.settings.get(MODULE_ID, SETTING_KEY) ?? [];
  const sIndex = sessions.findIndex(s => s.id === sessionId);
  if (sIndex === -1) return null;

  const beats = sessions[sIndex].beats ?? [];
  const bIndex = beats.findIndex(b => b.id === beatId);
  if (bIndex === -1) return null;

  const scenes = beats[bIndex].scenes ?? [];
  const scIndex = scenes.findIndex(sc => sc.id === sceneId);
  if (scIndex === -1) return null;

  const scene = scenes[scIndex];

  // Migrate flat data if no pages yet
  if (!scene.pages?.length) _migrateSceneToPages(scene);

  const order = Math.max(...scene.pages.map(p => p.order), -1) + 1;
  const page = {
    id: foundry.utils.randomID(),
    name: data.name || `Page ${scene.pages.length + 1}`,
    icon: data.icon || '',
    color: data.color || '',
    widgets: data.widgets ?? [],
    canvasHeight: data.canvasHeight ?? 420,
    nextZIndex: data.nextZIndex ?? 2,
    order
  };

  scene.pages.push(page);
  scene.activePageId = page.id;
  scenes[scIndex] = scene;
  beats[bIndex] = { ...beats[bIndex], scenes };
  sessions[sIndex] = { ...sessions[sIndex], beats };
  await game.settings.set(MODULE_ID, SETTING_KEY, sessions);
  return page;
}

/**
 * Update a specific page's canvas data within a scene.
 * @param {string} sessionId
 * @param {string} beatId
 * @param {string} sceneId
 * @param {string} pageId
 * @param {object} changes - { widgets?, canvasHeight?, nextZIndex? }
 * @returns {Promise<object|null>}
 */
export async function updateScenePageCanvas(sessionId, beatId, sceneId, pageId, changes) {
  const sessions = game.settings.get(MODULE_ID, SETTING_KEY) ?? [];
  const sIndex = sessions.findIndex(s => s.id === sessionId);
  if (sIndex === -1) return null;

  const beats = sessions[sIndex].beats ?? [];
  const bIndex = beats.findIndex(b => b.id === beatId);
  if (bIndex === -1) return null;

  const scenes = beats[bIndex].scenes ?? [];
  const scIndex = scenes.findIndex(sc => sc.id === sceneId);
  if (scIndex === -1) return null;

  const scene = scenes[scIndex];
  const pages = scene.pages ?? [];
  const pIndex = pages.findIndex(p => p.id === pageId);
  if (pIndex === -1) return null;

  const canvasFields = {};
  if (changes.widgets !== undefined) canvasFields.widgets = changes.widgets;
  if (changes.canvasHeight !== undefined) canvasFields.canvasHeight = changes.canvasHeight;
  if (changes.nextZIndex !== undefined) canvasFields.nextZIndex = changes.nextZIndex;

  pages[pIndex] = { ...pages[pIndex], ...canvasFields };
  scene.pages = pages;
  scenes[scIndex] = scene;
  beats[bIndex] = { ...beats[bIndex], scenes };
  sessions[sIndex] = { ...sessions[sIndex], beats };
  await game.settings.set(MODULE_ID, SETTING_KEY, sessions);
  return pages[pIndex];
}

/**
 * Update page metadata (name, icon, color, order).
 * @param {string} sessionId
 * @param {string} beatId
 * @param {string} sceneId
 * @param {string} pageId
 * @param {object} changes - { name?, icon?, color?, order? }
 * @returns {Promise<object|null>}
 */
export async function updateScenePageMeta(sessionId, beatId, sceneId, pageId, changes) {
  const sessions = game.settings.get(MODULE_ID, SETTING_KEY) ?? [];
  const sIndex = sessions.findIndex(s => s.id === sessionId);
  if (sIndex === -1) return null;

  const beats = sessions[sIndex].beats ?? [];
  const bIndex = beats.findIndex(b => b.id === beatId);
  if (bIndex === -1) return null;

  const scenes = beats[bIndex].scenes ?? [];
  const scIndex = scenes.findIndex(sc => sc.id === sceneId);
  if (scIndex === -1) return null;

  const scene = scenes[scIndex];
  const pages = scene.pages ?? [];
  const pIndex = pages.findIndex(p => p.id === pageId);
  if (pIndex === -1) return null;

  const metaFields = {};
  if (changes.name !== undefined) metaFields.name = changes.name;
  if (changes.icon !== undefined) metaFields.icon = changes.icon;
  if (changes.color !== undefined) metaFields.color = changes.color;
  if (changes.order !== undefined) metaFields.order = changes.order;

  pages[pIndex] = { ...pages[pIndex], ...metaFields };
  scene.pages = pages;
  scenes[scIndex] = scene;
  beats[bIndex] = { ...beats[bIndex], scenes };
  sessions[sIndex] = { ...sessions[sIndex], beats };
  await game.settings.set(MODULE_ID, SETTING_KEY, sessions);
  return pages[pIndex];
}

/**
 * Delete a page from a scene. If only one page remains, un-migrates back to flat data.
 * @param {string} sessionId
 * @param {string} beatId
 * @param {string} sceneId
 * @param {string} pageId
 * @returns {Promise<{ deleted: boolean, remainingPages: object[], activePageId: string|null }>}
 */
export async function deleteScenePage(sessionId, beatId, sceneId, pageId) {
  const sessions = game.settings.get(MODULE_ID, SETTING_KEY) ?? [];
  const sIndex = sessions.findIndex(s => s.id === sessionId);
  if (sIndex === -1) return { deleted: false, remainingPages: [], activePageId: null };

  const beats = sessions[sIndex].beats ?? [];
  const bIndex = beats.findIndex(b => b.id === beatId);
  if (bIndex === -1) return { deleted: false, remainingPages: [], activePageId: null };

  const scenes = beats[bIndex].scenes ?? [];
  const scIndex = scenes.findIndex(sc => sc.id === sceneId);
  if (scIndex === -1) return { deleted: false, remainingPages: [], activePageId: null };

  const scene = scenes[scIndex];
  const pages = scene.pages ?? [];
  const filtered = pages.filter(p => p.id !== pageId);
  if (filtered.length === pages.length) return { deleted: false, remainingPages: pages, activePageId: scene.activePageId };

  if (filtered.length <= 1) {
    // Un-migrate: restore flat fields from the remaining page (or empty)
    const remaining = filtered[0];
    scene.widgets = remaining?.widgets ?? [];
    scene.canvasHeight = remaining?.canvasHeight ?? 420;
    scene.nextZIndex = remaining?.nextZIndex ?? 2;
    delete scene.pages;
    delete scene.activePageId;

    scenes[scIndex] = scene;
    beats[bIndex] = { ...beats[bIndex], scenes };
    sessions[sIndex] = { ...sessions[sIndex], beats };
    await game.settings.set(MODULE_ID, SETTING_KEY, sessions);
    return { deleted: true, remainingPages: [], activePageId: null };
  }

  // If deleted page was active, switch to first remaining
  const sorted = [...filtered].sort((a, b) => a.order - b.order);
  if (scene.activePageId === pageId) scene.activePageId = sorted[0].id;

  scene.pages = filtered;
  scenes[scIndex] = scene;
  beats[bIndex] = { ...beats[bIndex], scenes };
  sessions[sIndex] = { ...sessions[sIndex], beats };
  await game.settings.set(MODULE_ID, SETTING_KEY, sessions);
  return { deleted: true, remainingPages: sorted, activePageId: scene.activePageId };
}

/**
 * Reorder pages within a scene.
 * @param {string} sessionId
 * @param {string} beatId
 * @param {string} sceneId
 * @param {string[]} orderedPageIds
 * @returns {Promise<boolean>}
 */
export async function reorderScenePages(sessionId, beatId, sceneId, orderedPageIds) {
  const sessions = game.settings.get(MODULE_ID, SETTING_KEY) ?? [];
  const sIndex = sessions.findIndex(s => s.id === sessionId);
  if (sIndex === -1) return false;

  const beats = sessions[sIndex].beats ?? [];
  const bIndex = beats.findIndex(b => b.id === beatId);
  if (bIndex === -1) return false;

  const scenes = beats[bIndex].scenes ?? [];
  const scIndex = scenes.findIndex(sc => sc.id === sceneId);
  if (scIndex === -1) return false;

  const scene = scenes[scIndex];
  const pages = scene.pages ?? [];
  for (let i = 0; i < orderedPageIds.length; i++) {
    const page = pages.find(p => p.id === orderedPageIds[i]);
    if (page) page.order = i;
  }

  scene.pages = pages;
  scenes[scIndex] = scene;
  beats[bIndex] = { ...beats[bIndex], scenes };
  sessions[sIndex] = { ...sessions[sIndex], beats };
  await game.settings.set(MODULE_ID, SETTING_KEY, sessions);
  return true;
}

/**
 * Set the active page for a scene.
 * @param {string} sessionId
 * @param {string} beatId
 * @param {string} sceneId
 * @param {string} pageId
 * @returns {Promise<boolean>}
 */
export async function setSceneActivePage(sessionId, beatId, sceneId, pageId) {
  const sessions = game.settings.get(MODULE_ID, SETTING_KEY) ?? [];
  const sIndex = sessions.findIndex(s => s.id === sessionId);
  if (sIndex === -1) return false;

  const beats = sessions[sIndex].beats ?? [];
  const bIndex = beats.findIndex(b => b.id === beatId);
  if (bIndex === -1) return false;

  const scenes = beats[bIndex].scenes ?? [];
  const scIndex = scenes.findIndex(sc => sc.id === sceneId);
  if (scIndex === -1) return false;

  scenes[scIndex].activePageId = pageId;
  beats[bIndex] = { ...beats[bIndex], scenes };
  sessions[sIndex] = { ...sessions[sIndex], beats };
  await game.settings.set(MODULE_ID, SETTING_KEY, sessions);
  return true;
}

/* ---------------------------------------- */
/*  Character Canvas Operations             */
/* ---------------------------------------- */

const CHARACTER_SETTING_KEY = 'characterData';

/**
 * Get canvas data for a character.
 * @param {string} characterId - Exalted Scenes character ID.
 * @returns {{ widgets: object[], canvasHeight: number, nextZIndex: number }|null}
 */
export function getCharacterCanvas(characterId) {
  const data = game.settings.get(MODULE_ID, CHARACTER_SETTING_KEY) ?? {};
  return data[characterId] ?? null;
}

/**
 * Update canvas layout for a character (widget positions, sizes, z-index, panel height/width).
 * Creates the entry if it doesn't exist yet.
 * @param {string} characterId - Exalted Scenes character ID.
 * @param {object} changes - { widgets?, canvasHeight?, nextZIndex?, panelWidth? }
 * @returns {Promise<object>} The updated character canvas data.
 */
export async function updateCharacterCanvas(characterId, changes) {
  const data = game.settings.get(MODULE_ID, CHARACTER_SETTING_KEY) ?? {};
  const existing = data[characterId] ?? { widgets: [], canvasHeight: 420, nextZIndex: 2 };

  const canvasFields = {};
  if (changes.widgets !== undefined) canvasFields.widgets = changes.widgets;
  if (changes.canvasHeight !== undefined) canvasFields.canvasHeight = changes.canvasHeight;
  if (changes.nextZIndex !== undefined) canvasFields.nextZIndex = changes.nextZIndex;
  if (changes.panelWidth !== undefined) canvasFields.panelWidth = changes.panelWidth;

  data[characterId] = { ...existing, ...canvasFields };
  await game.settings.set(MODULE_ID, CHARACTER_SETTING_KEY, data);
  return data[characterId];
}

/* ---------------------------------------- */
/*  Character Page Operations               */
/* ---------------------------------------- */

/**
 * Resolve the active page data for a character, handling backward compatibility.
 * @param {object|null} charData - The character canvas data.
 * @param {string|null} [pageId=null] - Specific page ID, or null for active/first.
 * @returns {{ pageId: string|null, widgets: object[], canvasHeight: number, nextZIndex: number, pages: object[] }}
 */
export function resolveCharacterPageData(charData, pageId = null) {
  if (!charData) return { pageId: null, widgets: [], canvasHeight: 420, nextZIndex: 2, pages: [] };

  const pages = charData.pages ?? [];

  if (!pages.length) {
    return {
      pageId: null,
      widgets: charData.widgets ?? [],
      canvasHeight: charData.canvasHeight ?? 420,
      nextZIndex: charData.nextZIndex ?? 2,
      pages: []
    };
  }

  const sorted = [...pages].sort((a, b) => a.order - b.order);
  const target = (pageId && sorted.find(p => p.id === pageId))
    || (charData.activePageId && sorted.find(p => p.id === charData.activePageId))
    || sorted[0];

  return {
    pageId: target.id,
    widgets: target.widgets ?? [],
    canvasHeight: target.canvasHeight ?? 420,
    nextZIndex: target.nextZIndex ?? 2,
    pages: sorted
  };
}

/**
 * Migrate character flat data into pages array. Internal helper.
 */
function _migrateCharacterToPages(charData) {
  const firstPage = {
    id: foundry.utils.randomID(),
    name: 'Page 1',
    icon: '',
    color: '',
    widgets: charData.widgets ?? [],
    canvasHeight: charData.canvasHeight ?? 420,
    nextZIndex: charData.nextZIndex ?? 2,
    order: 0
  };
  charData.pages = [firstPage];
  charData.activePageId = firstPage.id;
  return firstPage;
}

/**
 * Create a new page for a character. Migrates flat data to pages if needed.
 * @param {string} characterId
 * @param {object} [data] - { name?, icon?, color? }
 * @returns {Promise<object|null>}
 */
export async function createCharacterPage(characterId, data = {}) {
  const allData = game.settings.get(MODULE_ID, CHARACTER_SETTING_KEY) ?? {};
  const charData = allData[characterId] ?? { widgets: [], canvasHeight: 420, nextZIndex: 2 };

  if (!charData.pages?.length) _migrateCharacterToPages(charData);

  const order = Math.max(...charData.pages.map(p => p.order), -1) + 1;
  const page = {
    id: foundry.utils.randomID(),
    name: data.name || `Page ${charData.pages.length + 1}`,
    icon: data.icon || '',
    color: data.color || '',
    widgets: data.widgets ?? [],
    canvasHeight: data.canvasHeight ?? 420,
    nextZIndex: data.nextZIndex ?? 2,
    order
  };

  charData.pages.push(page);
  charData.activePageId = page.id;
  allData[characterId] = charData;
  await game.settings.set(MODULE_ID, CHARACTER_SETTING_KEY, allData);
  return page;
}

/**
 * Update a specific page's canvas data for a character.
 * @param {string} characterId
 * @param {string} pageId
 * @param {object} changes - { widgets?, canvasHeight?, nextZIndex? }
 * @returns {Promise<object|null>}
 */
export async function updateCharacterPageCanvas(characterId, pageId, changes) {
  const allData = game.settings.get(MODULE_ID, CHARACTER_SETTING_KEY) ?? {};
  const charData = allData[characterId];
  if (!charData?.pages?.length) return null;

  const pIndex = charData.pages.findIndex(p => p.id === pageId);
  if (pIndex === -1) return null;

  const canvasFields = {};
  if (changes.widgets !== undefined) canvasFields.widgets = changes.widgets;
  if (changes.canvasHeight !== undefined) canvasFields.canvasHeight = changes.canvasHeight;
  if (changes.nextZIndex !== undefined) canvasFields.nextZIndex = changes.nextZIndex;

  charData.pages[pIndex] = { ...charData.pages[pIndex], ...canvasFields };
  allData[characterId] = charData;
  await game.settings.set(MODULE_ID, CHARACTER_SETTING_KEY, allData);
  return charData.pages[pIndex];
}

/**
 * Update page metadata for a character page.
 * @param {string} characterId
 * @param {string} pageId
 * @param {object} changes - { name?, icon?, color?, order? }
 * @returns {Promise<object|null>}
 */
export async function updateCharacterPageMeta(characterId, pageId, changes) {
  const allData = game.settings.get(MODULE_ID, CHARACTER_SETTING_KEY) ?? {};
  const charData = allData[characterId];
  if (!charData?.pages?.length) return null;

  const pIndex = charData.pages.findIndex(p => p.id === pageId);
  if (pIndex === -1) return null;

  const metaFields = {};
  if (changes.name !== undefined) metaFields.name = changes.name;
  if (changes.icon !== undefined) metaFields.icon = changes.icon;
  if (changes.color !== undefined) metaFields.color = changes.color;
  if (changes.order !== undefined) metaFields.order = changes.order;

  charData.pages[pIndex] = { ...charData.pages[pIndex], ...metaFields };
  allData[characterId] = charData;
  await game.settings.set(MODULE_ID, CHARACTER_SETTING_KEY, allData);
  return charData.pages[pIndex];
}

/**
 * Delete a page from a character. Un-migrates if only one remains.
 * @param {string} characterId
 * @param {string} pageId
 * @returns {Promise<{ deleted: boolean, remainingPages: object[], activePageId: string|null }>}
 */
export async function deleteCharacterPage(characterId, pageId) {
  const allData = game.settings.get(MODULE_ID, CHARACTER_SETTING_KEY) ?? {};
  const charData = allData[characterId];
  if (!charData?.pages?.length) return { deleted: false, remainingPages: [], activePageId: null };

  const filtered = charData.pages.filter(p => p.id !== pageId);
  if (filtered.length === charData.pages.length) return { deleted: false, remainingPages: charData.pages, activePageId: charData.activePageId };

  if (filtered.length <= 1) {
    const remaining = filtered[0];
    charData.widgets = remaining?.widgets ?? [];
    charData.canvasHeight = remaining?.canvasHeight ?? 420;
    charData.nextZIndex = remaining?.nextZIndex ?? 2;
    delete charData.pages;
    delete charData.activePageId;

    allData[characterId] = charData;
    await game.settings.set(MODULE_ID, CHARACTER_SETTING_KEY, allData);
    return { deleted: true, remainingPages: [], activePageId: null };
  }

  const sorted = [...filtered].sort((a, b) => a.order - b.order);
  if (charData.activePageId === pageId) charData.activePageId = sorted[0].id;

  charData.pages = filtered;
  allData[characterId] = charData;
  await game.settings.set(MODULE_ID, CHARACTER_SETTING_KEY, allData);
  return { deleted: true, remainingPages: sorted, activePageId: charData.activePageId };
}

/**
 * Reorder pages for a character.
 * @param {string} characterId
 * @param {string[]} orderedPageIds
 * @returns {Promise<boolean>}
 */
export async function reorderCharacterPages(characterId, orderedPageIds) {
  const allData = game.settings.get(MODULE_ID, CHARACTER_SETTING_KEY) ?? {};
  const charData = allData[characterId];
  if (!charData?.pages?.length) return false;

  for (let i = 0; i < orderedPageIds.length; i++) {
    const page = charData.pages.find(p => p.id === orderedPageIds[i]);
    if (page) page.order = i;
  }

  allData[characterId] = charData;
  await game.settings.set(MODULE_ID, CHARACTER_SETTING_KEY, allData);
  return true;
}

/**
 * Set the active page for a character.
 * @param {string} characterId
 * @param {string} pageId
 * @returns {Promise<boolean>}
 */
export async function setCharacterActivePage(characterId, pageId) {
  const allData = game.settings.get(MODULE_ID, CHARACTER_SETTING_KEY) ?? {};
  const charData = allData[characterId];
  if (!charData?.pages?.length) return false;

  charData.activePageId = pageId;
  allData[characterId] = charData;
  await game.settings.set(MODULE_ID, CHARACTER_SETTING_KEY, allData);
  return true;
}

/* ---------------------------------------- */
/*  Currency Data (Global Per-Character)    */
/* ---------------------------------------- */

const CURRENCY_SETTING_KEY = 'currencyData';
const CURRENCY_LIBRARY_KEY = 'currencyLibrary';

/**
 * Get currency data for a character (balances + transactions).
 * @param {string} characterId
 * @returns {{ balances: object, transactions: object[] }|null}
 */
export function getCurrencyData(characterId) {
  const data = game.settings.get(MODULE_ID, CURRENCY_SETTING_KEY) ?? {};
  return data[characterId] ?? null;
}

/**
 * Get all currency data (all characters).
 * @returns {object}
 */
export function getAllCurrencyData() {
  return game.settings.get(MODULE_ID, CURRENCY_SETTING_KEY) ?? {};
}

/**
 * Update currency data for a character (balances, transactions).
 * Creates the entry if it doesn't exist yet.
 * @param {string} characterId
 * @param {object} changes - { balances?, transactions? }
 * @returns {Promise<object>}
 */
export async function updateCurrencyData(characterId, changes) {
  const data = game.settings.get(MODULE_ID, CURRENCY_SETTING_KEY) ?? {};
  const existing = data[characterId] ?? { balances: {}, transactions: [] };

  if (changes.balances !== undefined) existing.balances = changes.balances;
  if (changes.transactions !== undefined) existing.transactions = changes.transactions;

  data[characterId] = existing;
  await game.settings.set(MODULE_ID, CURRENCY_SETTING_KEY, data);
  return data[characterId];
}

/**
 * Delete currency data for a character.
 * @param {string} characterId
 * @returns {Promise<void>}
 */
export async function deleteCurrencyData(characterId) {
  const data = game.settings.get(MODULE_ID, CURRENCY_SETTING_KEY) ?? {};
  delete data[characterId];
  await game.settings.set(MODULE_ID, CURRENCY_SETTING_KEY, data);
}

/* ---------------------------------------- */
/*  Currency Library                        */
/* ---------------------------------------- */

/**
 * Get all saved currency system definitions.
 * @returns {object[]}
 */
export function getCurrencyLibrary() {
  return game.settings.get(MODULE_ID, CURRENCY_LIBRARY_KEY) ?? [];
}

/**
 * Save a currency system definition to the library.
 * @param {{ id: string, name: string, preset: string|null, currencies: object[] }} entry
 * @returns {Promise<object[]>}
 */
export async function saveCurrencyLibraryEntry(entry) {
  const library = getCurrencyLibrary();
  library.push(entry);
  await game.settings.set(MODULE_ID, CURRENCY_LIBRARY_KEY, library);
  return library;
}

/**
 * Delete a currency system definition from the library.
 * @param {string} entryId
 * @returns {Promise<object[]>}
 */
export async function deleteCurrencyLibraryEntry(entryId) {
  let library = getCurrencyLibrary();
  library = library.filter(e => e.id !== entryId);
  await game.settings.set(MODULE_ID, CURRENCY_LIBRARY_KEY, library);
  return library;
}

/* ---------------------------------------- */
/*  Scribe Data (Collaborative Recaps)      */
/* ---------------------------------------- */

const SCRIBE_SETTING_KEY = 'scribeData';

function normalizeScribePortraitSource(source) {
  return source === 'exalted-character' ? 'exalted-character' : 'player-token';
}

/**
 * Get all scribe entries, sorted by creation date (newest first).
 * @returns {object[]}
 */
export function getScribeEntries() {
  const data = game.settings.get(MODULE_ID, SCRIBE_SETTING_KEY) ?? {};
  const entries = data.entries ?? [];
  return [...entries].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

/**
 * Get a single scribe entry by ID.
 * @param {string} entryId
 * @returns {object|undefined}
 */
export function getScribeEntry(entryId) {
  const data = game.settings.get(MODULE_ID, SCRIBE_SETTING_KEY) ?? {};
  return (data.entries ?? []).find(e => e.id === entryId);
}

/**
 * Create a new scribe entry (GM only).
 * @param {object} entryData - { title, prompt?, assignedPlayerIds?, visibility?, portraitSource? }
 * @returns {Promise<object>} The created entry.
 */
export async function createScribeEntry(entryData) {
  const data = game.settings.get(MODULE_ID, SCRIBE_SETTING_KEY) ?? {};
  if (!data.entries) data.entries = [];

  const entry = {
    id: foundry.utils.randomID(),
    title: entryData.title || '',
    prompt: entryData.prompt || '',
    assignedPlayerIds: entryData.assignedPlayerIds ?? [],
    visibility: entryData.visibility ?? 'shared',
    portraitSource: normalizeScribePortraitSource(entryData.portraitSource),
    locked: false,
    starred: false,
    submissions: {},
    createdAt: Date.now()
  };

  data.entries.push(entry);
  await game.settings.set(MODULE_ID, SCRIBE_SETTING_KEY, data);
  return entry;
}

/**
 * Update a scribe entry's metadata (GM only).
 * @param {string} entryId
 * @param {object} changes - { title?, prompt?, assignedPlayerIds?, visibility?, portraitSource?, locked?, starred? }
 * @returns {Promise<object|null>}
 */
export async function updateScribeEntry(entryId, changes) {
  const data = game.settings.get(MODULE_ID, SCRIBE_SETTING_KEY) ?? {};
  const entries = data.entries ?? [];
  const idx = entries.findIndex(e => e.id === entryId);
  if (idx === -1) return null;

  const allowed = ['title', 'prompt', 'assignedPlayerIds', 'visibility', 'portraitSource', 'locked', 'starred'];
  for (const key of allowed) {
    if (changes[key] === undefined) continue;
    entries[idx][key] = key === 'portraitSource'
      ? normalizeScribePortraitSource(changes[key])
      : changes[key];
  }

  data.entries = entries;
  await game.settings.set(MODULE_ID, SCRIBE_SETTING_KEY, data);
  return entries[idx];
}

/**
 * Delete a scribe entry (GM only).
 * @param {string} entryId
 * @returns {Promise<boolean>}
 */
export async function deleteScribeEntry(entryId) {
  const data = game.settings.get(MODULE_ID, SCRIBE_SETTING_KEY) ?? {};
  const entries = data.entries ?? [];
  const filtered = entries.filter(e => e.id !== entryId);
  if (filtered.length === entries.length) return false;

  data.entries = filtered;
  await game.settings.set(MODULE_ID, SCRIBE_SETTING_KEY, data);
  return true;
}

/**
 * Submit or update a player's recap text for an entry.
 * @param {string} entryId
 * @param {string} userId - Foundry user ID.
 * @param {string} text
 * @param {string|null} [color=null] - Player's chosen accent color.
 * @returns {Promise<object|null>} The updated entry, or null.
 */
export async function submitScribeRecap(entryId, userId, text, color = null) {
  const data = game.settings.get(MODULE_ID, SCRIBE_SETTING_KEY) ?? {};
  const entries = data.entries ?? [];
  const idx = entries.findIndex(e => e.id === entryId);
  if (idx === -1) return null;

  const entry = entries[idx];
  if (entry.locked) return null;

  const now = Date.now();
  if (!entry.submissions) entry.submissions = {};

  const existing = entry.submissions[userId];
  entry.submissions[userId] = {
    text,
    color: color ?? existing?.color ?? null,
    submittedAt: existing?.submittedAt ?? now,
    updatedAt: now
  };

  data.entries = entries;
  await game.settings.set(MODULE_ID, SCRIBE_SETTING_KEY, data);
  return entry;
}
