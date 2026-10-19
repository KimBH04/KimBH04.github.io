import { getPost } from "../posts.js";

/** 404 페이지: Posts/_404.md 의 본문을 보여 준다. 파일이 없으면 빈 화면. */
export async function render(root) {
    document.title = "Not found · KimBH04";

    const post = await getPost("_404");
    if (!post) {
        root.replaceChildren();
        return;
    }

    root.innerHTML = `
        <div class="PostPage">
            <article class="Post">
                <div class="markdown">${post.html}</div>
            </article>
        </div>`;
}
