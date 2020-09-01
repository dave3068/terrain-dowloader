
import { MsgRet, MsgBox } from "./msgbox";
import { Progress } from "./progress";

import "./msgbox.css";

export { MsgBox, Progress };


/** 显示一个确认提示框 */
export function showConfirm(msg: string): Promise<MsgRet> {
    return new MsgBox(msg).show();
}

/** 显示一个进度条 */
export function showProgress(message?: string): Progress {
    return new Progress(message);
}

/** 显示错误信息 */
export function showError(msg: string): Promise<MsgRet> {
    return new MsgBox(msg).show();
}
