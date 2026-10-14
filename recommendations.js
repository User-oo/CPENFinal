(() => {
    const CACHE_KEY = "learningRecommendations";
    const MAX_VIDEOS = 8;

    let settings = { educationMode: false, topics: [] };
    let cache = {};
    let loaded = false;
    let timer;
    let lastSignature = "";
    let saving = false;

    const panel = document.createElement("section");
    panel.id = "reset-learning-recommendations";

    // Isolate the recommendation design from YouTube's styles.
    const shadow = panel.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
        :host {
            display: block;
            margin: 20px 24px;
        }

        .box {
            padding: 22px;
            border-radius: 26px;
            background: #ededed;
            color: #292929;
            font-family: Arial, sans-serif;
        }

        .box.dark {
            background: #303030;
            color: #eeeeee;
        }

        h2 {
            margin: 0 0 8px;
            font-size: 22px;
        }

        p {
            margin: 0 0 18px;
            font-size: 13px;
            line-height: 1.5;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
            gap: 16px;
        }

        a {
            display: block;
            padding: 14px;
            border-radius: 18px;
            background: #ffffff;
            color: inherit;
            text-decoration: none;
        }

        .dark a {
            background: #414141;
        }

        a:hover {
            text-decoration: underline;
        }

        a:focus-visible {
            outline: 3px solid currentColor;
            outline-offset: 3px;
        }

        strong {
            display: block;
            font-size: 15px;
            line-height: 1.4;
        }

        small {
            display: block;
            margin-top: 10px;
            font-size: 12px;
        }
    `;

    const box = document.createElement("div");
    box.className = "box";

    shadow.append(style, box);

    function normalize(text) {
        return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    }

    function hasLearningWords(title) {
        const text = ` ${normalize(title)} `;

        return [
            "tutorial", "explained", "lesson", "lecture",
            "learn", "how to", "documentary", "beginner", "beginners"
        ].some(word => text.includes(` ${word} `));
    }

    function renderHome() {
        const enabled = settings.educationMode === true;
        const onHome = location.pathname === "/";

        if (!enabled || !onHome) {
            panel.remove();
            return;
        }

        const home = document.querySelector(
            'ytd-browse[page-subtype="home"]'
        );

        if (!home) return;

        box.classList.toggle("dark", Boolean(settings.darkTheme));
        box.replaceChildren();

        const heading = document.createElement("h2");
        heading.textContent = "Explore your topics";

        const note = document.createElement("p");
        note.textContent =
            "Suggestions collected from your learning searches.";

        const grid = document.createElement("div");
        grid.className = "grid";

        const seen = new Set();

        for (const topic of settings.topics || []) {
            const videos = cache[topic] || [];

            for (const video of videos) {
                if (seen.has(video.id)) continue;

                // Apply the extra educational wording rule in Strict.
                if (
                    settings.filterStrength === "Strict" &&
                    !hasLearningWords(video.title)
                ) {
                    continue;
                }

                // Only accept standard YouTube video IDs.
                if (!/^[A-Za-z0-9_-]{11}$/.test(video.id)) continue;

                seen.add(video.id);

                const link = document.createElement("a");
                link.href =
                    `https://www.youtube.com/watch?v=${video.id}`;

                const title = document.createElement("strong");
                title.textContent = video.title;

                const label = document.createElement("small");
                label.textContent = `${topic} · YouTube`;

                link.append(title, label);
                grid.appendChild(link);
            }
        }

        if (seen.size === 0) {
            note.textContent =
                "Use “Find learning videos” in the extension with " +
                "Education mode on, then return to Home. " +
                "Matching search results will appear here.";
        }

        box.append(heading, note, grid);

        if (panel.parentElement !== home) {
            home.prepend(panel);
        }
    }

    async function collectSearchResults() {
        if (saving || settings.educationMode !== true) return;
        if (location.pathname !== "/results") return;

        const params = new URLSearchParams(location.search);
        const topic = params.get("reset_learning");

        if (!["Science", "Technology", "Art", "History"].includes(topic)) {
            return;
        }

        // Collect only when this is the sole selected topic.
        // This prevents results for one topic being saved as another.
        if (
            settings.topics?.length !== 1 ||
            settings.topics[0] !== topic
        ) {
            return;
        }

        const videos = [];
        const seen = new Set();

        const cards = document.querySelectorAll(
            'ytd-search ytd-video-renderer[data-reset-approved], ' +
            'ytd-search yt-lockup-view-model[data-reset-approved]'
        );

        for (const card of cards) {
            if (card.querySelector('a[href*="/shorts/"]')) continue;

            const titleElement = card.querySelector(
                '#video-title, ' +
                'a.yt-lockup-metadata-view-model__title, ' +
                'a.ytLockupMetadataViewModelTitle, h3 a'
            );

            const link = card.querySelector('a[href*="/watch?"]');
            const title = titleElement?.textContent.trim();

            if (!link || !title) continue;

            const id = new URL(link.href, location.href)
                .searchParams.get("v");

            if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id) || seen.has(id)) {
                continue;
            }

            // Cache a conservative set that also fits Strict mode.
            if (!hasLearningWords(title)) continue;

            seen.add(id);
            videos.push({ id, title });

            if (videos.length >= MAX_VIDEOS) break;
        }

        if (videos.length === 0) return;

        const signature = JSON.stringify({ topic, videos });
        if (signature === lastSignature) return;

        saving = true;

        try {
            const result = await chrome.storage.local.get(CACHE_KEY);
            const updatedCache = {
                ...(result[CACHE_KEY] || {}),
                [topic]: videos
            };

            await chrome.storage.local.set({
                [CACHE_KEY]: updatedCache
            });

            cache = updatedCache;
            lastSignature = signature;
        } catch (error) {
            console.error("Reset recommendation save failed:", error);
        } finally {
            saving = false;
        }
    }

    function update() {
        if (!loaded) return;

        if (location.pathname === "/") {
            // Avoid rebuilding our own panel on every YouTube mutation.
            if (!panel.isConnected) renderHome();
        } else {
            panel.remove();
            collectSearchResults();
        }
    }

    function scheduleUpdate() {
        clearTimeout(timer);
        timer = setTimeout(update, 250);
    }

    const observer = new MutationObserver(records => {
        // Ignore insertion/removal of our own panel.
        const relevant = records.some(record =>
            record.type === "attributes" ||
            [...record.addedNodes, ...record.removedNodes]
                .some(node => node !== panel)
        );

        if (relevant) scheduleUpdate();
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-reset-approved"]
    });

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;

        if (changes.settings) {
            settings = changes.settings.newValue || {
                educationMode: false,
                topics: []
            };
        }

        if (changes[CACHE_KEY]) {
            cache = changes[CACHE_KEY].newValue || {};
        }

        if (changes.settings || changes[CACHE_KEY]) {
            renderHome();
            scheduleUpdate();
        }
    });

    document.addEventListener("yt-navigate-finish", () => {
        renderHome();
        scheduleUpdate();
    });

    async function initialize() {
        try {
            const result = await chrome.storage.local.get([
                "settings",
                CACHE_KEY
            ]);

            settings = result.settings || settings;
            cache = result[CACHE_KEY] || {};
            loaded = true;

            renderHome();
            scheduleUpdate();
        } catch (error) {
            console.error("Reset recommendations failed to load:", error);
        }
    }

    initialize();
})();