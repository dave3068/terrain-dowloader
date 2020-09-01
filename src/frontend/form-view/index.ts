
import axios from 'axios';
// import qs from 'qs';
// import socketio from "socket.io-client";

import { getPageUrlParam } from '../utils';
import { showConfirm, showProgress, Progress, showError } from '../msgbox';
import { mapView } from '../map-view';


// 默认 Cesium token 值
// const defaultToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyYmFmMDZjZi03ZTIzLTRmNDYtYmM4MS1hZmUyOTNlZWQ4N2MiLCJpZCI6MjU5LCJzY29wZXMiOlsiYXNyIiwiZ2MiXSwiaWF0IjoxNTgwNzQ2MDQzfQ.I05JcRTUCUA1RWX2y0oQa_p4dFV6tgaAKHrCU5AjlgI';
// const defaultToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwNjk5ODcyYS00MWMyLTQ1NjctYTRhYS0zMmM3ZjYzMGM2ZGEiLCJpZCI6MjU5LCJzY29wZXMiOlsiYXNyIiwiZ2MiXSwiaWF0IjoxNTkxMDI3NDUwfQ.xUBBQH34cd86pfNMSQ6tBBelRx3g_RS51-nSUFlZq24';
const defaultToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3N2JjMzBlOC1hZTdjLTQwZDItOTkxYi05M2JhMTI5ZGM0YWYiLCJpZCI6MjU5LCJzY29wZXMiOlsiYXNyIiwiZ2MiXSwiaWF0IjoxNTk2NDY1OTgyfQ.5YL6fQO9PaD4pomg0ivU1sD1FbFt1aCqzNXUcfk1eZw';

// 后台服务的基准路径
const baseUrl = `http://localhost:${getPageUrlParam('port')}/`;

const initVarsActionUrl = baseUrl + 'init-vars';
const downloadActionUrl = baseUrl + 'start-download';
const preDownloadActionUrl = baseUrl + 'pre-download';
const selectFolderActionUrl = baseUrl + 'select-folder';

// 当前选中的保存目录
let currentFolder = '';



/** 表单上的各个元素 */
interface FromElms {
    tokenTxt: HTMLInputElement;
    rectBtn: HTMLButtonElement;
    storeBtn: HTMLButtonElement;
    downloadBtn: HTMLButtonElement;
}

/** 磁盘信息 */
interface DiskSpaceInfo {
    name: string;
    free: number;
    total: number;
}

/** 通用请求返回包格式定义 */
interface CommonResponse {
    result: 'ok' | 'error';
    message?: string;
}
/** 初始数据返回包 */
interface InitVarsResponse extends CommonResponse {
    vars: {
        defaultDownloadDir: string;
    };
}
/** 预下载返回包 */
interface PreDownloadResponse extends CommonResponse {
    storeSize: [number, number];
    diskSpace: DiskSpaceInfo;
}


// 简化存储空间数据
function formatFileSize(v: number): string {
    // 存储空间单位
    const U = 'KMGTPEZY'.split('');
    U.unshift('');
    let unitIdx = 0;
    while (v > 1024) {
        v /= 1024;
        unitIdx++;
    }
    return Math.round(v) + U[unitIdx];
}


// 使用初始数据填充表单
async function getInitVars(): Promise<void> {
    const ret = await axios.get(initVarsActionUrl);
    currentFolder = (ret.data as InitVarsResponse).vars.defaultDownloadDir;
}

// 获得预计的存储需求
async function getStorageInfo(token: string): Promise<PreDownloadResponse> {
    const mbr = mapView.getShapeMBR();
    const ret = await axios.post(preDownloadActionUrl, {
        "token": token,
        storeDir: currentFolder,
        rect: mbr,
    });
    return ret.data;
}

