import { loadPosts } from "../posts.js";
import { esc, formatDate, postHref } from "../util.js";
import { loadGames } from "./games.js";
import { artHref, loadArts } from "./arts.js";

// 각 칸에 보여 줄 최대 개수. 나머지는 "전체 보기" 로 본다.
const LIMIT = 5;

export async function render(root) {
    document.title = "KimBH04";

    const [posts, games, arts] = await Promise.all([loadPosts().catch(() => []), loadGames(), loadArts()]);

    root.innerHTML = `
        <section class="MainPage">
            <h1 class="VisuallyHidden">KimBH04</h1>

            <!-- 메인 장식 영역 (비워 둠) -->
            <div class="Hero" aria-hidden="true"></div>

            <div class="Columns">
                ${column("Posts", "/post", posts, post => `
                    <a class="Item" href="${esc(postHref(post.slug))}">
                        <span class="ItemTitle">${esc(post.title)}</span>
                        ${post.time ? `<time class="ItemMeta" datetime="${formatDate(post.time)}">${formatDate(post.time, ".")}</time>` : ""}
                    </a>`)}
                ${column("Games", "/game", games, game => `
                    <a class="Item" href="${esc(game.Url)}" target="_blank" rel="noopener">
                        <span class="ItemTitle">${esc(game.Title)}</span>
                        <span class="ItemMeta" aria-hidden="true">↗</span>
                    </a>`)}
                ${column("Arts", "/art", arts, art => `
                    <a class="Item" href="${esc(artHref(art))}">
                        <span class="ItemTitle">${esc(art.Title)}</span>
                    </a>`)}
            </div>
        </section>`;
}

const column = (title, href, items, item) => `
    <section class="Column">
        <header class="ColumnHead">
            <h2><a href="${href}">${title}</a></h2>
            <span class="ColumnCount">[${String(items.length).padStart(2, "0")}]</span>
        </header>
        ${items.length === 0
            ? `<p class="Empty">아직 없습니다.</p>`
            : `<ol class="List">${items.slice(0, LIMIT).map(x => `<li>${item(x)}</li>`).join("")}</ol>`}
        ${items.length > LIMIT ? `<a class="More" href="${href}">전체 보기 →</a>` : ""}
    </section>`;
