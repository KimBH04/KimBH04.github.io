const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

// innerHTML 템플릿에 넣는 모든 값은 esc() 를 거친다.
export const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ESCAPES[c]);

export const postHref = slug => `/post/${encodeURIComponent(slug)}`;

const pad2 = n => String(n).padStart(2, "0");

export const formatDate = (date, sep = "-") =>
    `${date.getFullYear()}${sep}${pad2(date.getMonth() + 1)}${sep}${pad2(date.getDate())}`;

export const formatClock = date => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

// 시각이 00:00 이면 날짜만 표시한다.
export const formatDateTime = date =>
    date.getHours() === 0 && date.getMinutes() === 0 ? formatDate(date) : `${formatDate(date)} ${formatClock(date)}`;

// 브라우저 저장소는 사생활 보호 모드 등에서 예외를 던질 수 있다.
export const storage = {
    get(key) {
        try { return localStorage.getItem(key); } catch { return null; }
    },
    set(key, value) {
        try { localStorage.setItem(key, value); } catch { }
    },
    remove(key) {
        try { localStorage.removeItem(key); } catch { }
    },
};
