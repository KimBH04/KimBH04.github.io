import { getPost, loadPosts } from "../posts.js";
import * as notFound from "./notfound.js";
import { esc, formatDate, formatDateTime, postHref } from "../util.js";

export async function render(root, slug) {
    const [posts, post] = await Promise.all([loadPosts().catch(() => []), getPost(slug)]);

    // 없는 글도 404 페이지를 보여 준다.
    if (!post) {
        await notFound.render(root);
        return;
    }

    document.title = `${post.title} · KimBH04`;

    // 숨김 글은 목록에 없으므로 이전/다음 글도 없다.
    const i = posts.indexOf(post);
    const newer = i > 0 ? posts[i - 1] : null;
    const older = i >= 0 && i + 1 < posts.length ? posts[i + 1] : null;

    const meta = [
        post.time && `
            <div>
                <dt>DATE</dt>
                <dd><time datetime="${formatDate(post.time)}">${formatDateTime(post.time)}</time></dd>
            </div>`,
        post.tags.length > 0 && `
            <div>
                <dt>TAGS</dt>
                <dd>${post.tags.map(tag => `<span class="tag">${esc(tag)}</span>`).join("")}</dd>
            </div>`,
    ].filter(Boolean).join("");

    const pager = older || newer ? `
        <nav class="Pager" aria-label="이전/다음 글">
            ${older ? pagerLink(older, "PagerLink", "← 이전 글") : ""}
            ${newer ? pagerLink(newer, "PagerLink Next", "다음 글 →") : ""}
        </nav>` : "";

    // 본문 HTML 은 직접 작성한 마크다운을 렌더링한 것이라 그대로 넣는다.
    root.innerHTML = `
        <div class="PostPage">
            <article class="Post">
                <a class="Back" href="/post">← posts</a>

                <header class="Header">
                    <h1>${esc(post.title)}</h1>
                    <dl class="Meta">${meta}</dl>
                </header>

                <div class="markdown">${post.html}</div>
                ${pager}
            </article>
        </div>`;
}

const pagerLink = (post, className, label) => `
    <a class="${className}" href="${esc(postHref(post.slug))}">
        <span class="PagerLabel">${label}</span>
        <span class="PagerTitle">${esc(post.title)}</span>
    </a>`;
