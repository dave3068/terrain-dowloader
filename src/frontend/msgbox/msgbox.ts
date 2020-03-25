
import { MsgBoxBase } from "./commons";

export type MsgRet = "ok" | "cancel";

const msgBoxHtmlStr = `<div class="msgbox-wrap">
    <div class="msgbox-bgcover"></div>
    <div class="msgbox">
        <div class="content"></div>
        <div class="button-bar">
            <button class="btn-ok">确定</button>
            <button class="btn-cancel">取消</button>
        </div>
    </div>
</div>`;

type EvtCb = () => void;

/** 消息框 */
export class MsgBox extends MsgBoxBase {
    // private _bgEl: HTMLDivElement;
    private _contentEl: HTMLDivElement;
    private _okBtn: HTMLButtonElement;
    private _cancelBtn: HTMLButtonElement;

    private _okcb: EvtCb | undefined;
    private _cancelcb: EvtCb | undefined;

    constructor(msg: string) {
        super(msgBoxHtmlStr);
        //
        // this._bgEl = this._rootEl.querySelector('.msgbox-bgcover') as HTMLDivElement;
        this._contentEl = this._rootEl.querySelector('.content') as HTMLDivElement;
        this._contentEl.innerHTML = msg;
        this._okBtn = this._rootEl.querySelector('.btn-ok') as HTMLButtonElement;
        this._cancelBtn = this._rootEl.querySelector('.btn-cancel') as HTMLButtonElement;
        //
        this._contentEl.querySelectorAll('.cut-text').forEach(e => {
            (e as HTMLElement).title = (e as HTMLElement).innerText;
        });
    }

    public show(): Promise<MsgRet> {
        super.show();
        //
        return new Promise<MsgRet>((resolve) => {
            this._okcb = (): void => {
                resolve('ok');
                this.close();
            };
            this._okBtn.addEventListener('click', this._okcb);
            this._cancelcb = (): void => {
                resolve('cancel');
                this.close();
            };
            this._cancelBtn.addEventListener('click', this._cancelcb);
        });
    }

    public close(): void {
        this._okcb && this._okBtn.removeEventListener('click', this._okcb);
        this._cancelcb && this._cancelBtn.removeEventListener('click', this._cancelcb);
        this._okcb = undefined;
        this._cancelcb = undefined;
        //
        super.close();
    }
}
