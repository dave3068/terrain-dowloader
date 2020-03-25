
import http from 'http';
import { EventEmitter } from 'events';
import express from 'express';
// import socketio from 'socket.io';
import cors from 'cors';
import bodyPaser from 'body-parser';

import { dialog } from 'electron';

import globalvars from "../globalvars";
import { getDiskSpaceByPath } from "../utils/diskspace";
import { downloadManager, defaultDownloadDir, DownloadEvent, DownlaodEventType } from "../downloader";


declare interface Error {
    code: string;
}

const defaultPort = 3060;

// const corsOptions: cors.CorsOptions = {
//     origin: '*',
//     methods: [ 'GET', 'POST', 'PUT', 'OPTIONS' ]
// };

class BGServer {
    private app: express.Express;
    private server: http.Server;
    // private io: socketio.Server;
    // private sockets: socketio.Socket[];
    private stream = new EventEmitter();

    private _port = 0;

    public get port(): number { return this._port; }

    get ready(): boolean { return this._port > 0; }
    
    private _readyPromise: Promise<boolean>;

    get readyPromise(): Promise<boolean> | undefined {
        return this._readyPromise;
    }

    start (): void {
        this.app = express();
        this.app.use(cors());
        // this.app.options('*', cors());
        this.app.use(bodyPaser.json());
        this.app.use(bodyPaser.urlencoded({ extended: true }));
        this.server = http.createServer(this.app);
        // this.io = socketio(this.server);
        //
        let _resolve: (value: boolean) => void | undefined;
        this._readyPromise = new Promise<boolean>((resolve) => {
            _resolve = resolve;
        });
        //
        let port = defaultPort;
        this.server.on('error', (err: Error) => {
            if (err.code == 'EADDRINUSE') {
                port++;
                if (port >= 65535) {
                    console.error('No retrying port left ~ ~');
                    _resolve && _resolve(false);
                    return;
                }
                console.log('Address in use, retrying... ' + port);
                this.server.close();
                this.server.listen(port);
            }
        });
        this.server.once('listening', ()=>{
            this._port = port;
            _resolve && _resolve(true);
            console.log('BG listening at ' + port);
        });
        this.server.listen(port);
        //
        this.router();
        this.bind();
    }

    stop(): void {
        if (this.server && this.server.listening) {
            this.server.close();
        }
        // if (this.io) {
        //     this.sockets.splice(0);
        //     this.io.close();
        // }
    }

    router(): void {
        // 提供一些界面初始数据
        this.app.get('/init-vars', (req, res) => {
            res.json({
                result: 'ok',
                vars: {
                    defaultDownloadDir: defaultDownloadDir
                }
            });
        });
        // 在开始下载前先预计算磁盘需求
        this.app.post('/pre-download', async (req, res) => {
            res.json({
                result: 'ok',
                diskSpace: await getDiskSpaceByPath(req.body.storeDir),
                storeSize: await downloadManager.calcTileStoreSizeRange(req.body)
            });
        });
        // 开始下载
        this.app.post('/start-download', async (req, res) => {
            console.log('POST', req.body); // body 中的参数使用 req.body
            //
            const progress = await downloadManager.startDownload(req.body);
            if (progress) {
                if (progress.downloaded >= progress.totalTiles) {
                    this.notify('download', { type: 'done' });
                } else {
                    progress.eventCallback = ((type: DownlaodEventType, current: number, total: number): void => {
                        if (type == 'done') {
                            this.notify('download', { type: 'done' });
                            progress.eventCallback = undefined;
                        } else if (type == 'update') {
                            this.notify('download', { type: 'update', current: current, total: total });
                        }
                    }) as DownloadEvent;
                }
            }
            //
            res.json({ result: 'ok' });
        });
        // 弹出文件选择框
        this.app.post('/select-folder', async (req, res) => {
            // req.body
            if (globalvars.mainWindow) {
                const ret = await dialog.showOpenDialog(globalvars.mainWindow, {
                    properties: [ 'openDirectory' ],
                    defaultPath: req.body.current
                });
                res.json({result: 'ok', path: ret.filePaths});
            } else {
                res.json({result: 'error', message: 'mainWindow not ready'});
            }
        });
    }

    bind(): void {
        // this.io.on('connection', (socket: socketio.Socket) => {
        //     console.log('socket.io connection ' + socket.id);
        //     this.sockets.push(socket);
        //     setInterval(()=>{
        //         socket.emit('hello', 'abc');
        //     }, 2000);
        // });
        // 处理到 /events 的请求，使用 SSE 向前端派发事件
        this.app.get('/events', (req, res) => {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });
            this.stream.on('push', (evt, data) => {
                res.write('event: message\ndata: ' + JSON.stringify({ type: evt, data: data}) + "\n\n");
            });
            //
            res.write('event: message\nretry: 10000\n\n');
        });
        // 心跳
        setInterval(()=>{
            this.notify("hi", {a:"123"});
        }, 10000);
    }

    notify(event: string, o: object): void {
        // this.sockets.forEach(fn => fn.emit(event, o));
        this.stream.emit('push', event, o);
    }

}

export default new BGServer;

