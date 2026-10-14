(() => {
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

    // Covers Home, search, channel lists, and related-video cards.
    const cardSelector = [
        "ytd-rich-item-renderer",
        "ytd-video-renderer",
        "ytd-grid-video-renderer",
        "ytd-compact-video-renderer",
        "yt-lockup-view-model",
        "ytd-reel-item-renderer",
        "ytm-shorts-lockup-view-model",
        "ytd-channel-video-player-renderer"
    ].join(", ");

    const titleSelector = [
        "#video-title",
        "a.yt-lockup-metadata-view-model__title",
        "a.ytLockupMetadataViewModelTitle",
        ".shortsLockupViewModelHostMetadataTitle",
        "h3 a",
        "h3"
    ].join(", ");

    let settings = { ...defaults };
    let ready = false;
    let navigating = false;
    let settingsVersion = 0;

    function normalize(text) {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
    }

    function containsKeyword(text, keywords) {
        const normalizedText = ` ${normalize(text)} `;

        return keywords.some(keyword =>
            normalizedText.includes(` ${normalize(keyword)} `)
        );
    }

    function topicFilteringActive() {
        return (
            ready &&
            settings.educationMode &&
            settings.topics.length > 0
        );
    }

    function strictActive() {
        return (
            ready &&
            settings.educationMode &&
            settings.filterStrength === "Strict"
        );
    }

    function shouldKeepVideo(title) {
        const keywords = settings.topics.flatMap(topic =>
            topicKeywords[topic] || []
        );

        const matchesTopic = containsKeyword(title, keywords);
        const educational = containsKeyword(title, learningKeywords);

        if (settings.filterStrength === "Gentle") {
            return matchesTopic || educational;
        }

        if (settings.filterStrength === "Strict") {
            return matchesTopic && educational;
        }

        return matchesTopic;
    }

    function checkCard(card) {
        if (!topicFilteringActive()) {
            card.removeAttribute("data-reset-approved");
            return;
        }

        const videoLink = card.querySelector(
            'a[href*="/watch?"], a[href*="/shorts/"]'
        );

        const titleElement = card.querySelector(titleSelector);
        const title = titleElement?.textContent.trim() || "";

        const isShort = Boolean(
            card.querySelector('a[href*="/shorts/"]')
        );

        // Missing titles and non-video cards stay hidden.
        const approved = Boolean(
            videoLink &&
            title &&
            !(strictActive() && isShort) &&
            shouldKeepVideo(title)
        );

        card.toggleAttribute("data-reset-approved", approved);
    }

    function clearApprovals() {
        document.querySelectorAll("[data-reset-approved]")
            .forEach(card => {
                card.removeAttribute("data-reset-approved");
            });
    }

    function filterAllCards() {
        if (!ready || navigating) return;

        document.querySelectorAll(cardSelector).forEach(checkCard);
    }

    function enforceShortsRule() {
        if (
            strictActive() &&
            /^\/shorts(?:\/|$)/.test(location.pathname)
        ) {
            location.replace("https://www.youtube.com/");
        }
    }

    function applySettings(value) {
        settings = { ...defaults, ...(value || {}) };

        settings.educationMode = settings.educationMode === true;

        if (!Array.isArray(settings.topics)) {
            settings.topics = [...defaults.topics];
        }

        ready = true;

        // Remove approvals from the previous selection.
        clearApprovals();

        document.documentElement.setAttribute(
            "data-reset-filter",
            topicFilteringActive() ? "on" : "off"
        );

        document.documentElement.setAttribute(
            "data-reset-strict",
            String(strictActive())
        );

        filterAllCards();
        enforceShortsRule();
    }

    /*
    MutationObserver runs before the next normal paint.
    CSS already hides newly inserted cards until approved.
    Only changed cards are checked.
    */
    const observer = new MutationObserver(records => {
        if (!ready || navigating || !topicFilteringActive()) return;

        const changedCards = new Set();

        function collect(node) {
            const element = node.nodeType === Node.ELEMENT_NODE
                ? node
                : node.parentElement;

            if (!element) return;

            // Include containing cards, including nested wrappers.
            let parent = element;

            while (parent) {
                if (parent.matches(cardSelector)) {
                    changedCards.add(parent);
                }

                parent = parent.parentElement;
            }

            element.querySelectorAll(cardSelector).forEach(card => {
                changedCards.add(card);
            });
        }

        records.forEach(record => {
            collect(record.target);
            record.addedNodes.forEach(collect);
        });

        changedCards.forEach(checkCard);
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        // Do not observe our approval attribute.
        attributeFilter: ["href", "title", "aria-label"]
    });

    // Hide previously approved cards during YouTube page transitions.
    document.addEventListener("yt-navigate-start", () => {
        navigating = true;
        clearApprovals();
    });

    document.addEventListener("yt-navigate-finish", () => {
        navigating = false;
        filterAllCards();
        enforceShortsRule();
    });

    window.addEventListener("popstate", enforceShortsRule);

    // Additional click guard for cards whose contents just changed.
    function guardNavigation(event) {
        if (!ready) {
            const target = event.target instanceof Element
                ? event.target
                : null;

            if (target?.closest(cardSelector)) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }

            return;
        }

        if (!settings.educationMode) return;

        const target = event.target instanceof Element
            ? event.target
            : null;

        const link = target?.closest("a[href]");
        if (!link) return;

        const url = new URL(link.href, location.href);
        const blockedShort = strictActive() &&
            /^\/shorts(?:\/|$)/.test(url.pathname);

        const card = link.closest(cardSelector);

        if (card && topicFilteringActive()) {
            checkCard(card);
        }

        const blockedCard = card &&
            topicFilteringActive() &&
            !card.hasAttribute("data-reset-approved");

        if (blockedShort || blockedCard) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }

    document.addEventListener("click", guardNavigation, true);
    document.addEventListener("auxclick", guardNavigation, true);

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local" || !changes.settings) return;

        settingsVersion++;
        applySettings(changes.settings.newValue);
    });

    // Do not overwrite a newer settings change with an older read.
    const initialVersion = settingsVersion;

    chrome.storage.local.get("settings")
        .then(result => {
            if (settingsVersion === initialVersion) {
                applySettings(result.settings);
            }
        })
        .catch(error => {
            console.error("Reset could not load settings:", error);

            if (settingsVersion === initialVersion) {
                applySettings({ educationMode: false });
            }
        });
})();

