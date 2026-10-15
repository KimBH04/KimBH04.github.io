import { loadPosts } from "./posts.js";
import { formatClock } from "./util.js";
import * as home from "./pages/home.js";
import * as post from "./pages/post.js";
import * as games from "./pages/games.js";
import * as arts from "./pages/arts.js";
import * as write from "./pages/write.js";

// section 은 창의 탭(Posts / Games / Arts) 중 어느 것을 활성화할지 정한다.
const routes = [
    { pattern: /^\/$/, page: home, section: "posts" },
    { pattern: /^\/post\/([^/]+)\/?$/, page: post, section: "posts" },
    { pattern: /^\/game\/?$/, page: games, section: "game" },
    { pattern: /^\/art\/?$/, page: arts, section: "art" },
    { pattern: /^\/write\/?$/, page: write, section: "posts" },
];

const main = document.getElementById("main");

function match(pathname) {
    for (const route of routes) {
        const m = route.pattern.exec(pathname);
        if (!m) continue;
        try {
            return { ...route, params: m.slice(1).map(decodeURIComponent) };
        } catch {
            return null; // 잘못된 퍼센트 인코딩
        }
    }
    return null;
}

async function render({ focus }) {
    let route = match(location.pathname);
    if (!route) {
        // 알 수 없는 주소는 홈으로 보낸다.
        history.replaceState(null, "", "/");
        route = match("/");
    }

    updateChrome(route.section);

    // 페이지마다 새 컨테이너를 쓰므로, 느린 페이지가 늦게 끝나도 다른 페이지를 덮어쓰지 않는다.
    const container = document.createElement("div");
    main.replaceChildren(container);
    await route.page.render(container, ...route.params);

    // 이동 후 제목으로 포커스를 옮겨 스크린 리더가 새 페이지를 알 수 있게 한다.
    const h1 = container.isConnected && focus ? container.querySelector("h1") : null;
    if (h1) {
        h1.tabIndex = -1;
        h1.focus({ preventScroll: true });
    }
}

function updateChrome(section) {
    // 주소는 퍼센트 인코딩되어 있으므로 화면 표시용으로 디코딩한다 (예: %ED%85%8C... → 테스트)
    let path = location.pathname;
    try { path = decodeURIComponent(path); } catch { }
    document.getElementById("title-path").textContent = path;

    for (const tab of document.querySelectorAll(".SectionTab")) {
        const active = tab.dataset.section === section;
        tab.classList.toggle("active", active);
        if (active) tab.setAttribute("aria-current", "page");
        else tab.removeAttribute("aria-current");
    }
}

function navigate(url) {
    if (url === location.pathname + location.search + location.hash) return;
    history.pushState(null, "", url);
    window.scrollTo(0, 0);
    render({ focus: true });
}

// 사이트 안의 링크는 페이지를 새로 불러오지 않고 라우터로 처리한다.
document.addEventListener("click", e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const a = e.target.closest("a[href]");
    if (!a || a.target || a.hasAttribute("download")) return;

    const url = new URL(a.href);
    if (url.origin !== location.origin || !match(url.pathname)) return;
    if (url.pathname === location.pathname && url.hash) return; // 같은 페이지 안의 #앵커

    e.preventDefault();
    navigate(url.pathname + url.search + url.hash);
});

window.addEventListener("popstate", () => render({ focus: true }));

// Status bar
document.getElementById("year").textContent = new Date().getFullYear();

const clock = document.getElementById("clock");
const tick = () => { clock.textContent = formatClock(new Date()); };
tick();
setInterval(tick, 10_000);

const postCount = document.getElementById("post-count");
loadPosts()
    .then(posts => { postCount.textContent = `${posts.length} posts`; })
    .catch(() => { postCount.textContent = "0 posts"; })
    .finally(() => { postCount.hidden = false; });

render({ focus: false });
