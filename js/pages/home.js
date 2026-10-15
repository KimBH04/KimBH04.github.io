import { loadPosts } from "../posts.js";
import { esc, formatDate, postHref } from "../util.js";

export async function render(root) {
    document.title = "KimBH04";

    let posts;
    try {
        posts = await loadPosts();
    } catch (e) {
        console.error(e);
        root.innerHTML = `<section class="HomePage"><p class="Empty">글 목록을 불러오지 못했습니다.</p></section>`;
        return;
    }

    const numbers = new Map(posts.map((post, i) => [post.slug, posts.length - i]));

    const counts = new Map();
    for (const tag of posts.flatMap(post => post.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    const categories = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

    root.innerHTML = `
        <section class="HomePage">
            <header class="Heading">
                <h1>Posts</h1>
                <span class="Count"></span>
            </header>

            <div class="Toolbar">
                <div class="Tabs" role="group" aria-label="카테고리">
                    <button type="button" class="Tab" data-all aria-pressed="true">ALL<span>${posts.length}</span></button>
                    ${categories.map(([name, count]) => `
                        <button type="button" class="Tab" data-category="${esc(name)}" aria-pressed="false">${esc(name)}<span>${count}</span></button>`).join("")}
                </div>

                <label class="Search">
                    <span class="Prompt" aria-hidden="true">&gt;</span>
                    <input type="search" placeholder="제목 검색" aria-label="제목 검색" />
                </label>
            </div>

            <div class="Results"></div>
        </section>`;

    const tabs = root.querySelector(".Tabs");
    const search = root.querySelector(".Search input");
    const count = root.querySelector(".Count");
    const results = root.querySelector(".Results");

    let category = null;

    function update() {
        const q = search.value.trim().toLowerCase();
        const visible = posts.filter(post =>
            (category === null || post.tags.includes(category)) &&
            (q === "" || post.title.toLowerCase().includes(q)));

        count.textContent = `[${String(visible.length).padStart(2, "0")}]`;

        for (const tab of tabs.querySelectorAll(".Tab")) {
            const pressed = "all" in tab.dataset ? category === null : tab.dataset.category === category;
            tab.setAttribute("aria-pressed", String(pressed));
        }

        results.innerHTML = visible.length === 0
            ? `<p class="Empty">조건에 맞는 글이 없습니다.</p>`
            : `<div class="List">
                   <div class="ListHead" aria-hidden="true">
                       <span class="No">No.</span><span class="Title">Title</span><span class="Tags">Tags</span><span class="Date">Date</span>
                   </div>
                   <ol>${visible.map(post => row(post, numbers.get(post.slug))).join("")}</ol>
               </div>`;
    }

    tabs.addEventListener("click", e => {
        const tab = e.target.closest(".Tab");
        if (!tab) return;
        category = "all" in tab.dataset ? null : tab.dataset.category;
        update();
    });
    search.addEventListener("input", update);

    update();
}

function row(post, number) {
    const date = post.time
        ? `<time class="Date" datetime="${formatDate(post.time)}">${formatDate(post.time, ".")}</time>`
        : `<span class="Date">—</span>`;

    return `
        <li>
            <a class="Row" href="${esc(postHref(post.slug))}">
                <span class="No">${String(number).padStart(2, "0")}</span>
                <span class="Title">${esc(post.title)}</span>
                <span class="Tags">${post.tags.map(tag => `<span class="tag">${esc(tag)}</span>`).join("")}</span>
                ${date}
            </a>
        </li>`;
}
