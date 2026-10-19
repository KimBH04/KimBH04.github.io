import { esc } from "../util.js";

/** games.json — [{ "Title", "Url", "Description"? }]. 파일만 고쳐도 목록이 바뀐다. */
let loading = null;

// 앱 시작 때 한 번 불러오고 이후에는 같은 결과를 쓴다 (app.js 가 미리 호출).
export function loadGames() {
    loading ??= fetchGames();
    return loading;
}

async function fetchGames() {
    try {
        const res = await fetch("/games.json", { cache: "no-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return (Array.isArray(data) ? data : []).filter(isValid);
    } catch (e) {
        console.error("games.json 을 읽지 못했습니다", e);
        return [];
    }
}

export async function render(root) {
    document.title = "Games · KimBH04";

    // 불러오는 동안에는 아무것도 표시하지 않는다.
    const games = await loadGames();

    root.innerHTML = games.length === 0
        ? `<section class="GamesPage"><p class="Message">등록된 게임이 없습니다.</p></section>`
        : `<section class="GamesPage">
               <ol class="List">${games.map(row).join("")}</ol>
           </section>`;
}

function isValid(game) {
    if (typeof game?.Title !== "string" || typeof game?.Url !== "string") return false;
    try {
        return ["http:", "https:"].includes(new URL(game.Url, location.href).protocol);
    } catch {
        return false;
    }
}

const row = game => `
    <li>
        <a class="Row" href="${esc(game.Url)}" target="_blank" rel="noopener">
            <span class="Title">${esc(game.Title)}</span>
            ${game.Description?.trim() ? `<span class="Description">${esc(game.Description)}</span>` : ""}
            <span class="Open" aria-hidden="true">↗</span>
        </a>
    </li>`;
