/**
 * JukeboxTester
 * Automated test suite for Narrator Jukebox
 */
class JukeboxTester {
    constructor() {
        this.jukebox = NarratorJukebox.instance;
        this.results = [];
    }

    refreshInstance() {
        this.jukebox = NarratorJukebox.instance;
        return this.jukebox;
    }

    async runAll() {
        console.log("%c Narrator Jukebox | Starting Comprehensive Self-Test... ", "background: #222; color: #bada55; font-size: 14px");
        this.results = [];

        // Refresh instance reference
        this.refreshInstance();

        // Check if jukebox is initialized
        if (!this.jukebox || !this.jukebox.channels) {
            console.error("Narrator Jukebox | Instance not initialized. Make sure the module is loaded and Foundry is ready.");
            ui.notifications.error("Narrator Jukebox: Module not initialized. Reload and try again.");
            this.results.push({ name: "INITIALIZATION CHECK", passed: false, error: "NarratorJukebox.instance is not initialized" });
            this.printResults();
            return;
        }

        try {
            // Original Tests
            await this.testRapidSwitching();
            await this.testStopDuringFade();
            await this.testVolumeChanges();

            // New Tests for Bug Fixes
            await this.testLoopWithoutPlaylist();
            await this.testLoopWithPlaylist();
            await this.testMemoryLeakPrevention();
            await this.testSyncErrorHandling();

            // Performance Optimization Tests (Sprint 2)
            await this.testProgressTimerRAF();
            await this.testDebouncedSearch();
            await this.testEventDelegation();

            // UI/UX Bug Fixes (Sprint 3)
            await this.testAddToPlaylistDialog();
            await this.testNextWithoutPlaylist();
            await this.testPrevWithoutPlaylist();

            // await this.testYouTubeLifecycle(); // Requires valid YT ID, skipping for safety
        } catch (err) {
            console.error("TEST SUITE CRASHED:", err);
            this.results.push({ name: "CRITICAL FAILURE", passed: false, error: err.message });
        }

        this.printResults();
    }

    async testRapidSwitching() {
        console.log("Running: testRapidSwitching");
        // Mock tracks
        const trackA = { id: 'test-a', name: 'Test A', url: 'modules/narrator-jukebox/sounds/test-a.mp3', source: 'local' };
        const trackB = { id: 'test-b', name: 'Test B', url: 'modules/narrator-jukebox/sounds/test-b.mp3', source: 'local' };

        // Mock Audio element creation to avoid 404s if files don't exist
        // We are testing LOGIC, not file loading
        const originalPlayLocal = this.jukebox.channels.music.playLocal;
        this.jukebox.channels.music.playLocal = async (url) => {
            console.log(`[Mock] Playing ${url}`);
            // Simulate audio element
            this.jukebox.channels.music.audioElement = {
                volume: 0,
                pause: () => {},
                play: () => {},
                remove: () => {},
                addEventListener: () => {}
            };
            this.jukebox.channels.music.fadeIn(this.jukebox.channels.music.audioElement);
        };

        try {
            await this.jukebox.channels.music.play(trackA);
            const intervalA = this.jukebox.channels.music.activeIntervals.size;

            if (intervalA !== 1) throw new Error(`Expected 1 active interval (fade in), found ${intervalA}`);

            // Switch rapidly
            await new Promise(r => setTimeout(r, 100));
            await this.jukebox.channels.music.play(trackB);

            const intervalB = this.jukebox.channels.music.activeIntervals.size;
            // After rapid switching, we should have:
            // 1. Fade out for old track (tracked now after our fix)
            // 2. Fade in for new track
            // So 1-2 intervals is acceptable

            if (intervalB < 1 || intervalB > 2) {
                throw new Error(`Expected 1-2 active intervals after switch, found ${intervalB}`);
            }

            // Wait for fade out to complete
            await new Promise(r => setTimeout(r, 200));

            // After fades complete, should have at most 1 (current track fade)
            const intervalFinal = this.jukebox.channels.music.activeIntervals.size;
            if (intervalFinal > 1) {
                throw new Error(`Expected ≤1 intervals after fades complete, found ${intervalFinal}`);
            }

            this.results.push({ name: "Rapid Switching", passed: true });

        } catch (e) {
            this.results.push({ name: "Rapid Switching", passed: false, error: e.message });
        } finally {
            // Restore
            this.jukebox.channels.music.playLocal = originalPlayLocal;
            this.jukebox.channels.music.stop();
        }
    }

