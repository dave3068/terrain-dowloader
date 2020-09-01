
/** 下载配置信息 */
export interface DownloadConfig {
    token: string;
    storeDir: string;
    rect: [number, number, number, number];
}

/** 下载进度事件类型 */
export type DownlaodEventType = "update" | "done" | "error";

/** 下载进度回调 */
export interface DownloadEvent {
    (type: "update", current: number, total: number): void;
    (type: "error", message: string): void;
    (type: "done"): void;
}

/** 下载进度对象 */
export interface DownloadProgress {
    totalTiles: number;
    downloaded: number;
    errorCount: number;
    eventCallback?: DownloadEvent;
}


export interface Bounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

/** 待下载的瓦片范围，一个层级可能有多个不想接的范围 */
export interface TileBounds {
    level: number;
    bounds: Bounds[];
}

/** 瓦片数据块 */
export interface TileData {
    level: number;
    x: number;
    y: number;
    contentBytes: number;
    data?: Buffer;
}


export type Point = [number, number];

export class Rectangle {
    west: number;
    south: number;
    east: number;
    north: number;

    constructor(west: number, south: number, east: number, north: number) {
        this.west = west;
        this.south = south;
        this.east = east;
        this.north = north;
    }

    get width(): number {
        let east = this.east;
        const west = this.west;
        if (east < west) {
            east += 360;
        }
        return east - west;
    }
    get height(): number { return this.north - this.south; }
}
