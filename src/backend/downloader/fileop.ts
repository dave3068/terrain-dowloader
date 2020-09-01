
import fs from 'fs';
import path from 'path';
import { Stream } from 'stream';


/** 如果上级目录不存在则创建 */
export function mkParentDirIfNotExists(filePath: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

/** 将数据保存到JSON文件，如果已存在则不覆盖 */
export function saveJsonToFile(filePath: string, data: object, overwrite?: boolean): void {
    mkParentDirIfNotExists(filePath);
    if (overwrite || !fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, Buffer.from(JSON.stringify(data), 'utf8'));
    }
}

/** 从文件读取JSON数据 */
export function readJsonFromFile(filePath: string): object {
    const str = fs.readFileSync(filePath, { encoding: 'utf8' });
    return JSON.parse(str);
}

/** 将数据保存到文件，如果已存在则不覆盖 */
export function saveStreamToFile(filePath: string, stream: Stream, overwrite?: boolean): Promise<void> {
    mkParentDirIfNotExists(filePath);
    if (overwrite || !fs.existsSync(filePath)) {
        const wstream = fs.createWriteStream(filePath, { emitClose: true });
        // const ret = new Promise<void>((resolve) => {
        //     wstream.on('close', ()=>resolve());
        // });
        stream.pipe(wstream);
        // return ret;
        return Promise.resolve();
    }
    return Promise.reject();
}

/** 删除文件 */
export function deleteFile(filePath: string): void {
    if (fs.existsSync(filePath)) {
        fs.unlink(filePath, err => {
            console.error('delete file failed', err);
        });
    }
}
