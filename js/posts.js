import { Marked } from "https://cdn.jsdelivr.net/npm/marked@18.0.14/lib/marked.esm.js";

const markdown = new Marked({ gfm: true });

export const toHtml = text => markdown.parse(text);

// 파일 이름이 '_' 로 시작하는 글은 목록에서 숨기고, URL 로 직접 접근할 때만 보인다.
export const isHidden = slug => slug.startsWith("_");

let listing = null;
const loaded = new Map();

/**
 * 공개 글 목록(최신순). posts.json 은 Posts/*.md 의 파일 이름 목록으로,
 * 배포 시 GitHub Actions 가, 로컬에서는 serve.py 가 만들어 준다.
 */
export function loadPosts() {
    listing ??= (async () => {
        const res = await fetch("/posts.json", { cache: "no-cache" });
        if (!res.ok) throw new Error(`posts.json: HTTP ${res.status}`);

        const slugs = await res.json();
        const posts = await Promise.all(slugs.filter(slug => !isHidden(slug)).map(fetchPost));
        return posts.filter(Boolean).sort(byNewest);
    })();
    return listing;
}

/** 목록에 없는 글(숨김 글 등)도 파일이 있으면 불러온다. 없으면 null. */
export async function getPost(slug) {
    const posts = await loadPosts().catch(() => []);
    return posts.find(post => post.slug === slug) ?? await fetchPost(slug);
}

async function fetchPost(slug) {
    if (!loaded.has(slug)) {
        loaded.set(slug, (async () => {
            const res = await fetch(`/Posts/${encodeURIComponent(slug)}.md`, { cache: "no-cache" });
            if (!res.ok) return null;
            return parsePost(slug, await res.text());
        })().catch(e => {
            console.error(`${slug}.md 를 읽지 못했습니다`, e);
            return null;
        }));
    }
    return loaded.get(slug);
}

// 날짜가 없는 글은 맨 뒤로 보낸다.
const byNewest = (a, b) => (b.time?.getTime() ?? -Infinity) - (a.time?.getTime() ?? -Infinity);

/**
 * 맨 앞의 front matter 를 읽는다. 모든 항목은 생략 가능하며, title 이 없으면 파일 이름을 쓴다.
 *
 *   ---
 *   title: 글 제목
 *   date: 2026-10-14 14:31
 *   tags: [C#, blazor]
 *   ---
 */
export function parsePost(slug, text) {
    text = text.replace(/\r\n/g, "\n");

    let title = slug;
    let time = null;
    let tags = [];

    if (text.startsWith("---\n")) {
        const end = text.indexOf("\n---", 3);
        if (end >= 0) {
            for (const line of text.slice(4, end).split("\n")) {
                const colon = line.indexOf(":");
                if (colon < 0) continue;

                const key = line.slice(0, colon).trim().toLowerCase();
                const value = line.slice(colon + 1).trim();

                if (key === "title" && value) title = value;
                else if (key === "date") time = parseDate(value);
                else if (key === "tags") tags = value.replace(/^\[+|\]+$/g, "").split(",").map(t => t.trim()).filter(Boolean);
            }

            const bodyStart = text.indexOf("\n", end + 1);
            text = bodyStart < 0 ? "" : text.slice(bodyStart + 1);
        }
    }

    return { slug, title, time, tags, html: toHtml(text) };
}

// "2026-10-14", "2026-10-14 14:31", "2026-10-14T14:31:00" 을 로컬 시각으로 읽는다.
function parseDate(value) {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);
    if (m) {
        const [, y, mo, d, h = 0, mi = 0, s = 0] = m;
        return new Date(+y, mo - 1, +d, +h, +mi, +s);
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}
