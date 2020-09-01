
import { CesiumTerrain } from "./CesiumTerrain";
import { DownloadConfig, TileBounds, DownloadProgress, DownloadEvent, DownlaodEventType } from "./types";
import { defaultDownloadDir } from "./constants";
import { AxiosError } from "axios";

export { defaultDownloadDir, DownloadEvent, DownlaodEventType };



/** 下载管理 */
export class DownloadManager {
    terrain: CesiumTerrain = new CesiumTerrain;

    /** 下载前预计算磁盘空间需求 */
    async calcTileStoreSizeRange(config: DownloadConfig): Promise<[number, number]> {
        // if (await this.terrain.auth(config.token)) {
        //     await this.terrain.requestLayerJson();
        // }
        return this.terrain.calcTileStoreSizeRange(config);
    }

    /** 开始下载任务 */
    async startDownload(config: DownloadConfig): Promise<DownloadProgress | undefined> {
        //
        if (!this.terrain.authed) {
            if (await this.terrain.auth(config.token)) {
                await this.terrain.requestLayerJson();
            } else {
                const error = this.terrain.lastError as AxiosError;
                if (error.response && error.response.status == 401) {
                    console.error('Server Auth Failed: ', JSON.stringify(error.response.data));
                }
                return undefined;
            }
        }
        if (this.terrain.authed) {
            // this.terrain.requestTile(0, 0, 0); return;
            const tileBounds = this.terrain.calcTileBounds(config);
            // console.log(tileBounds);
            //
            const progress: DownloadProgress = {
                totalTiles: this.totalTiles(tileBounds),
                downloaded: 0,
                errorCount: 0
            };
            console.log('total tiles count : ', progress.totalTiles);
            // 放在异步函数中调用，让该方法尽快返回给前端
            (async function(self: DownloadManager): Promise<void> {
            // async 放在内层会导致并发数太多，所以去掉内层的 forEach
            // tileBounds.forEach((lb, z) => lb.bounds.forEach(async (b, i) => {
                for (let z = 0; z < tileBounds.length; z++) {
                    const lb = tileBounds[z];
                    for(let i = 0; i < lb.bounds.length; i++) {
                        const b = lb.bounds[i];
                        console.log('start level-bounds : ' + z + '-' + i);
                        for (let y = b.minY; y <= b.maxY; y++) {
                            for (let x = b.minX; x <= b.maxX; x++) {
                                try {
                                    // await this.terrain.requestTile(z, x, y);
                                    const data = await self.terrain.requestTile(z, x, y);
                                    if (data) {
                                        progress.downloaded++;
                                    } else {
                                        progress.errorCount++;
                                        if (progress.eventCallback) {
                                            progress.eventCallback('error', ''+self.terrain.lastError.message);
                                        }
                                    }
                                } catch (error) {
                                    progress.errorCount++;
                                    if (progress.eventCallback) {
                                        progress.eventCallback('error', ''+error.message);
                                    }
                                }
                                //
                                // if ((progress.downloaded + progress.errorCount) >= progress.totalTiles) {
                                //     console.log('finished download', progress.downloaded, progress.errorCount, progress.totalTiles);
                                //     progress.eventCallback && progress.eventCallback('done');
                                // } else {
                                progress.eventCallback && progress.eventCallback('update', progress.downloaded, progress.totalTiles);
                                // }
                            }
                        }
                        console.log('finish level-bounds : ' + z + '-' + i);
                    }
                }
                //
                console.log('finished download', progress.downloaded, progress.errorCount, progress.totalTiles);
                progress.eventCallback && progress.eventCallback('done');
            // }));
            }(this));
            //
            return progress;
        }
        return undefined;
    }

    async downloadTile(): Promise<void> {
        // TODO
    }

    // 计算待下载的瓦片总个数
    private totalTiles(tileBounds: TileBounds[]): number {
        return tileBounds.reduce((n, b) => 
            (n + b.bounds.reduce((n, c) =>
                (n + (c.maxX - c.minX + 1) * (c.maxY - c.minY + 1))
            , 0))
        , 0);
    }

}

/** 下载管理 */
export const downloadManager = new DownloadManager();
