
/**
 * 单个任务的处理函数，返回一个 promise
 */
declare type TaskHandlerFunction<T> = (task: T) => Promise<void>;

/**
 * 限制并发数的异步调用
 * @param tasks 所有的异步任务处理函数的参数
 * @param handler 单个任务的处理函数，返回一个promise
 * @param limit 并发数
 */
export default function limitAsync<T>(tasks: T[], handler: TaskHandlerFunction<T>, limit: number): Promise<void> {
    // 对数组做一个拷贝
    const sequence = ([] as T[]).concat(tasks);
    let promises = [];

    // 根据并发请求到最大数创建并行任务
    promises = sequence.splice(0, limit).map((task: T, index: number) => {
        // 这里返回的 index 是任务在 promises 的脚标，用于在 Promise.race 之后找到完成的任务脚标
        return handler(task).then(() => index);
    });

    return (async function loop(): Promise<void> {
        let p = Promise.race(promises);
        for (let i = 0; i < sequence.length; i++) {
            const retIndex = await p;
            // 这里在一个任务完成时，根据角标重新填充任务
            promises[retIndex] = handler(sequence[i]).then(() => retIndex);
            p = Promise.race(promises);
        }
        // 等待剩下的所有异步任务执行完成（以便外部如果需要的话可以进行await）
        await Promise.all(promises);
    })();
}
