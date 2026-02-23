import { CONFIG } from '../config.js';
import { Store } from '../data/Store.js';
import { localize, format } from '../utils/i18n.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SmartCreator extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.uiState = {
      step: 1,
      data: {
        name: '',
        tags: [],
        emotions: {}, // { key: { path, excluded, isDefault } }
        defaultEmotion: null
      },
      uploadProgress: 0
    };
  }

  static DEFAULT_OPTIONS = {
    tag: 'div',
    id: 'exalted-scenes-smart-creator',
    classes: ['exalted-scenes'],
    window: {
      title: 'Character Creator',
      icon: 'fas fa-magic',
      resizable: true,
      controls: []
    },
    position: {
      width: 800,
      height: 700
    },
    actions: {
      'next-step': SmartCreator._onNextStep,
      'prev-step': SmartCreator._onPrevStep,
      'trigger-upload': SmartCreator._onTriggerUpload,
      'remove-tag': SmartCreator._onRemoveTag,
      'toggle-exclude': SmartCreator._onToggleExclude,
      'set-default': SmartCreator._onSetDefault,
      'rename-emotion': SmartCreator._onRenameEmotion,
      'finish': SmartCreator._onFinish
    }
  };

  static PARTS = {
    main: {
      template: 'modules/exalted-scenes/templates/smart-creator.hbs'
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER CONTEXT
     ═══════════════════════════════════════════════════════════════ */

  async _prepareContext(options) {
    return {
      step: this.uiState.step,
      data: this.uiState.data,
      emotionCount: Object.keys(this.uiState.data.emotions).length,
      uploadProgress: this.uiState.uploadProgress
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    // Bind Name Input
    const nameInput = this.element.querySelector('input[name="name"]');
    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        this.uiState.data.name = e.target.value;
      });
    }

    // Bind Tag Input (keydown for Enter key - data-action doesn't work for keydown events)
    const tagInput = this.element.querySelector('.es-smart-creator__tag-input');
    if (tagInput) {
      tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();

          // Preserve name before re-render
          if (nameInput) {
            this.uiState.data.name = nameInput.value;
          }

          const tag = e.target.value.trim();
          if (tag && !this.uiState.data.tags.includes(tag)) {
            this.uiState.data.tags.push(tag);
            e.target.value = '';
            this.render();
          }
        }
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     ACTIONS
     ═══════════════════════════════════════════════════════════════ */

  static _onNextStep(event, target) {
    // Ensure we capture the name if the user typed and clicked next immediately
    const nameInput = this.element.querySelector('input[name="name"]');
    if (nameInput) {
      this.uiState.data.name = nameInput.value;
    }

    if (this.uiState.step === 1 && !this.uiState.data.name) {
      ui.notifications.warn(localize('Notifications.WarnEnterCharacterName'));
      return;
    }
    this.uiState.step++;
    this.render();
  }

  static _onPrevStep(event, target) {
    this.uiState.step--;
    this.render();
  }

  static _onRemoveTag(event, target) {
    // Preserve name before re-render
    const nameInput = this.element.querySelector('input[name="name"]');
    if (nameInput) {
      this.uiState.data.name = nameInput.value;
    }

    const tag = target.dataset.tag;
    this.uiState.data.tags = this.uiState.data.tags.filter(t => t !== tag);
    this.render();
  }

  /* ═══════════════════════════════════════════════════════════════
     UPLOAD & PARSING LOGIC
     ═══════════════════════════════════════════════════════════════ */

  static _onTriggerUpload(event, target) {
    const input = this.element.querySelector('.es-file-input');
    input.click();
    
    // Bind change event once
    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      await this._processUpload(files);
    };
  }

  async _processUpload(files) {
    const charName = this.uiState.data.name;
    // Sanitize folder name
    const folderName = charName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const targetDir = `exalted-scenes/characters/${folderName}`;

    // Create Directory (if possible via API, otherwise assume it might fail or we use a flat structure)
    // Foundry's FilePicker.createDirectory is available
    // Create Directory Structure
    try {
      await this._ensureDirectory('exalted-scenes');
      await this._ensureDirectory('exalted-scenes/characters');
      await this._ensureDirectory(targetDir);
    } catch (e) {
      console.error("Failed to create directory structure:", e);
      ui.notifications.error(format('Notifications.ErrorCreateDirectory', { path: targetDir }));
      return;
    }

    let processedCount = 0;
    const emotions = {};

    for (const file of files) {
      // Upload File
      try {
        // We use FilePicker.upload
        // Note: 'data' source is usually 'user' data.
        await FilePicker.upload('data', targetDir, file);
        
        const path = `${targetDir}/${file.name}`;
        
        // Smart Parse
        const emotionKey = this._parseEmotionName(file.name);
        
        emotions[emotionKey] = {
          key: emotionKey,
          path: path,
          excluded: false,
          isDefault: false
        };

      } catch (e) {
        console.error(`Failed to upload ${file.name}`, e);
      }

      processedCount++;
      this.uiState.uploadProgress = Math.round((processedCount / files.length) * 100);
      this.render();
    }

    // Set first as default
    const keys = Object.keys(emotions);
    if (keys.length > 0) {
      emotions[keys[0]].isDefault = true;
      this.uiState.data.defaultEmotion = keys[0];
    }

    this.uiState.data.emotions = emotions;
    this.uiState.step = 3; // Move to review
    this.render();
  }

  async _ensureDirectory(path) {
    try {
      // Try to browse first to see if it exists
      await FilePicker.browse('data', path);
    } catch (e) {
      // If browse fails, try to create it
      try {
        await FilePicker.createDirectory('data', path);
      } catch (createError) {
        // Ignore error if it claims it already exists (race condition or specific backend behavior)
        // But re-throw if it's a permission issue or other failure
        if (!createError.message.includes("EEXIST") && !createError.message.includes("already exists")) {
           console.warn(`Attempted to create ${path} but failed:`, createError);
           // We don't throw here immediately, we let the next step fail if it really didn't work
        }
      }
    }
  }

  _parseEmotionName(filename) {
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
    const underscoreIndex = nameWithoutExt.indexOf('_');
    
    if (underscoreIndex !== -1) {
      // "Shura_Happy" -> "Happy"
      // "Shura_Very_Angry" -> "Very Angry"
      return nameWithoutExt.substring(underscoreIndex + 1).replace(/_/g, ' ').trim();
    }
    return nameWithoutExt; // Fallback
  }

  /* ═══════════════════════════════════════════════════════════════
     REVIEW ACTIONS
     ═══════════════════════════════════════════════════════════════ */

  static _onToggleExclude(event, target) {
    const key = target.dataset.key;
    if (this.uiState.data.emotions[key]) {
      this.uiState.data.emotions[key].excluded = !this.uiState.data.emotions[key].excluded;
      this.render();
    }
  }

  static _onSetDefault(event, target) {
    const key = target.dataset.key;
    if (this.uiState.data.emotions[key] && !this.uiState.data.emotions[key].excluded) {
      this.uiState.data.defaultEmotion = key;
      this.render();
    }
  }

  static _onRenameEmotion(event, target) {
    const originalKey = target.dataset.originalKey;
    const newKey = target.value.trim();
    
    if (newKey && newKey !== originalKey) {
      // We need to update the key in the object. 
      // This is tricky because we are iterating over the object in HBS.
      // Ideally we should have used an array.
      // For now, let's just update a display property if we had one, but we used the key.
      
      const entry = this.uiState.data.emotions[originalKey];
      delete this.uiState.data.emotions[originalKey];
      entry.key = newKey;
      this.uiState.data.emotions[newKey] = entry;
      
      if (this.uiState.data.defaultEmotion === originalKey) {
        this.uiState.data.defaultEmotion = newKey;
      }
      
      this.render();
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     FINISH
     ═══════════════════════════════════════════════════════════════ */

  static async _onFinish(event, target) {
    const { name, tags, emotions, defaultEmotion } = this.uiState.data;
    
    // Construct States Object
    const finalStates = {};
    for (const [key, data] of Object.entries(emotions)) {
      if (!data.excluded) {
        finalStates[key] = data.path;
      }
    }

    if (Object.keys(finalStates).length === 0) {
      ui.notifications.warn(localize('Notifications.WarnNoEmotionsSelected'));
      return;
    }

    // Create Character
    const character = Store.createCharacter({
      name: name,
      states: finalStates,
      currentState: defaultEmotion || Object.keys(finalStates)[0],
      tags: tags
    });

    ui.notifications.info(format('Notifications.CharacterCreatedName', { name }));
    this.close();
    
    // Refresh GM Panel if open
    // We can emit an event or just rely on the store update if GM Panel is reactive (it isn't fully reactive yet, need to trigger render)
    // Assuming GMPanel is a singleton we can access
    const gmPanel = foundry.applications.instances.get('exalted-scenes-gm-panel');
    if (gmPanel) {
      gmPanel.render();
      // Optional: Select the new character
      gmPanel.uiState.selectedId = character.id;
      gmPanel.uiState.inspectorOpen = true;
      gmPanel.render();
    }
  }
}