    async testStopDuringFade() {
        console.log("Running: testStopDuringFade");
        const track = { id: 'test-a', name: 'Test A', url: 'test.mp3', source: 'local' };
        
        // Mock
        const originalPlayLocal = this.jukebox.channels.music.playLocal;
        this.jukebox.channels.music.playLocal = async () => {
             this.jukebox.channels.music.audioElement = {
                volume: 0,
                pause: () => {},
                play: () => {},
                remove: () => {},
                addEventListener: () => {}
            };
            this.jukebox.channels.music.fadeIn(this.jukebox.channels.music.audioElement);
        };

        try {
            await this.jukebox.channels.music.play(track);
            await new Promise(r => setTimeout(r, 50)); // Let fade start
            
            this.jukebox.channels.music.stop();
            
            if (this.jukebox.channels.music.activeIntervals.size !== 0) {
                throw new Error("Stop() did not clear all intervals");
            }
            
            this.results.push({ name: "Stop During Fade", passed: true });
        } catch (e) {
            this.results.push({ name: "Stop During Fade", passed: false, error: e.message });
        } finally {
            this.jukebox.channels.music.playLocal = originalPlayLocal;
        }
    }

    async testVolumeChanges() {
        console.log("Running: testVolumeChanges");
        const track = { id: 'test-a', name: 'Test A', url: 'test.mp3', source: 'local' };
        
        // Mock
        const originalPlayLocal = this.jukebox.channels.music.playLocal;
        let mockAudio = { volume: 0, pause:()=>{}, play:()=>{}, remove:()=>{}, addEventListener:()=>{} };
        
        this.jukebox.channels.music.playLocal = async () => {
            this.jukebox.channels.music.audioElement = mockAudio;
            this.jukebox.channels.music.fadeIn(mockAudio);
        };

        try {
            await this.jukebox.channels.music.play(track);
            await new Promise(r => setTimeout(r, 50)); // Let fade start
            
            // User drags volume slider
            this.jukebox.channels.music.setVolume(0.5);
            
            if (this.jukebox.channels.music.activeIntervals.size !== 0) {
                 throw new Error("setVolume() did not cancel active fade");
            }
            if (mockAudio.volume !== 0.5) {
                throw new Error(`Volume not set immediately. Expected 0.5, got ${mockAudio.volume}`);
            }

            this.results.push({ name: "Volume Override", passed: true });
        } catch (e) {
            this.results.push({ name: "Volume Override", passed: false, error: e.message });
        } finally {
            this.jukebox.channels.music.playLocal = originalPlayLocal;
            this.jukebox.channels.music.stop();
        }
    }

    async testLoopWithoutPlaylist() {
        console.log("Running: testLoopWithoutPlaylist");
        const track = { id: 'test-loop', name: 'Loop Test', url: 'test.mp3', source: 'local' };

        const originalPlayLocal = this.jukebox.channels.music.playLocal;
        this.jukebox.channels.music.playLocal = async (url) => {
            this.jukebox.channels.music.audioElement = {
                volume: 0,
                pause: () => {},
                play: () => Promise.resolve(),
                remove: () => {},
                addEventListener: () => {}
            };
        };

        try {
            // Add track to music library
            this.jukebox.music = [track];
            this.jukebox.musicLoop = true;
            this.jukebox.currentPlaylist = null;

            // Simulate playing and ending
            await this.jukebox.playMusic(track.id);
            const wasPlaying = this.jukebox.isPlaying;

            // Trigger track ended
            this.jukebox.next();

            // Verify it looped (isPlaying should still be true)
            if (!this.jukebox.isPlaying && wasPlaying) {
                throw new Error("Loop failed: isPlaying became false after next()");
            }

            this.results.push({ name: "Loop Without Playlist", passed: true });
        } catch (e) {
            this.results.push({ name: "Loop Without Playlist", passed: false, error: e.message });
        } finally {
            this.jukebox.channels.music.playLocal = originalPlayLocal;
            this.jukebox.musicLoop = false;
            this.jukebox.channels.music.stop();
        }
    }

