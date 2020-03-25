
export function htmlStringToDOM(htmlStr: string): HTMLCollection {
    const parser = new DOMParser();
    const htmlDoc = parser.parseFromString(htmlStr.trim(), 'text/html');
    return htmlDoc.body.children;
}

export abstract class MsgBoxBase {
    protected _rootEl: HTMLDivElement;

    constructor(html: string) {
        const elms = htmlStringToDOM(html);
        this._rootEl = elms[0] as HTMLDivElement;
    }

    show(): void {
        document.body.appendChild(this._rootEl);
    }
    
    close(): void {
        document.body.removeChild(this._rootEl);
        delete this._rootEl;
    }
}

