
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import axios, { AxiosError } from "axios";

import { DownloadConfig, Bounds, TileBounds, TileData, Point } from "./types";
import { defaultDownloadDir } from "./constants";
import GeographicTilingScheme from "./GeographicTilingScheme";

import { saveJsonToFile, saveStreamToFile, deleteFile, readJsonFromFile } from "./fileop";

// Cesium官网地形服务的登录地址
const authUrl = "https://api.cesium.com/v1/assets/1/endpoint?access_token=";


/** 各层级有效瓦片范围 */
interface AvailableBounds {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
}

/** layer.json 的数据结构 */
interface LayerJson {
    name: string;
    version: string; // '1.2.0'
    format: string; // 'quantized-mesh-1.0'
    description: string;
    attribution: string;
    available: AvailableBounds[][]; // 各层级有效瓦片范围（每个层级有一个或多个范围）
    metadataAvailability: number; // 10
    bounds: [number, number, number, number]; // [ -180, -90, 180, 90 ]
    extensions: string[]; // [ 'bvh', 'watermask', 'metadata', 'octvertexnormals' ]
    minzoom: number; // 0
    maxzoom: number; // 19
    bvhlevels: number; // 6
    projection: string; // 'EPSG:4326'
    scheme: string; // 'tms'
    tiles: string[]; // [ '{z}/{x}/{y}.terrain?v={version}' ]
}


/** 判断两个矩形区域范围是否相交/相容 */
function boundsIntersect(a: AvailableBounds, b: Bounds): Bounds | undefined {
    const c: Bounds = {
        minX: Math.max(a.startX, b.minX),
        minY: Math.max(a.startY, b.minY),
        maxX: Math.min(a.endX, b.maxX),
        maxY: Math.min(a.endY, b.maxY)
    };
    if (c.minX <= c.maxX && c.minY <= c.maxY) {
        return c;
    }
    return undefined;
}



/**
 * Cesium 官网地形数据下载
 */
export class CesiumTerrain {
    tilingScheme: GeographicTilingScheme = new GeographicTilingScheme();

    downloadDir: string = defaultDownloadDir;

    httpAgent = new http.Agent({ keepAlive: true });
    httpsAgent = new https.Agent({ keepAlive: true });

    private _authToken: string;
    baseUrl: string;
    accessToken: string;
    authHeaders: object;
    layerJson: LayerJson;

    // 预计最小和最大的瓦片平均尺寸（用于预估下载量）
    _minTileFileSize = 20 * 1024;
    _maxTileFileSize = 90 * 1024;

    // TODO 根据配置项和信息来构造url
    _requestVertexNormals = true;
    _requestMetadata = true;
    _requestWaterMask = false;

    lastError: AxiosError | Error;

    /** 是否登录过 */
    get authed(): boolean {
        return !!this.accessToken;
    }

    /** 构造瓦片下载URL */
    makeTileUrl(level: number, x: number, y: number): string | undefined {
        if (!this.layerJson || !this.layerJson.tiles || !this.layerJson.tiles.length) {
            return undefined;
        }
        const templ = this.layerJson.tiles[0];
        return this.baseUrl + templ.replace('{z}', ''+level)
            .replace('{x}', ''+x)
            .replace('{y}', ''+y)
            .replace('{version}', this.layerJson.version)
            + '&extensions=octvertexnormals-metadata';
    }

    /** 根据经纬度区域分层级计算待下载的瓦片范围 */
    calcTileBounds(conf: DownloadConfig): TileBounds[] {
        const minzoom = this.layerJson?.minzoom || 0;
        const maxzoom = this.layerJson?.maxzoom || 15; // layer.json 中暂时只看到有0~15层数据
        const ret: TileBounds[] = [];
        // 先根据所选范围计算
        for (let i = minzoom; i <= maxzoom; i++) {
            const xMaxTiles = this.tilingScheme.getNumberOfXTilesAtLevel(i) - 1;
            const yMaxTiles = this.tilingScheme.getNumberOfYTilesAtLevel(i) - 1;
            let southWest: Point;
            let northEast: Point;
            if (i < 4) {
                // 0~3 层级下载所有瓦片（约10MB）
                southWest = this.tilingScheme.positionToTileXY(i, [-180, -90]);
                northEast = this.tilingScheme.positionToTileXY(i, [180, 90]);
            } else {
                // 其余层级按所选区域下载
                southWest = this.tilingScheme.positionToTileXY(i, [conf.rect[0], conf.rect[1]]);
                northEast = this.tilingScheme.positionToTileXY(i, [conf.rect[2], conf.rect[3]]);
            }
            const bounds = {
                minX: Math.min(southWest[0], northEast[0]),
                minY: Math.min(southWest[1], northEast[1]),
                maxX: Math.max(southWest[0], northEast[0]),
                maxY: Math.max(southWest[1], northEast[1])
            };
            // 往外扩一圈（将边缘纳入进来）
            bounds.minX = Math.max(0, bounds.minX - 1);
            bounds.minY = Math.max(0, bounds.minY - 1);
            bounds.maxX = Math.min(xMaxTiles, bounds.maxX + 1);
            bounds.maxY = Math.min(yMaxTiles, bounds.maxY + 1);
            //
            ret.push({
                level: i,
                bounds: [bounds]
            });
        }
        // 如果有 layerJson 的数据，则根据其中的范围数据去除无效区块
        if (this.layerJson && this.layerJson.available) {
            const avb = this.layerJson.available;
            if (ret.length > avb.length) {
                ret.splice(avb.length);
            }
            // 判断需下载的瓦片是否落在可用范围内
            avb.forEach((lb, i) => {
                const b = ret[i].bounds[0];
                ret[i].bounds = lb.map(ab => boundsIntersect(ab, b))
                    .filter(v => !!v) as Bounds[];
            });
        }
        return ret;
    }

