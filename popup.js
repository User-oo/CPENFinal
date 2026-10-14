const defaults = {
    darkTheme: false,
    educationMode: false,
    filterStrength: "Balanced",
    breakReminder: "After 15 minutes",
    topics: ["Science", "Technology"]
};

async function startPopup() {
    const darkTheme = document.getElementById("dark-theme");
    const educationMode = document.getElementById("education-mode");
    const filterStrength = document.getElementById("filter-strength");
    const breakReminder = document.getElementById("break-reminder");
    const topics = [...document.querySelectorAll(".topic input")];

    const footer = document.querySelector("footer");
    const settingsNote = document.querySelector(".settings-note");

    function showStatus(message) {
        if (footer) {
            footer.textContent = message;
            footer.setAttribute("role", "status");
        }

        if (settingsNote) {
            settingsNote.textContent = message;
        }
    }

    // Check that popup.html has the IDs this script needs.
    if (
        !darkTheme ||
        !educationMode ||
        !filterStrength ||
        !breakReminder ||
        topics.length === 0
    ) {
        showStatus("HTML mismatch: check the control IDs in popup.html.");
        console.error("Reset: one or more popup controls are missing.");
        return;
    }

    const controls = [
        darkTheme,
        educationMode,
        filterStrength,
        breakReminder,
        ...topics
    ];

    function topicName(input) {
        return input.closest(".topic")
            .querySelector("span")
            .textContent.trim();
    }

    function applySettings(settings) {
        darkTheme.checked = settings.darkTheme;
        educationMode.checked = settings.educationMode;
        filterStrength.value = settings.filterStrength;
        breakReminder.value = settings.breakReminder;

        topics.forEach(input => {
            input.checked = settings.topics.includes(topicName(input));
        });
    }

    function readSettings() {
        return {
            darkTheme: darkTheme.checked,
            educationMode: educationMode.checked,
            filterStrength: filterStrength.value,
            breakReminder: breakReminder.value,
            topics: topics
                .filter(input => input.checked)
                .map(topicName)
        };
    }

    if (!globalThis.chrome?.storage?.local) {
        showStatus("Open this popup through the installed extension.");
        return;
    }

    // Briefly lock controls while loading saved choices.
    controls.forEach(control => {
        control.disabled = true;
    });

    let loaded = false;

    try {
        const result = await chrome.storage.local.get("settings");
        const settings = { ...defaults, ...result.settings };

        if (!Array.isArray(settings.topics)) {
            settings.topics = [...defaults.topics];
        }

        applySettings(settings);
        loaded = true;

        showStatus("Settings loaded from this device.");
    } catch (error) {
        console.error("Reset loading error:", error);
        showStatus("Could not load settings. Reload the extension.");
    } finally {
        controls.forEach(control => {
            control.disabled = false;
        });
    }

    if (!loaded) return;

    // Save changes in the order they happen.
    let saveQueue = Promise.resolve();

    controls.forEach(control => {
        control.addEventListener("change", () => {
            const settings = readSettings();

            showStatus("Saving...");

            saveQueue = saveQueue
                .then(() => chrome.storage.local.set({ settings }))
                .then(() => {
                    const mode = settings.educationMode ? "ON" : "OFF";

                    showStatus(
                        `Saved · Education ${mode} · ${settings.filterStrength}`
                    );
                })
                .catch(error => {
                    console.error("Reset saving error:", error);
                    showStatus("Save failed. Reload the extension.");
                });
        });
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startPopup);
} else {
    startPopup();
}