function setupLearningSearch() {
    const button = document.getElementById("find-videos");
    const footer = document.querySelector("footer");

    if (!button) return;

    button.addEventListener("click", () => {
        const topicInputs = [
            ...document.querySelectorAll(".topic input")
        ];

        // Wait until the existing popup code finishes loading settings.
        if (topicInputs.some(input => input.disabled)) {
            footer.textContent = "Settings are loading. Try again shortly.";
            return;
        }

        const selectedTopics = topicInputs
            .filter(input => input.checked)
            .map(input =>
                input.closest(".topic")
                    .querySelector("span")
                    .textContent.trim()
            );

        if (selectedTopics.length === 0) {
            footer.textContent = "Select at least one learning bubble first.";
            return;
        }

        // Rotate through selected topics on this device.
        const storageKey = "reset-learning-search-index";
        const storedIndex = Number(localStorage.getItem(storageKey));

        const index = Number.isInteger(storedIndex) && storedIndex >= 0
            ? storedIndex
            : 0;

        const topic = selectedTopics[index % selectedTopics.length];

        const searches = {
            Science: "science explained",
            Technology: "technology explained tutorial",
            Art: "art tutorial",
            History: "history documentary explained"
        };

        const query = searches[topic] || `${topic} explained`;

        const url = new URL("https://www.youtube.com/results");
        url.searchParams.set("search_query", query);
        url.searchParams.set("reset_learning", topic);

        localStorage.setItem(storageKey, String(index + 1));

        // Open the search in the current popup's browser tab.
        // An ordinary link needs no additional extension permission.
        const link = document.createElement("a");
        link.href = url.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        document.body.appendChild(link);
        link.click();
        link.remove();

        footer.textContent = `Opened a ${topic} learning search.`;
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupLearningSearch);
} else {
    setupLearningSearch();
}