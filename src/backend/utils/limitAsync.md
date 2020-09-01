# 在使用 async .. await 时控制并发数

在使用 async .. await + Promise 执行异步过程的时候，要不然就是依序执行，要不然就是 Promise.all 所有一起并发执行。如果想要以固定数量的并发数来执行任务队列很麻烦。

这里有个简单的方式（其中用到了 limitAsync.ts 中的封装函数）。

示例代码：
```js
function wait(n) {
    return new Promise( resolve => setTimeout( () => resolve(n), n ) );
}

(async () => {
    console.log('begin');
    // 同时执行的任务并发计数
    let count = 0;
    let ret = await limitAsync([100, 3500, 1000, 10, 2000, 500, 800, 1300], (async (n) => {
        count++;
        console.log('count : ' + count, n);
        let ret = await wait(n);
        count--;
        console.log('finish', ret);
    }), 3); // 这里设置为并发3路
    console.log('done', ret);
})();
```

输出内容：
```
begin
count : 1 100
count : 2 3500
count : 3 1000
finish 100
count : 3 10
finish 10
count : 3 2000
finish 1000
count : 3 500
finish 500
count : 3 800
finish 2000
count : 3 1300
finish 800
finish 1300
finish 3500
done undefined
```

可以看到，开始后始终是最多同时有3个任务并发执行（count: 3），当一个任务执行完后马上填充一个新的任务。
