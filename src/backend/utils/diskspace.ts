
// import os from 'os';
import cp from 'child_process';

/** 磁盘信息 */
interface DiskSpaceInfo {
    name: string;
    free: number;
    total: number;
}

function execAsync(cmd: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        cp.exec(cmd, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve(stdout || stderr);
            }
        });
    });
}

/**
 * 获取机器上所有磁盘空间信息
 */
export async function listAllDiskSpace(): Promise<DiskSpaceInfo[]> {
    if (process.platform == 'win32') { // Run wmic for Windows.
        const s = await execAsync('wmic logicaldisk get size,freespace,caption');
        /*
Caption  FreeSpace     Size
C:       42134843392   107380994048
E:       71546368000   298511826944
F:       76487585792   297442541568
G:       103035793408  296866770944 
         */
        // 按行列分割
        return s.trim().split('\n').map(v => v.trim().split(/\s+/))
            // 去除首行、空行
            .filter((v, i) => i > 0 && v && v.length > 2)
            // 转换成结果对象
            .map(v => ({
                name: v[0],
                free: parseInt(v[1]),
                total: parseInt(v[2])
            }));
    } else if (process.platform == 'linux') { // Run df for Linux.
        const s = await execAsync('df');
        /*
Filesystem     1K-blocks     Used Available Use% Mounted on
/dev/sda5        5160576  2102576   2795856  43% /
tmpfs            2009296        8   2009288   1% /dev/shm
/dev/sda1         198337    39942    148155  22% /boot
/dev/sda6        5160576  1142076   3756356  24% /home
/dev/sda8       67912272 23271356  41191112  37% /icooper
/dev/sda2       10321208 10304816         0 100% /usr
/dev/sda3       10321208  1179320   8617600  13% /var
         */
        return s.trim().split('\n').map(v => v.trim().split(/\s+/))
            // 去除首行、空行
            .filter((v, i) => i > 0 && v && v.length > 5)
            // 转换成结果对象
            .map(v => ({
                name: v[5],
                free: parseInt(v[3]),
                total: parseInt(v[3]) + parseInt(v[2])
            }));
    } else {
        console.error('not support!');
    }
    return [];
}

/**
 * 根据文件路径获取所在磁盘的空间信息
 * @param path 文件路径
 */
export async function getDiskSpaceByPath(path: string): Promise<DiskSpaceInfo | undefined> {
    const allInfo = await listAllDiskSpace();
    const findInfo = allInfo.filter(v => path.startsWith(v.name));
    return findInfo.length ? findInfo[0] : undefined;
}

