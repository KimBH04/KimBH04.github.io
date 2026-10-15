import { attachShortcuts, download, format } from "../editor.js";
import { isHidden, toHtml } from "../posts.js";
import { esc, formatDate, formatClock, storage } from "../util.js";

const DRAFT_KEY = "blog-write-draft";

const toolGroups = [
    [["h1", "H1", "제목 1"], ["h2", "H2", "제목 2"], ["h3", "H3", "제목 3"]],
    [["bold", "B", "굵게 (Ctrl+B)", "Bold"], ["italic", "I", "기울임 (Ctrl+I)", "Italic"], ["strike", "S", "취소선", "Strike"]],
    [["quote", ">", "인용"], ["ul", "-", "글머리 목록"], ["ol", "1.", "번호 목록"], ["task", "[ ]", "체크리스트"]],
    [["code", "`c`", "인라인 코드 (Ctrl+E)"], ["codeblock", "```", "코드 블록"]],
    [["link", "Link", "링크 (Ctrl+K)"], ["image", "Img", "이미지"], ["table", "Table", "표"], ["hr", "---", "구분선"]],
];

export function render(root) {
    document.title = "Write · KimBH04";

    root.innerHTML = `
        <section class="WritePage">
            <header class="Heading">
                <h1>Write</h1>
                <span class="FileName"></span>
            </header>

            <div class="Fields">
                <label class="Field">
                    <span class="Label">TITLE</span>
                    <input class="Input" name="title" placeholder="제목" />
                </label>
                <label class="Field">
                    <span class="Label">TAGS</span>
                    <input class="Input" name="tags" placeholder="C#, blazor (쉼표로 구분)" />
                </label>
            </div>

            <div class="Editor">
                <section class="Pane">
                    <div class="PaneBar"><span>EDIT</span><span class="PaneInfo"></span></div>
                    <div class="Toolbar" role="toolbar" aria-label="마크다운 서식">
                        ${toolGroups.map(group => `
                            <div class="ToolGroup">
                                ${group.map(([kind, label, title, cls = ""]) => `
                                    <button type="button" class="Tool ${cls}" data-kind="${kind}" title="${esc(title)}" aria-label="${esc(title)}">${esc(label)}</button>`).join("")}
                            </div>`).join("")}
                    </div>
                    <textarea class="Source" spellcheck="false" placeholder="마크다운으로 작성하세요." aria-label="본문"></textarea>
                </section>
                <section class="Pane">
                    <div class="PaneBar"><span>PREVIEW</span></div>
                    <div class="Preview markdown"></div>
                </section>
            </div>

            <div class="Actions">
                <span class="Status" role="status"></span>
                <button type="button" class="btn" data-action="reset">초기화</button>
                <button type="button" class="btn btn-primary" data-action="save">.md 저장</button>
            </div>

            <section class="FrontMatter">
                <div class="PaneBar"><span>파일 머리말 (저장 시 본문 앞에 추가됨)</span></div>
                <pre class="FrontMatterCode"></pre>
            </section>
        </section>`;

    const $ = selector => root.querySelector(selector);
    const title = $("[name=title]");
    const tags = $("[name=tags]");
    const source = $(".Source");
    const status = $(".Status");
    const save = $("[data-action=save]");

    let time = new Date();

    // 파일 이름에 쓸 수 없는 문자를 제거한 제목. 비어 있으면 null.
    const fileName = () => {
        const slug = title.value.replace(/[\\/:*?"<>|\p{Cc}]/gu, "").trim().replace(/\.+$/, "");
        return slug ? `${slug}.md` : null;
    };

    const tagList = () => tags.value.split(",").map(t => t.trim()).filter(Boolean);

    // posts.js 의 parsePost 가 읽는 형식
    const frontMatter = () =>
        `---\ntitle: ${title.value.trim()}\ndate: ${formatDate(time)} ${formatClock(time)}\ntags: [${tagList().join(", ")}]\n---`;

    function update() {
        const name = fileName();
        $(".FileName").textContent = name ?? "제목.md";
        save.disabled = name === null;
        $(".PaneInfo").textContent = `${source.value.length} chars`;
        $(".Preview").innerHTML = toHtml(source.value);
        $(".FrontMatterCode").textContent = frontMatter();
    }

    function saveDraft() {
        status.textContent = "";
        storage.set(DRAFT_KEY, JSON.stringify({ Title: title.value, Tags: tags.value, Body: source.value }));
    }

    for (const input of [title, tags, source]) {
        input.addEventListener("input", () => {
            update();
            saveDraft();
        });
    }

    // 버튼을 눌러도 textarea 의 선택 영역과 포커스가 유지되도록 mousedown 기본 동작을 막는다.
    const toolbar = $(".Toolbar");
    toolbar.addEventListener("mousedown", e => {
        if (e.target.closest(".Tool")) e.preventDefault();
    });
    // 서식 적용 후 textarea 의 input 이벤트로 미리보기와 임시 저장이 갱신된다.
    toolbar.addEventListener("click", e => {
        const tool = e.target.closest(".Tool");
        if (tool) format(source, tool.dataset.kind);
    });
    attachShortcuts(source);

    save.addEventListener("click", () => {
        const name = fileName();
        if (!name) return;

        time = new Date();
        update();
        download(name, `${frontMatter()}\n\n${source.value}`);
        status.textContent = isHidden(name)
            ? `${name} 저장됨 → '_' 로 시작해서 목록에 표시되지 않는 숨김 글이 됩니다.`
            : `${name} 저장됨 → Posts/ 에 넣으면 게시됩니다.`;
    });

    $("[data-action=reset]").addEventListener("click", () => {
        if (!confirm("작성 중인 글을 모두 지울까요?")) return;

        title.value = tags.value = source.value = "";
        time = new Date();
        storage.remove(DRAFT_KEY);
        update();
        status.textContent = "";
    });

    const draft = readDraft();
    if (draft) {
        title.value = draft.Title ?? "";
        tags.value = draft.Tags ?? "";
        source.value = draft.Body ?? "";
        status.textContent = "임시 저장된 글을 불러왔습니다.";
    }

    update();
}

function readDraft() {
    const json = storage.get(DRAFT_KEY);
    if (!json) return null;
    try {
        return JSON.parse(json);
    } catch {
        storage.remove(DRAFT_KEY);
        return null;
    }
}