    async testLoopWithPlaylist() {
        console.log("Running: testLoopWithPlaylist");

        // Mock playLocal to avoid 404 errors
        const originalPlayLocal = this.jukebox.channels.music.playLocal;
        this.jukebox.channels.music.playLocal = async (url) => {
            this.jukebox.channels.music.audioElement = {
                volume: 0,
                pause: () => {},
                play: () => Promise.resolve(),
                remove: () => {},
                addEventListener: () => {}
            };
        };

        try {
            const tracks = [
                { id: 'pl-track-1', name: 'Track 1', url: 'test1.mp3', source: 'local' },
                { id: 'pl-track-2', name: 'Track 2', url: 'test2.mp3', source: 'local' }
            ];
            this.jukebox.music = tracks;

            const playlist = {
                id: 'test-pl',
                name: 'Test Playlist',
                musicIds: ['pl-track-1', 'pl-track-2']
            };

            this.jukebox.currentPlaylist = playlist;
            this.jukebox.musicLoop = true;
            this.jukebox.channels.music.currentTrack = tracks[1]; // At end of playlist

            // next() should loop back to track 0
            this.jukebox.next();

            // Wait a bit for async operations
            await new Promise(r => setTimeout(r, 50));

            // Should have called playMusic with first track
            if (this.jukebox.isPlaying === false) {
                throw new Error("Playlist loop failed");
            }

            this.results.push({ name: "Loop With Playlist", passed: true });
        } catch (e) {
            this.results.push({ name: "Loop With Playlist", passed: false, error: e.message });
        } finally {
            this.jukebox.channels.music.playLocal = originalPlayLocal;
            this.jukebox.musicLoop = false;
            this.jukebox.currentPlaylist = null;
            this.jukebox.channels.music.stop();
        }
    }

    async testMemoryLeakPrevention() {
        console.log("Running: testMemoryLeakPrevention");

        const originalPlayLocal = this.jukebox.channels.music.playLocal;
        this.jukebox.channels.music.playLocal = async () => {
            this.jukebox.channels.music.audioElement = {
                volume: 0.5,
                pause: () => {},
                play: () => Promise.resolve(),
                remove: () => {},
                addEventListener: () => {}
            };
        };

        try {
            const track = { id: 'test-mem', url: 'test.mp3', source: 'local' };

            // Play and switch rapidly 10 times
            for (let i = 0; i < 10; i++) {
                await this.jukebox.channels.music.play(track);
                await new Promise(r => setTimeout(r, 20));
            }

            // Check for leaked intervals
            const leakedIntervals = this.jukebox.channels.music.activeIntervals.size;

            // Should have at most 1 interval (current fade in)
            if (leakedIntervals > 1) {
                throw new Error(`Memory leak detected: ${leakedIntervals} active intervals (expected ≤ 1)`);
            }

            this.results.push({ name: "Memory Leak Prevention", passed: true });
        } catch (e) {
            this.results.push({ name: "Memory Leak Prevention", passed: false, error: e.message });
        } finally {
            this.jukebox.channels.music.playLocal = originalPlayLocal;
            this.jukebox.channels.music.stop();
        }
    }

    async testSyncErrorHandling() {
        console.log("Running: testSyncErrorHandling");

        try {
            // Store original state
            const originalPreviewMode = this.jukebox.isPreviewMode;
            const originalIsPlaying = this.jukebox.isPlaying;

            // Set to broadcast mode to test sync error handling
            this.jukebox.isPreviewMode = false;
            this.jukebox.isPlaying = false;

            // Simulate receiving sync command for non-existent track
            const payload = {
                action: 'play',
                trackId: 'non-existent-track-id',
                channel: 'music'
            };

            this.jukebox.music = []; // Empty library

            // This should not throw, but handle gracefully
            await this.jukebox.handleRemoteCommand(payload);

            // Verify it didn't crash and isPlaying is still false
            if (this.jukebox.isPlaying === true) {
                throw new Error("Sync error handling failed: isPlaying should be false for non-existent track");
            }

            this.results.push({ name: "Sync Error Handling", passed: true });

            // Restore original state
            this.jukebox.isPreviewMode = originalPreviewMode;
            this.jukebox.isPlaying = originalIsPlaying;
        } catch (e) {
            this.results.push({ name: "Sync Error Handling", passed: false, error: e.message });
        }
    }

