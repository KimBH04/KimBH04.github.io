import { esc } from "../util.js";

/**
 * arts.json — [{ "Title", "Model" | "Page", "Description"? }].
 * Model 은 Arts/ 안의 .fbx 경로 (예: "robot/robot.fbx") → three.js 뷰어로 보여 준다.
 * Page 는 Arts/ 안의 독립 .html 경로 (예: "snow-globe.html") → iframe 으로 띄운다.
 */
let loading = null;

// 앱 시작 때 한 번 불러오고 이후에는 같은 결과를 쓴다 (app.js 가 미리 호출).
export function loadArts() {
    loading ??= fetchArts();
    return loading;
}

async function fetchArts() {
    try {
        const res = await fetch("/arts.json", { cache: "no-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return (Array.isArray(data) ? data : []).filter(isValid);
    } catch (e) {
        console.error("arts.json 을 읽지 못했습니다", e);
        return [];
    }
}

const safePath = path => typeof path === "string" && !path.split("/").includes("..");

const isValid = art =>
    typeof art?.Title === "string" &&
    (safePath(art.Model) && /\.fbx$/i.test(art.Model) || safePath(art.Page) && /\.html?$/i.test(art.Page));

const artKey = art => art.Model ?? art.Page;
export const artHref = art => `/art/${encodeURIComponent(artKey(art))}`;
const fileUrl = path => `/Arts/${path.split("/").map(encodeURIComponent).join("/")}`;

export async function render(root, model) {
    const arts = await loadArts();
    if (model === undefined) renderList(root, arts);
    else {
        const art = arts.find(art => artKey(art) === model);
        if (art?.Page) renderPage(root, art);
        else await renderViewer(root, art, model);
    }
}

function renderList(root, arts) {
    document.title = "Arts · KimBH04";
    root.innerHTML = arts.length === 0
        ? `<section class="ArtsPage"><p class="Message">등록된 작품이 없습니다.</p></section>`
        : `<section class="ArtsPage">
               <ol class="List">${arts.map(row).join("")}</ol>
           </section>`;
}

const row = art => `
    <li>
        <a class="Row" href="${esc(artHref(art))}">
            <span class="Title">${esc(art.Title)}</span>
            ${art.Description?.trim() ? `<span class="Description">${esc(art.Description)}</span>` : ""}
            <span class="Open" aria-hidden="true">→</span>
        </a>
    </li>`;

// 자체 스크립트와 UI 를 가진 독립 페이지는 블로그 스타일과 섞이지 않도록 iframe 에 띄운다.
function renderPage(root, art) {
    document.title = `${art.Title} · KimBH04`;
    root.innerHTML = `
        <section class="ArtsPage">
            <a class="Back" href="/art">← arts</a>
            <h1>${esc(art.Title)}</h1>
            ${art.Description?.trim() ? `<p class="Description">${esc(art.Description)}</p>` : ""}
            <iframe class="Embed" src="${esc(fileUrl(art.Page))}" title="${esc(art.Title)}" allow="fullscreen"></iframe>
            <p class="Hint"><a href="${esc(fileUrl(art.Page))}" target="_blank" rel="noopener">새 탭에서 크게 보기 ↗</a></p>
        </section>`;
}

async function renderViewer(root, art, model) {
    if (!art) {
        document.title = "Not found · KimBH04";
        root.innerHTML = `
            <section class="ArtsPage">
                <a class="Back" href="/art">← arts</a>
                <h1>작품을 찾을 수 없습니다</h1>
                <p class="Message">"${esc(model)}" 에 해당하는 작품이 없습니다.</p>
            </section>`;
        return;
    }

    document.title = `${art.Title} · KimBH04`;
    root.innerHTML = `
        <section class="ArtsPage">
            <a class="Back" href="/art">← arts</a>
            <h1>${esc(art.Title)}</h1>
            ${art.Description?.trim() ? `<p class="Description">${esc(art.Description)}</p>` : ""}
            <div class="Viewer">
                <div class="Canvas"></div>
                <p class="Status" role="status">불러오는 중…</p>
            </div>
            <div class="Controls" hidden>
                <button class="btn" type="button" data-action="reset">시점 초기화</button>
            </div>
            <div class="Animation" hidden>
                <button class="btn btn-primary" type="button" data-action="play">정지</button>
                <input class="Seek" type="range" min="0" step="1" value="0" aria-label="프레임" />
                <output class="Frame"></output>
                <label class="Clip" hidden>클립 <select></select></label>
            </div>
            <p class="Hint">드래그: 회전 · 휠/핀치: 확대 · 오른쪽 드래그/두 손가락: 이동</p>
        </section>`;

    const section = root.firstElementChild;
    const status = section.querySelector(".Status");
    const setStatus = text => { status.textContent = text; status.hidden = !text; };

    let viewer;
    try {
        const { mountViewer } = await import("../viewer.js");
        viewer = await mountViewer(section.querySelector(".Canvas"), fileUrl(art.Model), p => {
            setStatus(`불러오는 중… ${Math.round(p * 100)}%`);
        });
    } catch (e) {
        console.error("모델을 불러오지 못했습니다", e);
        setStatus("모델을 불러오지 못했습니다.");
        return;
    }
    setStatus("");

    const controls = section.querySelector(".Controls");
    controls.hidden = false;
    controls.querySelector("[data-action=reset]").addEventListener("click", () => viewer.resetView());

    // 애니메이션이 없는 모델은 패널을 숨긴 채로 둔다.
    if (viewer.animation) setupAnimation(section.querySelector(".Animation"), viewer.animation);
}

function setupAnimation(panel, animation) {
    const button = panel.querySelector("[data-action=play]");
    const seek = panel.querySelector(".Seek");
    const frame = panel.querySelector(".Frame");

    const sync = () => {
        seek.max = animation.frames;
        seek.value = animation.frame;
        frame.textContent = `${animation.frame} / ${animation.frames}`;
        button.textContent = animation.playing ? "정지" : "실행";
        button.setAttribute("aria-pressed", String(animation.playing));
    };
    animation.onUpdate = sync;

    button.addEventListener("click", () => {
        if (animation.playing) animation.pause();
        else animation.play();
        sync();
    });

    // 슬라이더를 움직이면 멈추고 그 프레임을 보여 준다.
    seek.addEventListener("input", () => {
        animation.pause();
        animation.seek(Number(seek.value));
        sync();
    });

    if (animation.clips.length > 1) {
        const label = panel.querySelector(".Clip");
        const select = label.querySelector("select");
        select.innerHTML = animation.clips.map((name, i) => `<option value="${i}">${esc(name)}</option>`).join("");
        select.addEventListener("change", () => {
            animation.select(Number(select.value));
            sync();
        });
        label.hidden = false;
    }

    sync();
    panel.hidden = false;
}