// 开始下载
async function startDownload(token: string): Promise<CommonResponse> {
    console.log(token);
    //
    const mbr = mapView.getShapeMBR();
    console.log( mbr );
    //
    // const ret = await axios.get(downloadActionUrl + '?' + qs.stringify({ "token": token }));
    // const ret = await axios.post(downloadActionUrl, qs.stringify({ "token": token }));
    // const ret = await axios.post(downloadActionUrl, qs.stringify({ "token": token }), {
    //     headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    // });
    const ret = await axios.post(downloadActionUrl, {
        "token": token,
        storeDir: currentFolder,
        rect: mbr
    });
    return ret.data;
}



let currentProgress: Progress;

type ProgressNotify = { type: 'done' } | {
    type: 'update';
    current: number;
    total: number;
};

// const socket = socketio.connect(baseUrl);
// socket.on('connect', function() {
//     socket.emit('join', 'Hello World from client');
// });
// socket.on('download', (o: ProgressNotify)=>{
//     if (!o) return;
//     if (o.type == "update") {
//         let percent = o.current / o.total;
//         if (isNaN(percent)) percent = 0;
//         currentProgress?.update(percent);
//         currentProgress?.message("正在下载 " + (100 * percent).toFixed(1) + "%");
//     } else if (o.type == "done") {
//         currentProgress.close();
//     }
// });


// SSE 订阅后台事件
const es = new EventSource(baseUrl + 'events');
es.addEventListener('message', (evt: MessageEvent): void => {
    // console.log('message', evt);
    const msg = JSON.parse(evt.data);
    if (!msg) return;
    if (msg.type == 'download') {
        const o = msg.data;
        if (o?.type == 'update') {
            let percent = o.current / o.total;
            if (isNaN(percent)) percent = 0;
            currentProgress?.update(percent);
            currentProgress?.message("正在下载 " + (100 * percent).toFixed(1) + "%");
        } else if (o?.type == "done") {
            currentProgress?.close();
            showConfirm(`下载完成<br>保存目录 <span style="max-width:120px;" class="cut-text">${currentFolder}</span>`);
        } else if (o?.type == "error") {
            currentProgress?.close();
            showError(o?.message);
        }
    }
});



// 下载
async function downloadAction(form: FromElms): Promise<void> {
    const token = form.tokenTxt.value;
    const req = await getStorageInfo(token);
    if (req.result != 'ok') {
        console.error(req.message);
        return;
    }
    const msg = `
    预计需要 ${formatFileSize(req.storeSize[0])} ~ ${formatFileSize(req.storeSize[1])} 的磁盘空间。<br/>
    保存目录 <span style="max-width:120px;" class="cut-text">${currentFolder}</span>，剩余磁盘空间 ${formatFileSize(req.diskSpace.free)}<br/>
    确认是否开始下载？
    `;
    const cfm = await showConfirm(msg);
    if (cfm == 'ok') {
        currentProgress = showProgress("正在开始下载")
        const ret = await startDownload(token);
        if ('ok' != ret.result) {
            currentProgress.close();
            showError(ret.message as string);
        }
    }
}

// 选择保存目录
async function selectStorageAction(): Promise<void> {
    const ret = await axios.post(selectFolderActionUrl, {
        current: currentFolder
    });
    console.log(ret);
    if (ret.data.path && ret.data.path.length) {
        currentFolder = ret.data.path[0];
    }
}

// 开始拉框绘制
function startDrawRect(): void {
    console.log('draw rect');
    mapView.startDrawRect();
}

/**
 * 初始化表单
 */
export function renderForm(): void {
    const form: FromElms = {
        tokenTxt: document.getElementById('token') as HTMLInputElement,
        rectBtn: document.getElementById('rect') as HTMLButtonElement,
        storeBtn: document.getElementById('storeDir') as HTMLButtonElement,
        downloadBtn: document.getElementById('download') as HTMLButtonElement,
    };
    form.tokenTxt.value = defaultToken;

    form.rectBtn.addEventListener('click', () => startDrawRect());
    form.storeBtn.addEventListener('click', () => selectStorageAction());

    form.downloadBtn.addEventListener('click', () => downloadAction(form));
    form.downloadBtn.disabled = mapView.isShapesEmpty;
    mapView.onAddOrRemoveShape = (empty: boolean): void => {
        form.downloadBtn.disabled = empty;
    };

    getInitVars();
}
