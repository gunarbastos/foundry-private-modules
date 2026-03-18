import { CONFIG } from '../config.js';
import { Store } from '../data/Store.js';
import { NarratorJukeboxIntegration } from '../data/NarratorJukeboxIntegration.js';
import { ExaltedScenesDialog } from './ThemedDialog.js';
import { localize, format } from '../utils/i18n.js';
import {
  applyMediaFocusToElement,
  getMediaFocusEffectiveScale,
  getMediaFocusForState,
  mediaFocusToInlineStyle,
  normalizeMediaFocus,
  normalizeMediaFocusMap
} from '../utils/media-focus.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CharacterEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(characterId, options = {}) {
    super(options);
    this.characterId = characterId;
    
    // Clone data for editing to avoid direct mutation until save
    const char = Store.characters.get(characterId);
    if (!char) throw new Error(`Character ${characterId} not found`);

    /** @type {AbortController|null} Controls event listener cleanup on re-render */
    this._abortController = null;

    this.uiState = {
      activeTab: 'identity',
      focusEmotionKey: char.currentState || Object.keys(char.states)[0] || null,
      importState: null,
      data: {
        name: char.name,
        tags: Array.from(char.tags),
        states: { ...char.states }, // Clone states
        stateFocus: normalizeMediaFocusMap(foundry.utils.deepClone(char.stateFocus || {})),
        currentState: char.currentState || Object.keys(char.states)[0] || 'normal',
        locked: char.locked || false, // Lock state
        hideNameInBroadcast: !!char.hideNameInBroadcast,
        actorId: char.actorId || null, // Linked Foundry Actor
        music: {
          playlists: char.music?.playlists || (char.musicPlaylistId ? [char.musicPlaylistId] : []),
          playlistNames: foundry.utils.deepClone(char.music?.playlistNames || {}),
          entranceSoundId: char.music?.entranceSoundId || null
        },
        heroStates: foundry.utils.deepClone(char.heroStates || {}),
        currentHeroState: char.currentHeroState || null
      }
    };
  }

  render(...args) {
    if (this.element) {
      this._syncPendingRenameInputs();
    }

    return super.render(...args);
  }

  static DEFAULT_OPTIONS = {
    tag: 'div',
    id: 'exalted-scenes-character-editor',
    classes: ['exalted-scenes', 'es-char-editor'],
    window: {
      title: 'Edit Character',
      icon: 'fas fa-user-edit',
      resizable: true,
      controls: []
    },
    position: {
      width: 760,
      height: 840
    },
    actions: {
      'tab-switch': CharacterEditor._onTabSwitch,
      'remove-tag': CharacterEditor._onRemoveTag,
      'rename-emotion': CharacterEditor._onRenameEmotion,
      'delete-emotion': CharacterEditor._onDeleteEmotion,
      'set-default-emotion': CharacterEditor._onSetDefaultEmotion,
      'select-focus-emotion': CharacterEditor._onSelectFocusEmotion,
      'apply-focus-preset': CharacterEditor._onApplyFocusPreset,
      'reset-emotion-focus': CharacterEditor._onResetEmotionFocus,
      'add-emotion': CharacterEditor._onAddEmotion,
      'delete-character': CharacterEditor._onDeleteCharacter,
      'toggle-lock': CharacterEditor._onToggleLock,
      'toggle-broadcast-name': CharacterEditor._onToggleBroadcastName,
      'open-permissions': CharacterEditor._onOpenPermissions,
      'clear-actor-link': CharacterEditor._onClearActorLink,
      'add-music-playlist': CharacterEditor._onAddMusicPlaylist,
      'remove-music-playlist': CharacterEditor._onRemoveMusicPlaylist,
      'select-entrance-sound': CharacterEditor._onSelectEntranceSound,
      'clear-entrance-sound': CharacterEditor._onClearEntranceSound,
      'preview-entrance-sound': CharacterEditor._onPreviewEntranceSound,
      'change-avatar': CharacterEditor._onChangeAvatar,
      'trigger-asset-import': CharacterEditor._onTriggerAssetImport,
      'add-hero-pose': CharacterEditor._onAddHeroPose,
      'delete-hero-pose': CharacterEditor._onDeleteHeroPose,
      'rename-hero-pose': CharacterEditor._onRenameHeroPose,
      'toggle-hero-pose-type': CharacterEditor._onToggleHeroPoseType,
      'set-default-hero-pose': CharacterEditor._onSetDefaultHeroPose,
      'save': CharacterEditor._onSave,
      'close': CharacterEditor._onClose
    }
  };

  static PARTS = {
    main: {
      template: 'modules/exalted-scenes/templates/character-editor.hbs',
      scrollable: ['.es-char-editor__content']
    }
  };

  _ensureFocusEmotionKey() {
    const keys = Object.keys(this.uiState.data.states || {});
    if (!keys.length) {
      this.uiState.focusEmotionKey = null;
      return null;
    }

    if (this.uiState.focusEmotionKey && this.uiState.data.states[this.uiState.focusEmotionKey]) {
      return this.uiState.focusEmotionKey;
    }

    const preferredKey = this.uiState.data.currentState && this.uiState.data.states[this.uiState.data.currentState]
      ? this.uiState.data.currentState
      : keys[0];

    this.uiState.focusEmotionKey = preferredKey;
    return preferredKey;
  }

  _getEmotionFocus(stateKey) {
    return getMediaFocusForState(this.uiState.data.stateFocus, stateKey);
  }

  _setEmotionFocus(stateKey, focus) {
    if (!stateKey) return;
    this.uiState.data.stateFocus[stateKey] = normalizeMediaFocus(focus);
  }

  _renameEmotionKey(originalKey, nextKey, { notify = true } = {}) {
    const currentKey = String(originalKey || '').trim();
    const targetKey = String(nextKey || '').trim();

    if (!currentKey || !this.uiState.data.states[currentKey]) {
      return { changed: false, key: currentKey };
    }

    if (!targetKey || targetKey === currentKey) {
      return { changed: false, key: currentKey };
    }

    if (this.uiState.data.states[targetKey]) {
      if (notify) {
        ui.notifications.warn(format('Notifications.WarnEmotionAlreadyExists', { name: targetKey }));
      }
      return { changed: false, key: currentKey, duplicate: true };
    }

    const path = this.uiState.data.states[currentKey];
    const hasFocus = Object.prototype.hasOwnProperty.call(this.uiState.data.stateFocus, currentKey);
    const focus = this.uiState.data.stateFocus[currentKey];

    delete this.uiState.data.states[currentKey];
    this.uiState.data.states[targetKey] = path;

    if (hasFocus) {
      delete this.uiState.data.stateFocus[currentKey];
      this.uiState.data.stateFocus[targetKey] = focus;
    }

    if (this.uiState.data.currentState === currentKey) {
      this.uiState.data.currentState = targetKey;
    }

    if (this.uiState.focusEmotionKey === currentKey) {
      this.uiState.focusEmotionKey = targetKey;
    }

    return { changed: true, key: targetKey };
  }

  _renameHeroPoseKey(originalKey, nextKey, { notify = true } = {}) {
    const currentKey = String(originalKey || '').trim();
    const targetKey = String(nextKey || '').trim();

    if (!currentKey || !this.uiState.data.heroStates[currentKey]) {
      return { changed: false, key: currentKey };
    }

    if (!targetKey || targetKey === currentKey) {
      return { changed: false, key: currentKey };
    }

    if (this.uiState.data.heroStates[targetKey]) {
      if (notify) {
        ui.notifications.warn(format('Notifications.WarnHeroPoseAlreadyExists', { name: targetKey }));
      }
      return { changed: false, key: currentKey, duplicate: true };
    }

    const data = this.uiState.data.heroStates[currentKey];
    delete this.uiState.data.heroStates[currentKey];
    this.uiState.data.heroStates[targetKey] = data;

    if (this.uiState.data.currentHeroState === currentKey) {
      this.uiState.data.currentHeroState = targetKey;
    }

    return { changed: true, key: targetKey };
  }

  _commitEmotionRenameInput(input, { notify = true } = {}) {
    if (!input) {
      return { changed: false, key: '' };
    }

    const result = this._renameEmotionKey(input.dataset.originalKey, input.value, { notify });
    input.value = result.key || input.dataset.originalKey || '';
    if (result.key) {
      input.dataset.originalKey = result.key;
    }
    return result;
  }

  _commitHeroPoseRenameInput(input, { notify = true } = {}) {
    if (!input) {
      return { changed: false, key: '' };
    }

    const result = this._renameHeroPoseKey(input.dataset.originalKey, input.value, { notify });
    input.value = result.key || input.dataset.originalKey || '';
    if (result.key) {
      input.dataset.originalKey = result.key;
    }
    return result;
  }

  _resolveEmotionActionKey(target) {
    const renameInput = target?.closest('.es-char-editor__emotion')?.querySelector('input[data-action="rename-emotion"]');
    if (!renameInput) {
      return target?.dataset.key || '';
    }

    return this._commitEmotionRenameInput(renameInput).key || target?.dataset.key || '';
  }

  _resolveHeroPoseActionKey(target) {
    const renameInput = target?.closest('.es-char-editor__emotion')?.querySelector('input[data-action="rename-hero-pose"]');
    if (!renameInput) {
      return target?.dataset.key || '';
    }

    return this._commitHeroPoseRenameInput(renameInput).key || target?.dataset.key || '';
  }

  _syncPendingRenameInputs() {
    if (!this.element) return;

    for (const input of this.element.querySelectorAll('input[data-action="rename-emotion"]')) {
      this._commitEmotionRenameInput(input);
    }

    for (const input of this.element.querySelectorAll('input[data-action="rename-hero-pose"]')) {
      this._commitHeroPoseRenameInput(input);
    }
  }

  _buildFocusEditorContext() {
    const focusKey = this._ensureFocusEmotionKey();
    if (!focusKey) return null;

    const focus = this._getEmotionFocus(focusKey);
    return {
      key: focusKey,
      path: this.uiState.data.states[focusKey],
      x: focus.x,
      y: focus.y,
      scale: focus.scale,
      rotation: focus.rotation,
      scaleLabel: this._formatFocusScale(focus.scale),
      rotationLabel: this._formatFocusRotation(focus.rotation),
      focusStyle: mediaFocusToInlineStyle(focus)
    };
  }

  _formatFocusScale(scale) {
    return `${Math.round(Number(scale || 1) * 100)}%`;
  }

  _formatFocusRotation(rotation) {
    const safeRotation = Math.round(Number(rotation || 0));
    const prefix = safeRotation > 0 ? '+' : '';
    return `${prefix}${safeRotation}deg`;
  }

  _syncEmotionFocusEditor() {
    const focusKey = this._ensureFocusEmotionKey();
    if (!focusKey || !this.element) return;

    const focus = this._getEmotionFocus(focusKey);
    for (const media of this.element.querySelectorAll(`[data-focus-bind="${focusKey}"]`)) {
      applyMediaFocusToElement(media, focus);
    }

    const xInput = this.element.querySelector('[data-focus-axis="x"]');
    const yInput = this.element.querySelector('[data-focus-axis="y"]');
    const scaleInput = this.element.querySelector('[data-focus-axis="scale"]');
    const rotationInput = this.element.querySelector('[data-focus-axis="rotation"]');
    if (xInput) xInput.value = String(focus.x);
    if (yInput) yInput.value = String(focus.y);
    if (scaleInput) scaleInput.value = String(focus.scale);
    if (rotationInput) rotationInput.value = String(focus.rotation);

    const xValue = this.element.querySelector('[data-focus-value="x"]');
    const yValue = this.element.querySelector('[data-focus-value="y"]');
    const scaleValue = this.element.querySelector('[data-focus-value="scale"]');
    const rotationValue = this.element.querySelector('[data-focus-value="rotation"]');
    if (xValue) xValue.textContent = `${focus.x}%`;
    if (yValue) yValue.textContent = `${focus.y}%`;
    if (scaleValue) scaleValue.textContent = this._formatFocusScale(focus.scale);
    if (rotationValue) rotationValue.textContent = this._formatFocusRotation(focus.rotation);
  }

  _getFocusStageMetrics(stage, focus) {
    const media = stage?.querySelector('[data-focus-media]');
    if (!media) return null;

    const rect = stage.getBoundingClientRect();
    const mediaWidth = media.tagName === 'VIDEO' ? media.videoWidth : media.naturalWidth;
    const mediaHeight = media.tagName === 'VIDEO' ? media.videoHeight : media.naturalHeight;

    if (!rect.width || !rect.height || !mediaWidth || !mediaHeight) return null;

    const coverScale = Math.max(rect.width / mediaWidth, rect.height / mediaHeight);
    const focusScale = getMediaFocusEffectiveScale(focus);
    return {
      overflowX: Math.max(0, (mediaWidth * coverScale * focusScale) - rect.width),
      overflowY: Math.max(0, (mediaHeight * coverScale * focusScale) - rect.height)
    };
  }

  _setupEmotionFocusEditor(listenerOptions) {
    const stage = this.element.querySelector('[data-focus-stage]');
    if (!stage) return;

    const focusKey = stage.dataset.focusKey;
    if (!focusKey) return;

    const sync = () => this._syncEmotionFocusEditor();
    sync();

    const media = stage.querySelector('[data-focus-media]');
    if (media) {
      const readyEvent = media.tagName === 'VIDEO' ? 'loadedmetadata' : 'load';
      media.addEventListener(readyEvent, sync, listenerOptions);

      const alreadyReady = media.tagName === 'VIDEO'
        ? !!(media.videoWidth && media.videoHeight)
        : !!(media.complete && media.naturalWidth);
      if (alreadyReady) sync();
    }

    const updateFromFocus = (partialFocus) => {
      const current = this._getEmotionFocus(focusKey);
      this._setEmotionFocus(focusKey, { ...current, ...partialFocus });
      this._syncEmotionFocusEditor();
    };

    const xInput = this.element.querySelector('[data-focus-axis="x"]');
    const yInput = this.element.querySelector('[data-focus-axis="y"]');
    const scaleInput = this.element.querySelector('[data-focus-axis="scale"]');
    const rotationInput = this.element.querySelector('[data-focus-axis="rotation"]');
    if (xInput) {
      xInput.addEventListener('input', (event) => {
        updateFromFocus({ x: event.target.value });
      }, listenerOptions);
    }
    if (yInput) {
      yInput.addEventListener('input', (event) => {
        updateFromFocus({ y: event.target.value });
      }, listenerOptions);
    }
    if (scaleInput) {
      scaleInput.addEventListener('input', (event) => {
        updateFromFocus({ scale: event.target.value });
      }, listenerOptions);
    }
    if (rotationInput) {
      rotationInput.addEventListener('input', (event) => {
        updateFromFocus({ rotation: event.target.value });
      }, listenerOptions);
    }

    let dragState = null;

    stage.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;

      const metrics = this._getFocusStageMetrics(stage, this._getEmotionFocus(focusKey));
      if (!metrics) return;

      const focus = this._getEmotionFocus(focusKey);
      dragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startOffsetX: metrics.overflowX ? -((focus.x / 100) * metrics.overflowX) : 0,
        startOffsetY: metrics.overflowY ? -((focus.y / 100) * metrics.overflowY) : 0,
        overflowX: metrics.overflowX,
        overflowY: metrics.overflowY
      };

      stage.classList.add('es-char-editor__focus-stage--dragging');
      stage.setPointerCapture(event.pointerId);
      event.preventDefault();
    }, listenerOptions);

    stage.addEventListener('pointermove', (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) return;

      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      const offsetX = dragState.overflowX
        ? Math.max(-dragState.overflowX, Math.min(0, dragState.startOffsetX + deltaX))
        : 0;
      const offsetY = dragState.overflowY
        ? Math.max(-dragState.overflowY, Math.min(0, dragState.startOffsetY + deltaY))
        : 0;

      updateFromFocus({
        x: dragState.overflowX ? ((-offsetX / dragState.overflowX) * 100) : 50,
        y: dragState.overflowY ? ((-offsetY / dragState.overflowY) * 100) : 50
      });

      event.preventDefault();
    }, listenerOptions);

    const endDrag = (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      if (stage.hasPointerCapture(event.pointerId)) {
        stage.releasePointerCapture(event.pointerId);
      }
      dragState = null;
      stage.classList.remove('es-char-editor__focus-stage--dragging');
    };

    stage.addEventListener('pointerup', endDrag, listenerOptions);
    stage.addEventListener('pointercancel', endDrag, listenerOptions);
    window.addEventListener('resize', sync, listenerOptions);
  }

  _buildImportContext(target) {
    if (!this.uiState.importState || this.uiState.importState.target !== target) return null;

    const { completed, total, source } = this.uiState.importState;
    return {
      completed,
      total,
      source,
      isFolder: source === 'folder',
      percent: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }

  _normalizeImportLabel(rawValue) {
    const cleaned = String(rawValue ?? '')
      .replace(/\.[^/.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) return '';
    return cleaned.replace(/\b\w/g, (character) => character.toUpperCase());
  }

  _stripKnownImportPrefix(label, { folderName = '' } = {}) {
    const normalizedLabel = this._normalizeImportLabel(label);
    if (!normalizedLabel) return '';

    const candidates = [this.uiState.data.name, folderName]
      .map((value) => this._normalizeImportLabel(value))
      .filter(Boolean)
      .sort((left, right) => right.length - left.length);

    const lowerLabel = normalizedLabel.toLowerCase();
    for (const candidate of candidates) {
      const lowerCandidate = candidate.toLowerCase();
      if (lowerLabel === lowerCandidate) continue;
      if (!lowerLabel.startsWith(`${lowerCandidate} `)) continue;

      const stripped = normalizedLabel.slice(candidate.length).trim();
      if (stripped) return stripped;
    }

    return normalizedLabel;
  }

  _parseEmotionImportName(fileName, { source = 'files', folderName = '' } = {}) {
    const baseName = this._normalizeImportLabel(fileName);
    if (!baseName) return '';
    return source === 'folder'
      ? this._stripKnownImportPrefix(baseName, { folderName }) || baseName
      : baseName;
  }

  _detectHeroPoseType(fileName) {
    const normalized = this._normalizeImportLabel(fileName).toLowerCase();
    if (/\bfull(?: body)?\b/.test(normalized)) return 'full';
    if (/\bhalf(?: body)?\b/.test(normalized)) return 'half';
    return null;
  }

  _stripHeroPoseTypeTokens(fileName) {
    return String(fileName ?? '')
      .replace(/\.[^/.]+$/, '')
      .replace(/\bfull[\s_-]*body\b/ig, ' ')
      .replace(/\bhalf[\s_-]*body\b/ig, ' ')
      .replace(/\bfull\b/ig, ' ')
      .replace(/\bhalf\b/ig, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _parseHeroPoseImport(fileName, { source = 'files', folderName = '', defaultType = 'half' } = {}) {
    const detectedType = this._detectHeroPoseType(fileName);
    const withoutType = this._stripHeroPoseTypeTokens(fileName);
    const baseName = this._normalizeImportLabel(withoutType || fileName);
    const parsedName = source === 'folder'
      ? this._stripKnownImportPrefix(baseName, { folderName }) || baseName
      : baseName;

    return {
      name: parsedName,
      type: detectedType || defaultType || 'half'
    };
  }

  _nextAvailableKey(baseKey, collection, fallbackKey = 'Asset') {
    const seed = (baseKey || fallbackKey).trim() || fallbackKey;
    if (!collection[seed]) return { key: seed, renamed: false };

    let suffix = 2;
    let candidate = `${seed} (${suffix})`;
    while (collection[candidate]) {
      suffix += 1;
      candidate = `${seed} (${suffix})`;
    }

    return { key: candidate, renamed: true };
  }

  _sanitizeUploadSegment(rawValue, fallback = 'asset') {
    const sanitized = String(rawValue ?? '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();

    return sanitized || fallback;
  }

  _buildAssetUploadDirectory(target) {
    const assetFolder = target === 'hero' ? 'hero-poses' : 'emotions';
    return `exalted-scenes/characters/${this.characterId}/${assetFolder}`;
  }

  async _ensureDirectory(path) {
    try {
      await FilePicker.browse('data', path);
    } catch (error) {
      try {
        await FilePicker.createDirectory('data', path);
      } catch (createError) {
        const message = createError?.message || '';
        if (!message.includes('EEXIST') && !message.includes('already exists')) {
          throw createError;
        }
      }
    }
  }

  async _ensureUploadDirectory(path) {
    let currentPath = '';
    for (const segment of String(path).split('/').filter(Boolean)) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      await this._ensureDirectory(currentPath);
    }
  }

  _getImportFolderName(files) {
    const firstRelativePath = files.find((file) => file?.webkitRelativePath)?.webkitRelativePath;
    if (!firstRelativePath) return '';
    return firstRelativePath.split(/[\\/]/)[0] || '';
  }

  _filterImportFiles(files, target) {
    const allowedExtensions = target === 'hero'
      ? new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif'])
      : new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif', 'mp4', 'webm']);

    return Array.from(files || [])
      .filter((file) => {
        if (!file?.name || file.name.startsWith('.')) return false;
        const extension = file.name.split('.').pop()?.toLowerCase();
        return allowedExtensions.has(extension);
      })
      .sort((left, right) => {
        const leftPath = left.webkitRelativePath || left.name;
        const rightPath = right.webkitRelativePath || right.name;
        return leftPath.localeCompare(rightPath, undefined, { sensitivity: 'base' });
      });
  }

  async _getExistingUploadedFiles(targetDir) {
    const uploadedFiles = await this._browseUploadedFiles(targetDir);
    return new Set(uploadedFiles.keys());
  }

  async _browseUploadedFiles(targetDir) {
    try {
      const browseResult = await FilePicker.browse('data', targetDir);
      return new Map(
        (browseResult?.files || [])
          .map((path) => {
            const fileName = path.split('/').pop()?.toLowerCase();
            return fileName ? [fileName, path] : null;
          })
          .filter(Boolean)
      );
    } catch (error) {
      return new Map();
    }
  }

  _buildUniqueUploadName(baseKey, extension, reservedNames) {
    const safeBase = this._sanitizeUploadSegment(baseKey, 'asset');
    let suffix = 1;
    let candidate = `${safeBase}.${extension}`;
    while (reservedNames.has(candidate.toLowerCase())) {
      suffix += 1;
      candidate = `${safeBase}-${suffix}.${extension}`;
    }
    reservedNames.add(candidate.toLowerCase());
    return candidate;
  }

  _getUploadBaseName(fileName) {
    return String(fileName || '')
      .replace(/\.[^/.]+$/, '')
      .toLowerCase();
  }

  async _resolveUploadedPath(targetDir, uploadName, uploadResult, previousFiles = new Set()) {
    const reportedPath = typeof uploadResult?.path === 'string' ? uploadResult.path.trim() : '';
    const currentFiles = await this._browseUploadedFiles(targetDir);

    if (reportedPath) {
      const reportedName = reportedPath.split('/').pop()?.toLowerCase();
      if (reportedName && currentFiles.has(reportedName)) {
        return currentFiles.get(reportedName);
      }
    }

    const normalizedUploadName = String(uploadName || '').toLowerCase();
    if (normalizedUploadName && currentFiles.has(normalizedUploadName)) {
      return currentFiles.get(normalizedUploadName);
    }

    const expectedBaseName = this._getUploadBaseName(uploadName);
    const newFiles = Array.from(currentFiles.entries())
      .filter(([fileName]) => !previousFiles.has(fileName))
      .map(([fileName, path]) => ({ fileName, path }));

    const newBaseMatches = newFiles.filter(({ fileName }) => this._getUploadBaseName(fileName) === expectedBaseName);
    if (newBaseMatches.length === 1) {
      return newBaseMatches[0].path;
    }

    const allBaseMatches = Array.from(currentFiles.entries())
      .filter(([fileName]) => this._getUploadBaseName(fileName) === expectedBaseName)
      .map(([, path]) => path);
    if (allBaseMatches.length === 1) {
      return allBaseMatches[0];
    }

    return reportedPath || `${targetDir}/${uploadName}`;
  }

  async _importAssets(files, { target, source }) {
    const filteredFiles = this._filterImportFiles(files, target);
    const assetLabel = target === 'hero'
      ? localize('CharEditor.HeroPoses')
      : localize('CharEditor.Emotions');

    if (!filteredFiles.length) {
      ui.notifications.warn(format('Notifications.WarnNoSupportedFilesForImport', { assetLabel }));
      return;
    }

    const targetDir = this._buildAssetUploadDirectory(target);
    const folderName = source === 'folder' ? this._getImportFolderName(filteredFiles) : '';
    const defaultHeroType = this.element?.querySelector('select[name="newHeroPoseType"]')?.value || 'half';

    try {
      await this._ensureUploadDirectory(targetDir);
    } catch (error) {
      console.error('Exalted Scenes | Failed to prepare asset upload directory:', error);
      ui.notifications.error(format('Notifications.ErrorCreateDirectory', { path: targetDir }));
      return;
    }

    const existingUploads = await this._getExistingUploadedFiles(targetDir);
    const collection = target === 'hero' ? this.uiState.data.heroStates : this.uiState.data.states;
    const importedKeys = [];
    let renamedCount = 0;
    let skippedCount = Math.max(0, files.length - filteredFiles.length);

    this.uiState.importState = {
      target,
      source,
      completed: 0,
      total: filteredFiles.length
    };
    this.render();

    for (let index = 0; index < filteredFiles.length; index += 1) {
      const file = filteredFiles[index];
      try {
        const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'png';
        const previousUploads = new Set(existingUploads);
        const parsedAsset = target === 'hero'
          ? this._parseHeroPoseImport(file.name, { source, folderName, defaultType: defaultHeroType })
          : { name: this._parseEmotionImportName(file.name, { source, folderName }) };

        const { key, renamed } = this._nextAvailableKey(
          parsedAsset.name,
          collection,
          target === 'hero' ? 'Hero Pose' : 'Emotion'
        );
        const uploadName = this._buildUniqueUploadName(key, fileExtension, existingUploads);
        const uploadFile = uploadName === file.name
          ? file
          : new File([file], uploadName, { type: file.type, lastModified: file.lastModified });
        const uploadResult = await FilePicker.upload('data', targetDir, uploadFile);
        const uploadedPath = await this._resolveUploadedPath(targetDir, uploadFile.name, uploadResult, previousUploads);
        const uploadedFileName = uploadedPath.split('/').pop()?.toLowerCase();
        if (uploadedFileName) {
          existingUploads.add(uploadedFileName);
        }

        if (target === 'hero') {
          collection[key] = {
            img: uploadedPath,
            type: parsedAsset.type
          };
          if (!this.uiState.data.currentHeroState) {
            this.uiState.data.currentHeroState = key;
          }
        } else {
          collection[key] = uploadedPath;
          this.uiState.data.stateFocus[key] = normalizeMediaFocus();
          if (!this.uiState.data.currentState) {
            this.uiState.data.currentState = key;
          }
          if (!this.uiState.focusEmotionKey) {
            this.uiState.focusEmotionKey = key;
          }
        }

        importedKeys.push(key);
        if (renamed) renamedCount += 1;
      } catch (error) {
        skippedCount += 1;
        console.error(`Exalted Scenes | Failed to import ${target} asset "${file?.name}":`, error);
      }

      this.uiState.importState.completed = index + 1;
      if ((index + 1) === filteredFiles.length || ((index + 1) % 5) === 0) {
        this.render();
      }
    }

    this.uiState.importState = null;
    this.render();

    if (!importedKeys.length) {
      ui.notifications.warn(format('Notifications.AssetImportNothingAdded', { assetLabel }));
      return;
    }

    ui.notifications.info(format('Notifications.AssetsImportedSummary', {
      assetLabel,
      added: importedKeys.length,
      renamed: renamedCount,
      skipped: skippedCount
    }));
  }

  /* ═══════════════════════════════════════════════════════════════
     RENDER CONTEXT
     ═══════════════════════════════════════════════════════════════ */

  async _prepareContext(options) {
    const char = Store.characters.get(this.characterId);
    if (!char) return {};

    const focusEditor = this._buildFocusEditorContext();
    const currentImage = this.uiState.data.states[this.uiState.data.currentState]
      || Object.values(this.uiState.data.states)[0]
      || char.image;

    // Prepare emotions list
    const emotions = Object.entries(this.uiState.data.states).map(([key, path]) => ({
      key,
      path,
      isDefault: this.uiState.data.currentState === key,
      isFocusSelected: this._ensureFocusEmotionKey() === key,
      focusStyle: mediaFocusToInlineStyle(this._getEmotionFocus(key))
    }));

    // Check if user can browse files (players typically can't)
    const canBrowseFiles = game.user.isGM || game.user.can("FILES_BROWSE");
    const canUploadFiles = game.user.isGM || game.user.can("FILES_UPLOAD");

    // Prepare list of available Actors for linking (GM only)
    let availableActors = [];
    let linkedActor = null;
    let availablePlaylists = [];
    let linkedPlaylist = null;
    const hasNarratorJukebox = NarratorJukeboxIntegration.isAvailable;

    if (game.user.isGM) {
      availableActors = game.actors.contents
        .filter(a => a.visible)
        .map(a => ({ id: a.id, name: a.name, img: a.img }))
        .sort((a, b) => a.name.localeCompare(b.name));

      // Get currently linked actor info
      if (this.uiState.data.actorId) {
        const actor = game.actors.get(this.uiState.data.actorId);
        if (actor) {
          linkedActor = { id: actor.id, name: actor.name, img: actor.img };
        }
      }

      // Get available playlists for music requests (from Narrator Jukebox)
      const njPlaylists = NarratorJukeboxIntegration.getAllPlaylists();
      availablePlaylists = njPlaylists.map(p => {
        const tracks = NarratorJukeboxIntegration.getPlaylistTracks(p.id);
        return { id: p.id, name: p.name, trackCount: tracks.length };
      }).sort((a, b) => a.name.localeCompare(b.name));
    }

    // Build assigned playlists display data
    const assignedIds = this.uiState.data.music.playlists || [];
    const musicPlaylists = assignedIds.map((id, index) => ({
      id,
      name: NarratorJukeboxIntegration.getPlaylistName(id, this.uiState.data.music.playlistNames?.[id]),
      trackCount: NarratorJukeboxIntegration.getPlaylistTracks(id).length,
      index
    }));

    // Filter available playlists to exclude already-assigned ones
    const unassignedPlaylists = availablePlaylists.filter(
      p => !assignedIds.includes(p.id)
    );

    // Resolve entrance sound name
    const entranceSoundId = this.uiState.data.music.entranceSoundId;
    let entranceSoundName = null;
    if (entranceSoundId) {
      const sounds = NarratorJukeboxIntegration.getSoundboardSounds();
      const found = sounds.find(s => s.id === entranceSoundId);
      entranceSoundName = found?.name || null;
    }

    // Prepare hero poses list
    const heroPoses = Object.entries(this.uiState.data.heroStates).map(([key, data]) => {
      const currentType = data.type === 'full' ? 'full' : 'half';
      const nextType = currentType === 'full' ? 'half' : 'full';
      const currentTypeName = game.i18n.localize(CONFIG.HERO_TYPES[currentType]?.name || CONFIG.HERO_TYPES.half.name);
      const nextTypeName = game.i18n.localize(CONFIG.HERO_TYPES[nextType]?.name || CONFIG.HERO_TYPES.half.name);

      return {
        key,
        img: data.img,
        type: currentType,
        typeName: currentTypeName,
        nextType,
        nextTypeName,
        toggleTypeLabel: format('CharEditor.ToggleHeroPoseType', {
          currentType: currentTypeName,
          nextType: nextTypeName
        }),
        isDefault: this.uiState.data.currentHeroState === key
      };
    });

    // Prepare hero type options for the dropdown
    const heroTypes = Object.entries(CONFIG.HERO_TYPES).map(([key, ht]) => ({
      key,
      name: game.i18n.localize(ht.name)
    }));

    const tabs = [
      {
        key: 'identity',
        icon: 'fa-id-card',
        label: localize('CharEditor.Identity'),
        isActive: this.uiState.activeTab === 'identity'
      },
      {
        key: 'emotions',
        icon: 'fa-theater-masks',
        label: localize('CharEditor.Emotions'),
        badge: String(emotions.length),
        isActive: this.uiState.activeTab === 'emotions'
      },
      {
        key: 'hero',
        icon: 'fa-person',
        label: localize('CharEditor.HeroPoses'),
        badge: String(heroPoses.length),
        isActive: this.uiState.activeTab === 'hero'
      }
    ];

    const activeTabMeta = tabs.find(tab => tab.key === this.uiState.activeTab) || tabs[0];
    activeTabMeta.hint = this.uiState.activeTab === 'identity'
      ? (linkedActor?.name || localize('CharEditor.NoActorLinked'))
      : this.uiState.activeTab === 'emotions'
        ? (this.uiState.data.currentState || localize('CharEditor.NoEmotionsYet'))
        : (this.uiState.data.currentHeroState || localize('CharEditor.NoHeroPosesYet'));

    const heroHeaderStats = [
      {
        icon: 'fa-theater-masks',
        label: localize('CharEditor.Emotions'),
        value: String(emotions.length),
        toneClass: 'es-char-editor__hero-stat--emotions'
      },
      {
        icon: 'fa-bolt',
        label: localize('CharEditor.EmotionPortraits'),
        value: this.uiState.data.currentState || localize('CharEditor.NoEmotionsYet'),
        toneClass: 'es-char-editor__hero-stat--active'
      },
      {
        icon: 'fa-user',
        label: localize('CharEditor.HeroPoses'),
        value: String(heroPoses.length),
        toneClass: heroPoses.length ? 'es-char-editor__hero-stat--hero' : ''
      },
      {
        icon: 'fa-lock',
        label: localize('CharEditor.EmotionLock'),
        value: localize(this.uiState.data.locked ? 'CharEditor.Locked' : 'CharEditor.Unlocked'),
        toneClass: this.uiState.data.locked ? 'es-char-editor__hero-stat--locked' : 'es-char-editor__hero-stat--open'
      }
    ];

    return {
      character: {
        ...this.uiState.data,
        image: currentImage,
        focusStyle: mediaFocusToInlineStyle(this._getEmotionFocus(this.uiState.data.currentState)),
        heroPreview: heroPoses.find(p => p.isDefault)?.img || null
      },
      emotions: emotions,
      focusEditor: focusEditor,
      heroPoses: heroPoses,
      heroTypes: heroTypes,
      activeTab: this.uiState.activeTab,
      tabs: tabs,
      activeTabMeta: activeTabMeta,
      heroHeaderStats: heroHeaderStats,
      locked: this.uiState.data.locked,
      hideNameInBroadcast: this.uiState.data.hideNameInBroadcast,
      canBrowseFiles: canBrowseFiles,
      canUploadFiles: canUploadFiles,
      isGM: game.user.isGM,
      availableActors: availableActors,
      linkedActor: linkedActor,
      availablePlaylists: unassignedPlaylists,
      musicPlaylists: musicPlaylists,
      hasPlaylists: musicPlaylists.length > 0,
      entranceSoundId: entranceSoundId,
      entranceSoundName: entranceSoundName,
      emotionImport: this._buildImportContext('emotion'),
      heroImport: this._buildImportContext('hero'),
      hasNarratorJukebox: hasNarratorJukebox
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    // Abort previous listeners before re-attaching
    if (this._abortController) this._abortController.abort();
    this._abortController = new AbortController();
    const o = { signal: this._abortController.signal };

    // Bind Name Input
    const nameInput = this.element.querySelector('input[name="name"]');
    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        this.uiState.data.name = e.target.value;
      }, o);
    }

    for (const pickerBtn of this.element.querySelectorAll('[data-file-picker-target]')) {
      pickerBtn.addEventListener('click', () => {
        const targetInput = this.element.querySelector(`input[name="${pickerBtn.dataset.filePickerTarget}"]`);
        if (!targetInput) return;

        new FilePicker({
          type: pickerBtn.dataset.filePickerType || 'image',
          callback: (path) => {
            targetInput.value = path;
          }
        }).render(true);
      }, o);
    }

    // Bind Tag Input (Enter Key)
    const tagInput = this.element.querySelector('.es-char-editor__tag-input');
    if (tagInput) {
      tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this._syncPendingRenameInputs();
          const tag = e.target.value.trim();
          if (tag && !this.uiState.data.tags.includes(tag)) {
            this.uiState.data.tags.push(tag);
            e.target.value = '';
            this.render();
          }
        }
      }, o);
    }

    // Bind Actor Link Select
    const actorSelect = this.element.querySelector('select[name="actorId"]');
    if (actorSelect) {
      actorSelect.addEventListener('change', (e) => {
        this._syncPendingRenameInputs();
        this.uiState.data.actorId = e.target.value || null;
        this.render();
      }, o);
    }

    for (const input of this.element.querySelectorAll('[data-import-input]')) {
      input.addEventListener('change', async (event) => {
        this._syncPendingRenameInputs();
        const selectedFiles = Array.from(event.target.files || []);
        if (!selectedFiles.length) return;

        await this._importAssets(selectedFiles, {
          target: input.dataset.assetTarget,
          source: input.dataset.importSource
        });

        event.target.value = '';
      }, o);
    }

    // Bind Add Playlist Select
    const playlistSelect = this.element.querySelector('select[name="addPlaylistId"]');
    if (playlistSelect) {
      playlistSelect.addEventListener('change', (e) => {
        this._syncPendingRenameInputs();
        const id = e.target.value;
        if (id && !this.uiState.data.music.playlists.includes(id)) {
          this.uiState.data.music.playlists.push(id);
          this.uiState.data.music.playlistNames[id] = NarratorJukeboxIntegration.getPlaylistName(id);
          this.render();
        }
      }, o);
    }

    this._setupEmotionFocusEditor(o);
  }

  /* ═══════════════════════════════════════════════════════════════
     ACTIONS
     ═══════════════════════════════════════════════════════════════ */

  static _onTabSwitch(event, target) {
    this._syncPendingRenameInputs();
    this.uiState.activeTab = target.dataset.tab;
    this.render();
  }

  static _onClose(event, target) {
    this.close();
  }

  static _onTriggerAssetImport(event, target) {
    if (this.uiState.importState) return;

    const input = this.element?.querySelector(
      `[data-import-input][data-asset-target="${target.dataset.assetTarget}"][data-import-source="${target.dataset.importSource}"]`
    );
    if (!input) return;

    input.value = '';
    input.click();
  }

  // --- TAGS ---

  static _onRemoveTag(event, target) {
    this._syncPendingRenameInputs();
    const tag = target.dataset.tag;
    this.uiState.data.tags = this.uiState.data.tags.filter(t => t !== tag);
    this.render();
  }

  // --- EMOTIONS ---

  static _onRenameEmotion(event, target) {
    const result = this._commitEmotionRenameInput(target);
    if (result.changed) {
      this.render();
    }
  }

  static _onDeleteEmotion(event, target) {
    const key = this._resolveEmotionActionKey(target);
    delete this.uiState.data.states[key];
    delete this.uiState.data.stateFocus[key];
    if (this.uiState.data.currentState === key) {
      const remaining = Object.keys(this.uiState.data.states);
      this.uiState.data.currentState = remaining[0] || null;
    }
    if (this.uiState.focusEmotionKey === key) {
      const remaining = Object.keys(this.uiState.data.states);
      this.uiState.focusEmotionKey = remaining[0] || null;
    }
    this.render();
  }

  static _onSetDefaultEmotion(event, target) {
    const key = this._resolveEmotionActionKey(target);
    if (!this.uiState.data.states[key]) return;
    this.uiState.data.currentState = key;
    this.render();
  }

  static _onSelectFocusEmotion(event, target) {
    const key = this._resolveEmotionActionKey(target);
    if (!this.uiState.data.states[key]) return;
    this.uiState.focusEmotionKey = key;
    this.render();
  }

  static _onApplyFocusPreset(event, target) {
    const focusKey = this._ensureFocusEmotionKey();
    if (!focusKey) return;

    const current = this._getEmotionFocus(focusKey);
    const preset = target.dataset.preset;
    const nextFocus = { ...current };

    if (preset === 'top') nextFocus.y = 0;
    if (preset === 'center') nextFocus.y = 50;
    if (preset === 'bottom') nextFocus.y = 100;

    this._setEmotionFocus(focusKey, nextFocus);
    this._syncEmotionFocusEditor();
  }

  static _onResetEmotionFocus(event, target) {
    const focusKey = this._ensureFocusEmotionKey();
    if (!focusKey) return;
    this._setEmotionFocus(focusKey, normalizeMediaFocus());
    this._syncEmotionFocusEditor();
  }

  static _onAddEmotion(event, target) {
    this._syncPendingRenameInputs();
    const nameInput = this.element.querySelector('input[name="newEmotionName"]');
    const pathInput = this.element.querySelector('input[name="newEmotionPath"]');

    const name = nameInput.value.trim();
    const path = pathInput.value.trim();

    if (name && path) {
      if (this.uiState.data.states[name]) {
        ui.notifications.warn(format('Notifications.WarnEmotionAlreadyExists', { name }));
        return;
      }

      this.uiState.data.states[name] = path;
      this.uiState.data.stateFocus[name] = normalizeMediaFocus();
      if (!this.uiState.data.currentState) {
        this.uiState.data.currentState = name;
      }
      this.uiState.focusEmotionKey = name;
      this.render();
    } else {
      ui.notifications.warn(localize('Notifications.WarnNoNameAndPathEmotion'));
    }
  }

  // --- LOCK ---

  static _onToggleLock(event, target) {
    this._syncPendingRenameInputs();
    this.uiState.data.locked = !this.uiState.data.locked;
    this.render();
  }

  static _onToggleBroadcastName(event, target) {
    this._syncPendingRenameInputs();
    this.uiState.data.hideNameInBroadcast = !this.uiState.data.hideNameInBroadcast;
    this.render();
  }

  // --- PERMISSIONS ---

  static _onOpenPermissions(event, target) {
    import('./PermissionEditor.js').then(({ PermissionEditor }) => {
      PermissionEditor.open(this.characterId);
    }).catch(e => console.error('Exalted Scenes | Failed to load PermissionEditor:', e));
  }

  // --- ACTOR LINK ---

  static _onClearActorLink(event, target) {
    this._syncPendingRenameInputs();
    this.uiState.data.actorId = null;
    this.render();
  }

  // --- MUSIC PLAYLISTS & ENTRANCE SOUND ---

  static _onAddMusicPlaylist(event, target) {
    this._syncPendingRenameInputs();
    const select = this.element.querySelector('select[name="addPlaylistId"]');
    const id = select?.value;
    if (id && !this.uiState.data.music.playlists.includes(id)) {
      this.uiState.data.music.playlists.push(id);
      this.uiState.data.music.playlistNames[id] = NarratorJukeboxIntegration.getPlaylistName(id);
      this.render();
    }
  }

  static _onRemoveMusicPlaylist(event, target) {
    this._syncPendingRenameInputs();
    const index = parseInt(target.dataset.index, 10);
    if (!isNaN(index)) {
      const [removedId] = this.uiState.data.music.playlists.splice(index, 1);
      if (removedId) {
        delete this.uiState.data.music.playlistNames[removedId];
      }
      this.render();
    }
  }

  static _onSelectEntranceSound(event, target) {
    import('./AudioBrowser.js').then(({ AudioBrowser }) => {
      AudioBrowser.browse('soundboard', (selected) => {
        if (selected?.[0]?.id) {
          this.uiState.data.music.entranceSoundId = selected[0].id;
          this.render();
        }
      });
    }).catch(e => console.error('Exalted Scenes | Failed to load AudioBrowser:', e));
  }

  static _onClearEntranceSound(event, target) {
    this._syncPendingRenameInputs();
    this.uiState.data.music.entranceSoundId = null;
    this.render();
  }

  static _onPreviewEntranceSound(event, target) {
    const soundId = this.uiState.data.music.entranceSoundId;
    if (soundId) {
      NarratorJukeboxIntegration.playSoundboardSound(soundId);
    }
  }

  // --- HERO POSES ---

  static _onAddHeroPose(event, target) {
    this._syncPendingRenameInputs();
    const nameInput = this.element.querySelector('input[name="newHeroPoseName"]');
    const pathInput = this.element.querySelector('input[name="newHeroPosePath"]');
    const typeSelect = this.element.querySelector('select[name="newHeroPoseType"]');

    const name = nameInput.value.trim();
    const path = pathInput.value.trim();
    const type = typeSelect.value || 'half';

    if (name && path) {
      if (this.uiState.data.heroStates[name]) {
        ui.notifications.warn(format('Notifications.WarnHeroPoseAlreadyExists', { name }));
        return;
      }
      this.uiState.data.heroStates[name] = { img: path, type };
      if (!this.uiState.data.currentHeroState) {
        this.uiState.data.currentHeroState = name;
      }
      this.render();
    } else {
      ui.notifications.warn(localize('Notifications.WarnNoNameAndPathEmotion'));
    }
  }

  static _onDeleteHeroPose(event, target) {
    const key = this._resolveHeroPoseActionKey(target);
    delete this.uiState.data.heroStates[key];
    if (this.uiState.data.currentHeroState === key) {
      const remaining = Object.keys(this.uiState.data.heroStates);
      this.uiState.data.currentHeroState = remaining.length > 0 ? remaining[0] : null;
    }
    this.render();
  }

  static _onRenameHeroPose(event, target) {
    const result = this._commitHeroPoseRenameInput(target);
    if (result.changed) {
      this.render();
    }
  }

  static _onToggleHeroPoseType(event, target) {
    const key = this._resolveHeroPoseActionKey(target);
    const heroPose = this.uiState.data.heroStates[key];
    if (!heroPose) return;

    heroPose.type = heroPose.type === 'full' ? 'half' : 'full';
    this.render();
  }

  static _onSetDefaultHeroPose(event, target) {
    const key = this._resolveHeroPoseActionKey(target);
    this.uiState.data.currentHeroState = key;
    this.render();
  }

  // --- AVATAR ---

  static _onChangeAvatar(event, target) {
    const char = Store.characters.get(this.characterId);
    new FilePicker({
      type: 'image',
      current: char?.image,
      callback: (path) => {
        // Update the character image directly
        if (char) {
          char.image = path;
          Store.saveData();
          this.render();
        }
      }
    }).render(true);
  }

  // --- SAVE & DELETE ---

  static async _onSave(event, target) {
    const char = Store.characters.get(this.characterId);
    if (!char) return;

    this._syncPendingRenameInputs();

    // Add loading state to button
    const btn = target;
    const originalHtml = btn.innerHTML;
    btn.classList.add('es-btn-loading');
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${localize('Common.SaveChanges')}`;
    btn.disabled = true;

    try {
      // Update Character Model
      char.name = this.uiState.data.name;
      char.tags = new Set(this.uiState.data.tags);
      char.states = this.uiState.data.states;
      char.stateFocus = normalizeMediaFocusMap(foundry.utils.deepClone(this.uiState.data.stateFocus));
      char.currentState = this.uiState.data.currentState;
      char.locked = this.uiState.data.locked;
      char.hideNameInBroadcast = !!this.uiState.data.hideNameInBroadcast;
      char.actorId = this.uiState.data.actorId;
      char.music = {
        playlists: this.uiState.data.music.playlists,
        playlistNames: foundry.utils.deepClone(this.uiState.data.music.playlistNames || {}),
        entranceSoundId: this.uiState.data.music.entranceSoundId
      };

      // Hero Mode data
      char.heroStates = foundry.utils.deepClone(this.uiState.data.heroStates);
      char.currentHeroState = this.uiState.data.currentHeroState;

      // Ensure current state is valid
      if (!char.states[char.currentState]) {
        char.currentState = Object.keys(char.states)[0] || 'normal';
      }

      await Store.saveData();

      // Broadcast lock change to all clients
      const { SocketHandler } = await import('../data/SocketHandler.js');
      SocketHandler.emitUpdateLock(char.id, char.locked);
      if (char.currentState) {
        SocketHandler.emitUpdateEmotion(char.id, char.currentState);
      }

      import('./PlayerView.js').then(({ ExaltedScenesPlayerView }) => {
        ExaltedScenesPlayerView.refreshCast();
      }).catch(e => console.error('Exalted Scenes | Failed to refresh PlayerView cast:', e));

      ui.notifications.info(format('Notifications.CharacterSavedName', { name: char.name }));

      this.close();

      // Refresh GM Panel
      const gmPanel = foundry.applications.instances.get('exalted-scenes-gm-panel');
      if (gmPanel) gmPanel.render();
    } catch (error) {
      console.error('Exalted Scenes | Error saving character:', error);
      ui.notifications.error(localize('Notifications.ErrorSaveCharacter'));
      // Restore button state on error
      btn.classList.remove('es-btn-loading');
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  }

  static async _onDeleteCharacter(event, target) {
    const char = Store.characters.get(this.characterId);

    const confirmed = await ExaltedScenesDialog.confirm({
      title: format('Dialog.DeleteCharacter.Title', { name: char.name }),
      content: format('Dialog.DeleteCharacter.Content', { name: char.name }),
      tone: 'danger',
      confirmLabel: localize('Common.Delete')
    });

    if (!confirmed) return;

    Store.deleteItem(this.characterId, 'character');
    ui.notifications.info(format('Notifications.CharacterDeletedName', { name: char.name }));
    this.close();

    // Refresh GM Panel
    const gmPanel = foundry.applications.instances.get('exalted-scenes-gm-panel');
    if (gmPanel) gmPanel.render();
  }
}
