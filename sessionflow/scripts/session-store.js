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