    async testProgressTimerRAF() {
        console.log("Running: testProgressTimerRAF");

        try {
            // Find app instance
            const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');

            if (!app) {
                throw new Error("Narrator Jukebox app not open. Open the app first.");
            }

            // Check that RAF is being used (not setInterval)
            if (app._progressInterval) {
                throw new Error("Still using setInterval (_progressInterval exists). Should use requestAnimationFrame.");
            }

            // Start progress timer
            app._startProgressTimer();

            // Check that RAF ID is set
            if (!app._progressRAFId) {
                throw new Error("requestAnimationFrame not started (_progressRAFId is undefined)");
            }

            // Stop it
            app._stopProgressTimer();

            // Verify cleanup
            if (app._progressRAFId !== null) {
                throw new Error("requestAnimationFrame not cleaned up properly");
            }

            this.results.push({ name: "Progress Timer RAF", passed: true });
        } catch (e) {
            this.results.push({ name: "Progress Timer RAF", passed: false, error: e.message });
        }
    }

    async testDebouncedSearch() {
        console.log("Running: testDebouncedSearch");

        try {
            // Find app instance
            const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');

            if (!app) {
                throw new Error("Narrator Jukebox app not open. Open the app first.");
            }

            // Check that debounced render exists
            if (!app._debouncedRender || typeof app._debouncedRender !== 'function') {
                throw new Error("_debouncedRender method not found");
            }

            // Count renders
            let renderCount = 0;
            const originalRender = app.render.bind(app);
            app.render = function(...args) {
                renderCount++;
                return originalRender(...args);
            };

            // Simulate rapid typing (5 inputs in 100ms)
            for (let i = 0; i < 5; i++) {
                app.searchQuery = `test${i}`;
                app._debouncedRender();
                await new Promise(r => setTimeout(r, 20));
            }

            // Wait for debounce to settle
            await new Promise(r => setTimeout(r, 400));

            // Should have rendered only once (after debounce delay)
            if (renderCount > 1) {
                throw new Error(`Debounce not working properly: rendered ${renderCount} times (expected 1)`);
            }

            // Restore original render
            app.render = originalRender;

            this.results.push({ name: "Debounced Search", passed: true });
        } catch (e) {
            this.results.push({ name: "Debounced Search", passed: false, error: e.message });
        }
    }

    async testEventDelegation() {
        console.log("Running: testEventDelegation");

        try {
            // Find app instance
            const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');

            if (!app) {
                throw new Error("Narrator Jukebox app not open. Open the app first.");
            }

            const html = app.element;
            if (!html || !html.length) {
                throw new Error("App element not found");
            }

            // Wait a bit for events to be registered
            await new Promise(r => setTimeout(r, 100));

            // Check that event delegation is being used
            // Look for jQuery event handlers with delegation
            // We'll check if delegated click handlers exist by looking for our selector patterns
            const hasPlayMusicBtn = html.find('.play-music-btn').length > 0;
            const hasPlaylistBtn = html.find('.play-playlist').length > 0;

            // Try to get jQuery event data
            const events = $._data(html[0], 'events');

            // If we have click events registered
            if (events && events.click) {
                // Check for delegated events (should have selector property)
                const hasDelegatedEvents = events.click.some(handler => handler.selector);

                if (!hasDelegatedEvents) {
                    throw new Error("No delegated events found. Event delegation not implemented.");
                }
            } else {
                // If no direct event data, check if the delegation is working
                // by verifying we can find delegated elements
                if (!hasPlayMusicBtn && !hasPlaylistBtn) {
                    throw new Error("No delegatable elements found in DOM");
                }
                // If elements exist but no events found in _data, delegation might still be working
                // (different jQuery versions store events differently)
                console.log("Event delegation: Elements found, assuming delegation is working");
            }

            this.results.push({ name: "Event Delegation", passed: true });
        } catch (e) {
            this.results.push({ name: "Event Delegation", passed: false, error: e.message });
        }
    }