    /** 计算预计的存储空间（最小、最大值） */
    calcTileStoreSizeRange(conf: DownloadConfig): [number, number] {
        const tileBounds = this.calcTileBounds(conf);
        let min = 0, max = 0;
        tileBounds?.forEach(v => v.bounds.forEach(v => {
            const total = (v.maxX - v.minX) * (v.maxY - v.minY);
            min += total * this._minTileFileSize;
            max += total * this._maxTileFileSize;
        }));
        return [min, max];
    }

    /**
     * 发起登录请求，获取后续请求使用的 token
     * @param token 开发包中的 token
     */
    async auth(token: string): Promise<boolean> {
        this._authToken = token;
        const url = authUrl + this._authToken;
        try {
            const ret = await axios.get(url, {
                // headers: { 'Cache-Control': 'no-cache' }
            });
            if (ret.status == 200 && ret.data.type == 'TERRAIN') {
                // console.log(ret.data);
                this.baseUrl = ret.data.url; // 'https://assets.cesium.com/1/'
                this.accessToken = ret.data.accessToken;
                this.authHeaders = {
                    'Authorization': 'Bearer ' + this.accessToken,
                    'Referer': 'http://127.0.0.1:8080/terrain.html',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36'
                };
                // 保存到文件（方便后续调试）
                const filePath = path.resolve(this.downloadDir, "auth.json");
                saveJsonToFile(filePath, ret.data);
                //
                return true;
            }
        } catch (error) {
            this.lastError = error;
            console.error(error);
        }
        return false;
    }

    /**
     * 获取并保存 layer.json 文件
     */
    async requestLayerJson(): Promise<boolean> {
        const filePath = path.resolve(this.downloadDir, "layer.json");
        const url = this.baseUrl + "layer.json";
        try {
            //
            if (fs.existsSync(filePath)) {
                this.layerJson = readJsonFromFile(filePath) as LayerJson;
                return true;
            }
            //
            const ret = await axios.get(url, {
                headers: this.authHeaders
            });
            if (ret.status == 200) {
                // console.log(ret.data);
                this.layerJson = ret.data;
                // save the layer.json file
                saveJsonToFile(filePath, ret.data);
                return true;
            }
        } catch (error) {
            this.lastError = error;
            console.error(error);
        }
        return false;
    }

    /** 获得瓦片保存路径 */
    tileStorePath(downloadDir: string, level: number, x: number, y: number): string {
        return path.resolve(downloadDir, ''+level, ''+x, y+'.terrain');
    }

    /**
     * 下载并保存地形切片
     */
    async requestTile(level: number, x: number, y: number): Promise<TileData | undefined> {
        const filePath = this.tileStorePath(this.downloadDir, level, x, y);
        const url = this.makeTileUrl(level, x, y) as string;
        try {
            // 如果本地存在该文件，则不必下载
            if (fs.existsSync(filePath)) {
                const stat = fs.statSync(filePath);
                return {
                    level: level,
                    x: x,
                    y: y,
                    contentBytes: stat.size,
                };
            }
            console.log(level, x, y, 'downloading');
            // 从网络下载该文件
            const ret = await axios.get(url, {
                headers: this.authHeaders,
                responseType: 'stream',
                httpAgent: this.httpAgent,
                httpsAgent: this.httpsAgent,
                timeout: 30000,
            });
            if (ret.status == 200) {
                const contentLength = parseInt( ret.headers['content-length'] );
                // 这个 contentLength 和真实的数据内容没有必然联系（传输gzip后的大小？）
                // save to local file
                // const data = Buffer.from(ret.data, 'binary');
                await saveStreamToFile(filePath, ret.data);
                console.log(level, x, y, 'downloaded');
                //
                return {
                    level: level,
                    x: x,
                    y: y,
                    contentBytes: contentLength,
                    data: ret.data
                };
            }
        } catch (error) { // { code:'ECONNRESET',syscall:'read',isAxiosError:true,message:"read ECONNRESET",config:{url:'http...'} }
            this.lastError = error;
            console.error(error);
            // 下载失败，删除该文件（如果存在）
            deleteFile(filePath);
        }
        return undefined;
    }


}

