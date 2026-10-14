// Keywords for each learning topic.
const topicKeywords = {
    Science: [
        "science", "physics", "chemistry", "biology",
        "space", "astronomy", "experiment", "neuroscience"
    ],
    Technology: [
        "technology", "programming", "coding", "python",
        "javascript", "computer", "engineering",
        "artificial intelligence", "robotics", "cybersecurity"
    ],
    Art: [
        "art", "drawing", "painting", "design",
        "sculpture", "illustration", "animation", "photography"
    ],
    History: [
        "history", "historical", "ancient", "civilization",
        "archaeology", "medieval", "roman", "world war"
    ]
};

const learningKeywords = [
    "tutorial", "explained", "lesson", "lecture",
    "learn", "how to", "documentary", "beginner", "beginners"
];

const defaults = {
    educationMode: false,
    filterStrength: "Balanced",
    topics: ["Science", "Technology"]
};

let settings = { ...defaults };
let ready = false;
let scheduled = false;

const hiddenClass = "reset-extension-hidden";

// Only this extension's marked cards are hidden.
const style = document.createElement("style");
style.textContent = `
    .${hiddenClass} {
        display: none !important;
    }
`;
document.documentElement.appendChild(style);

// Normalize punctuation and capitalization.
function normalize(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

// Match complete words or phrases.
// For example, "art" should not match "party".
function containsKeyword(text, keywords) {
    const normalizedText = ` ${normalize(text)} `;

    return keywords.some(keyword => {
        return normalizedText.includes(` ${normalize(keyword)} `);
    });
}

function shouldKeepVideo(title) {
    const keywords = settings.topics.flatMap(topic => {
        return topicKeywords[topic] || [];
    });

    const matchesTopic = containsKeyword(title, keywords);
    const looksEducational = containsKeyword(title, learningKeywords);

    switch (settings.filterStrength) {
        case "Gentle":
            return matchesTopic || looksEducational;

        case "Strict":
            return matchesTopic && looksEducational;

        default:
            return matchesTopic;
    }
}

function restoreVideos() {
    document.querySelectorAll(`.${hiddenClass}`).forEach(card => {
        card.classList.remove(hiddenClass);
    });
}

function filterFeed() {
    if (!ready) return;

    // Only filter Home, not searches or video watch pages.
    const isHome = window.location.pathname === "/";

    if (
        !isHome ||
        !settings.educationMode ||
        settings.topics.length === 0
    ) {
        restoreVideos();
        return;
    }

    const cards = document.querySelectorAll(
        'ytd-browse[page-subtype="home"] ytd-rich-item-renderer'
    );

    cards.forEach(card => {
        // Support multiple YouTube title layouts.
        const titleElement = card.querySelector(
            '#video-title, ' +
            'a.yt-lockup-metadata-view-model__title, ' +
            'a.ytLockupMetadataViewModelTitle, ' +
            'h3 a[href*="/watch"]'
        );

        const title = titleElement?.textContent.trim();

        // Leave unknown cards visible rather than guessing.
        if (!title) {
            card.classList.remove(hiddenClass);
            return;
        }

        card.classList.toggle(hiddenClass, !shouldKeepVideo(title));
    });
}

// Batch updates as YouTube loads more videos.
function scheduleFilter() {
    if (scheduled) return;

    scheduled = true;

    window.setTimeout(() => {
        scheduled = false;
        filterFeed();
    }, 200);
}

async function initializeFilter() {
    try {
        const result = await chrome.storage.local.get("settings");

        settings = {
            ...defaults,
            ...result.settings
        };

        ready = true;
        filterFeed();
    } catch (error) {
        console.error("Reset could not load settings:", error);
    }
}

// React when the popup saves a setting.
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.settings) return;

    settings = {
        ...defaults,
        ...changes.settings.newValue
    };

    ready = true;
    filterFeed();
});

// YouTube loads videos without refreshing the whole page.
const observer = new MutationObserver(scheduleFilter);

observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
});

document.addEventListener("yt-navigate-finish", scheduleFilter);

initializeFilter();