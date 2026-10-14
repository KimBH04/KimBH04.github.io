(() => {
    // [앞, 뒤, 선택이 없을 때 넣을 텍스트]
    const wraps = {
        bold: ["**", "**", "굵은 글씨"],
        italic: ["*", "*", "기울임"],
        strike: ["~~", "~~", "취소선"],
        code: ["`", "`", "code"],
        link: ["[", "](https://)", "링크 텍스트"],
        image: ["![", "](https://)", "대체 텍스트"],
    };

    // 줄 단위로 앞에 붙는 문법. 이미 붙어 있으면 제거(토글)한다.
    const prefixes = {
        h1: "# ",
        h2: "## ",
        h3: "### ",
        quote: "> ",
        ul: "- ",
        ol: "1. ",
        task: "- [ ] ",
    };

    const shortcuts = { b: "bold", i: "italic", e: "code", k: "link" };

    // 선택 영역 [start, end) 를 text 로 바꾸고, 삽입된 text 안의 [selStart, selEnd) 를 선택한다.
    // execCommand 를 쓰면 Ctrl+Z 되돌리기가 유지되고 input 이벤트도 발생한다.
    function replace(el, start, end, text, selStart, selEnd) {
        el.focus();
        el.setSelectionRange(start, end);
        if (!document.execCommand("insertText", false, text)) {
            el.setRangeText(text, start, end, "end");
            el.dispatchEvent(new Event("input", { bubbles: true }));
        }
        el.setSelectionRange(start + selStart, start + selEnd);
    }

    function wrap(el, [before, after, placeholder], kind) {
        const { value, selectionStart: start, selectionEnd: end } = el;
        const selected = value.slice(start, end);
        const inner = selected || placeholder;
        const text = before + inner + after;

        // 텍스트를 선택한 채 링크/이미지를 만들면 바로 주소를 입력할 수 있게 URL 부분을 선택
        if (selected && (kind === "link" || kind === "image")) {
            const urlStart = before.length + inner.length + 2;
            replace(el, start, end, text, urlStart, text.length - 1);
        } else {
            replace(el, start, end, text, before.length, before.length + inner.length);
        }
    }

    function prefixLines(el, kind) {
        const { value, selectionStart, selectionEnd } = el;
        const start = value.lastIndexOf("\n", selectionStart - 1) + 1;
        let end = value.indexOf("\n", selectionEnd > selectionStart && value[selectionEnd - 1] === "\n" ? selectionEnd - 1 : selectionEnd);
        if (end === -1) end = value.length;

        const lines = value.slice(start, end).split("\n");
        const pattern = {
            h1: /^# /, h2: /^## /, h3: /^### /, quote: /^> /,
            ul: /^- (?!\[[ x]\] )/, ol: /^\d+\. /, task: /^- \[[ x]\] /,
        }[kind];
        const remove = lines.every(line => pattern.test(line));

        const result = lines.map((line, i) => {
            if (remove) return line.replace(pattern, "");
            if (kind.startsWith("h")) line = line.replace(/^#{1,6} /, "");
            return (kind === "ol" ? `${i + 1}. ` : prefixes[kind]) + line;
        }).join("\n");

        // 빈 줄 하나에 적용했다면 커서를 접두어 뒤에 둔다
        const caretOnly = lines.length === 1 && lines[0] === "";
        replace(el, start, end, result, caretOnly ? result.length : 0, result.length);
    }

    // 블록 문법은 앞뒤에 빈 줄이 오도록 줄바꿈을 보충한다.
    function block(el, kind) {
        const { value, selectionStart: start, selectionEnd: end } = el;
        const selected = value.slice(start, end);

        const head = value.slice(0, start);
        const tail = value.slice(end);
        const before = head === "" || head.endsWith("\n\n") ? "" : head.endsWith("\n") ? "\n" : "\n\n";
        const after = tail === "" || tail.startsWith("\n\n") ? "" : tail.startsWith("\n") ? "\n" : "\n\n";

        let body, selStart, selEnd;
        if (kind === "codeblock") {
            const code = selected || "code";
            body = "```\n" + code + "\n```";
            selStart = 4;
            selEnd = 4 + code.length;
        } else if (kind === "table") {
            body = "| 제목 | 제목 |\n| --- | --- |\n| 내용 | 내용 |";
            selStart = 2;
            selEnd = 4;
        } else {
            body = "---";
            selStart = selEnd = body.length;
        }

        const text = before + body + after;
        const offset = before.length;
        replace(el, start, end, text,
            kind === "hr" ? text.length : offset + selStart,
            kind === "hr" ? text.length : offset + selEnd);
    }

    function format(el, kind) {
        if (wraps[kind]) wrap(el, wraps[kind], kind);
        else if (prefixes[kind]) prefixLines(el, kind);
        else block(el, kind);
    }

    window.blogEditor = {
        format,

        attach(el) {
            el.addEventListener("keydown", e => {
                if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
                const kind = shortcuts[e.key.toLowerCase()];
                if (!kind) return;
                e.preventDefault();
                format(el, kind);
            });
        },

        download(fileName, text) {
            const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        },

        load(key) {
            try { return localStorage.getItem(key); } catch { return null; }
        },

        save(key, value) {
            try { localStorage.setItem(key, value); } catch { }
        },

        remove(key) {
            try { localStorage.removeItem(key); } catch { }
        }
    };
})();
