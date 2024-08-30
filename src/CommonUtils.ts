/**
 * 获取 import 语句 如果用户传入了 import 语句则使用用户传入的 import 语句 否则使用默认的 import umi 语句
 * @param requestLibPath 用户传入的 import 语句 可以不带 import，直接写 request 的路径
 */
export const getImportStatement = (requestLibPath: string,requestLibrary:string) => {
    if (requestLibPath && requestLibPath.startsWith('import')) {
        return requestLibPath;
    }
    if (requestLibPath||requestLibrary!=='custom') {
        return `import request from '${requestLibPath??requestLibrary}'`;
    }

    return `import { request } from "umi"`;
};
    