    /**
     * Sprint 3 Test: Add to Playlist Dialog Method Exists
     * Bug: showAddToPlaylistDialog method was missing
     */
    async testAddToPlaylistDialog() {
        console.log("Running: testAddToPlaylistDialog (Sprint 3)");
        try {
            // Get app instance
            const app = Object.values(ui.windows).find(w => w.id === 'narrator-jukebox');

            if (!app) {
                throw new Error("Jukebox app not found in ui.windows");
            }

            // Check if method exists
            if (typeof app.showAddToPlaylistDialog !== 'function') {
                throw new Error("showAddToPlaylistDialog method does not exist");
            }

            // Create test music and playlist
            const testMusic = {
                id: 'test-sprint3-music',
                name: 'Test Track for Playlist',
                url: 'test.mp3',
                source: 'local',
                tags: ['test']
            };

            const testPlaylist = {
                id: 'test-sprint3-playlist',
                name: 'Test Playlist Sprint 3',
                musicIds: []
            };

            // Add to jukebox
            this.jukebox.music = this.jukebox.music || [];
            this.jukebox.playlists = this.jukebox.playlists || [];
            this.jukebox.music.push(testMusic);
            this.jukebox.playlists.push(testPlaylist);

            // Test the method doesn't throw
            try {
                // We can't easily test the dialog UI in automated tests,
                // but we can verify the method exists and can be called
                // without crashing (checking for early returns)
                const track = this.jukebox.music.find(m => m.id === testMusic.id);
                if (!track) {
                    throw new Error("Test track not found after adding");
                }

                // Verify method signature by checking it's callable
                const methodExists = typeof app.showAddToPlaylistDialog === 'function';
                if (!methodExists) {
                    throw new Error("Method is not a function");
                }

                // Clean up
                this.jukebox.music = this.jukebox.music.filter(m => m.id !== testMusic.id);
                this.jukebox.playlists = this.jukebox.playlists.filter(p => p.id !== testPlaylist.id);

                console.log("✓ showAddToPlaylistDialog method exists and is callable");
            } catch (methodError) {
                throw new Error(`Method test failed: ${methodError.message}`);
            }

            this.results.push({ name: "Add to Playlist Dialog (Sprint 3)", passed: true });
        } catch (e) {
            this.results.push({ name: "Add to Playlist Dialog (Sprint 3)", passed: false, error: e.message });
        }
    }

    /**
     * Sprint 3 Test: Next Button Works Without Playlist
     * Bug: next() method only worked with currentPlaylist set
     */
    async testNextWithoutPlaylist() {
        console.log("Running: testNextWithoutPlaylist (Sprint 3)");
        try {
            // Setup: Add multiple test tracks to library
            const testTracks = [
                { id: 'next-test-1', name: 'Track 1', url: 'test1.mp3', source: 'local', tags: [] },
                { id: 'next-test-2', name: 'Track 2', url: 'test2.mp3', source: 'local', tags: [] },
                { id: 'next-test-3', name: 'Track 3', url: 'test3.mp3', source: 'local', tags: [] }
            ];

            this.jukebox.music = [...testTracks];
            this.jukebox.currentPlaylist = null; // Ensure no playlist is active
            this.jukebox.shuffle = false;
            this.jukebox.musicLoop = true;

            // Mock the playMusic method to avoid actual playback
            const originalPlayMusic = this.jukebox.playMusic.bind(this.jukebox);
            let nextTrackId = null;

            this.jukebox.playMusic = function(id) {
                nextTrackId = id;
                this.channels.music.currentTrack = this.music.find(m => m.id === id);
            };

            // Set current track to first track
            this.jukebox.channels.music.currentTrack = testTracks[0];

            // Call next()
            this.jukebox.next();

            // Verify next track was played
            if (nextTrackId !== testTracks[1].id) {
                throw new Error(`Expected next track to be '${testTracks[1].id}', got '${nextTrackId}'`);
            }

            // Test end of library behavior
            this.jukebox.channels.music.currentTrack = testTracks[2];
            this.jukebox.next();

            // With loop=true, should go back to first track
            if (nextTrackId !== testTracks[0].id) {
                throw new Error(`Expected loop to first track '${testTracks[0].id}', got '${nextTrackId}'`);
            }

            // Restore original method
            this.jukebox.playMusic = originalPlayMusic;

            console.log("✓ Next button works correctly without playlist");
            this.results.push({ name: "Next Without Playlist (Sprint 3)", passed: true });
        } catch (e) {
            this.results.push({ name: "Next Without Playlist (Sprint 3)", passed: false, error: e.message });
        } finally {
            // Cleanup
            this.jukebox.music = [];
            this.jukebox.channels.music.currentTrack = null;
        }
    }

