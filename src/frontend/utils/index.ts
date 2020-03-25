
// 字典类型
type Dict<V> = { [k in string]: V; };

// 拆分后的 URL 参数对
const urlParams: Dict<string> = {};

if (location.search) {
    const paramArr = location.search.split(/[?&]/);
    paramArr.forEach((s: string) => {
        const paramPair = s.split('=');
        urlParams[paramPair[0]] = paramPair[1];
    });
}

/**
 * 获取当前页面的 URL 参数值
 * @param name 参数名
 */
export function getPageUrlParam(name: string): string | undefined {
    return urlParams[name];
}
