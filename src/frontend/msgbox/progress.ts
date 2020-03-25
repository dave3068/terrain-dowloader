
import { MsgBoxBase } from "./commons";

const progressHtmlStr = `<div class="msgbox-wrap">
<div class="msgbox-bgcover"></div>
<div class="msgbox">
    <div class="content"></div>
    <div class="progress">
        <div class="current"></div>
    </div>
</div>
</div>`;

/** 下载进度条 */
export class Progress extends MsgBoxBase {
    private _contentEl: HTMLDivElement;
    private _progressEl: HTMLDivElement;
    private _currentEl: HTMLDivElement;

    /**
     * @param message 需要显示的消息内容
     */
    constructor(message?: string) {
        super(progressHtmlStr);
        //
        this._contentEl = this._rootEl.querySelector('.content') as HTMLDivElement;
        this._progressEl = this._rootEl.querySelector('.progress') as HTMLDivElement;
        this._currentEl = this._progressEl.querySelector('.current') as HTMLDivElement;
        //
        message && this.message(message);
        this.show();
    }

    /**
     * 更新消息内容
     * @param message 消息内容，支持 html
     */
    message(message: string): void {
        this._contentEl.innerHTML = message;
    }

    /**
     * 更新进度
     * @param percent 当前进度，0~1
     */
    update(percent: number): void {
        this._currentEl.style.width = (percent * 100) + '%';
    }

}