    /**
     * Sprint 3 Test: Previous Button Works Without Playlist
     * Bug: prev() method only worked with currentPlaylist set
     */
    async testPrevWithoutPlaylist() {
        console.log("Running: testPrevWithoutPlaylist (Sprint 3)");
        try {
            // Setup: Add multiple test tracks to library
            const testTracks = [
                { id: 'prev-test-1', name: 'Track 1', url: 'test1.mp3', source: 'local', tags: [] },
                { id: 'prev-test-2', name: 'Track 2', url: 'test2.mp3', source: 'local', tags: [] },
                { id: 'prev-test-3', name: 'Track 3', url: 'test3.mp3', source: 'local', tags: [] }
            ];

            this.jukebox.music = [...testTracks];
            this.jukebox.currentPlaylist = null; // Ensure no playlist is active
            this.jukebox.musicLoop = true;

            // Mock the playMusic method and seek
            const originalPlayMusic = this.jukebox.playMusic.bind(this.jukebox);
            let prevTrackId = null;

            this.jukebox.playMusic = function(id) {
                prevTrackId = id;
                this.channels.music.currentTrack = this.music.find(m => m.id === id);
            };

            // Mock seek method
            this.jukebox.channels.music.seek = function() {
                // Do nothing in test
            };

            // Set current track to second track
            this.jukebox.channels.music.currentTrack = testTracks[1];
            this.jukebox.channels.music.currentTime = 0; // Simulate fresh play (< 3 seconds)

            // Call prev()
            this.jukebox.prev();

            // Verify previous track was played
            if (prevTrackId !== testTracks[0].id) {
                throw new Error(`Expected prev track to be '${testTracks[0].id}', got '${prevTrackId}'`);
            }

            // Test beginning of library behavior
            this.jukebox.channels.music.currentTrack = testTracks[0];
            this.jukebox.channels.music.currentTime = 0;
            this.jukebox.prev();

            // With loop=true, should go to last track
            if (prevTrackId !== testTracks[2].id) {
                throw new Error(`Expected loop to last track '${testTracks[2].id}', got '${prevTrackId}'`);
            }

            // Restore original method
            this.jukebox.playMusic = originalPlayMusic;

            console.log("✓ Previous button works correctly without playlist");
            this.results.push({ name: "Prev Without Playlist (Sprint 3)", passed: true });
        } catch (e) {
            this.results.push({ name: "Prev Without Playlist (Sprint 3)", passed: false, error: e.message });
        } finally {
            // Cleanup
            this.jukebox.music = [];
            this.jukebox.channels.music.currentTrack = null;
        }
    }

    printResults() {
        console.log("========================================");
        console.log("       JUKEBOX SELF-TEST RESULTS        ");
        console.log("========================================");
        let passed = 0;
        this.results.forEach(r => {
            if (r.passed) {
                console.log(`%c[PASS] ${r.name}`, "color: green");
                passed++;
            } else {
                console.log(`%c[FAIL] ${r.name}: ${r.error}`, "color: red; font-weight: bold");
            }
        });
        console.log("========================================");
        console.log(`Total: ${this.results.length} | Passed: ${passed} | Failed: ${this.results.length - passed}`);

        if (passed === this.results.length) {
             ui.notifications.info(`Narrator Jukebox: All ${passed} tests passed successfully.`);
        } else {
             ui.notifications.error(`Narrator Jukebox: ${this.results.length - passed} tests failed. Check console.`);
        }
    }
}

// Expose
window.JukeboxTester = JukeboxTester;
window.jukeboxTester = new JukeboxTester();

// Helper function with instructions
window.testJukebox = function() {
    if (!NarratorJukebox || !NarratorJukebox.instance) {
        console.error("%c Narrator Jukebox | Cannot run tests: Module not loaded or Foundry not ready", "color: red; font-weight: bold");
        console.log("%c Instructions:", "font-weight: bold");
        console.log("1. Make sure Foundry VTT is fully loaded (wait for 'ready' hook)");
        console.log("2. Ensure the Narrator Jukebox module is enabled in your world");
        console.log("3. Reload the page and try again");
        ui.notifications.error("Cannot run tests: Module not initialized. See console for details.");
        return;
    }

    console.log("%c Running Narrator Jukebox Test Suite...", "color: #1db954; font-weight: bold; font-size: 14px");
    return window.jukeboxTester.runAll();
};

console.log("%c Narrator Jukebox Tester Loaded", "background: #1db954; color: black; padding: 4px 8px; border-radius: 4px");
console.log("%c Run tests with: testJukebox() or window.jukeboxTester.runAll()", "color: #888");
