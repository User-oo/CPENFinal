// Find the controls in popup.html.
const darkTheme = document.querySelector("#dark-theme");
const educationMode = document.querySelector("#education-mode");
const filterStrength = document.querySelector("#filter-strength");
const breakReminder = document.querySelector("#break-reminder");
const topicInputs = document.querySelectorAll(".topic input");

const controls = [
    darkTheme,
    educationMode,
    filterStrength,
    breakReminder,
    ...topicInputs
];

// Use the existing note to show loading or saving problems.
const statusNote = document.querySelector(".settings-note");
statusNote.setAttribute("role", "status");

const defaultSettings = {
    darkTheme: false,
    educationMode: true,
    filterStrength: "Balanced",
    breakReminder: "After 15 minutes",
    topics: ["Science", "Technology"]
};

// Get the text beside a topic checkbox.
function getTopicName(input) {
    return input.nextElementSibling.textContent.trim();
}

// Collect the current selections.
function readSettings() {
    return {
        darkTheme: darkTheme.checked,
        educationMode: educationMode.checked,
        filterStrength: filterStrength.value,
        breakReminder: breakReminder.value,
        topics: [...topicInputs]
            .filter(input => input.checked)
            .map(getTopicName)
    };
}

// Apply previously saved selections.
function applySettings(settings) {
    darkTheme.checked = settings.darkTheme;
    educationMode.checked = settings.educationMode;
    filterStrength.value = settings.filterStrength;
    breakReminder.value = settings.breakReminder;

    topicInputs.forEach(input => {
        input.checked = settings.topics.includes(getTopicName(input));
    });
}

// Queue saves so rapid changes are written in order.
let saveQueue = Promise.resolve();

function saveSettings() {
    const settings = readSettings();

    saveQueue = saveQueue
        .then(() => chrome.storage.local.set({ settings }))
        .then(() => {
            statusNote.textContent =
                "Settings saved on this device. Filtering is not connected yet.";
        })
        .catch(error => {
            console.error("Could not save settings:", error);
            statusNote.textContent =
                "Settings could not be saved. Try changing the setting again.";
        });
}

// Load settings before allowing changes.
async function initializePopup() {
    controls.forEach(control => {
        control.disabled = true;
    });

    try {
        const result = await chrome.storage.local.get("settings");

        const settings = {
            ...defaultSettings,
            ...result.settings
        };

        applySettings(settings);

        controls.forEach(control => {
            control.addEventListener("change", saveSettings);
            control.disabled = false;
        });
    } catch (error) {
        console.error("Could not load settings:", error);
        statusNote.textContent =
            "Could not load settings. Open this as an installed extension " +
            "and check the storage permission.";
    }
}

initializePopup();