import https from "https";
import http from "http";
import Log from "./log";
import converter from 'swagger2openapi';

/**
 * 获取 schema 文件，也就是 openAPI 文件
 * @param schemaPath 文件路径，可以是本地文件路径，也可以是网络路径
 */
export const getSchema = async (schemaPath: string) => {
    // 如果 schemaPath 以 'http' 开头，表示是网络路径
    if (schemaPath.startsWith('http')) {
        // 根据路径选择 http 或 https 协议
        const protocol = schemaPath.startsWith('https:') ? https : http;
        try {
            // 创建一个不验证 SSL 证书的代理
            const agent = new protocol.Agent({
                rejectUnauthorized: false,
            });
            // 使用 fetch 获取网络资源，并解析为 JSON
            const json = await fetch(schemaPath, {agent} as any).then((rest) => rest.json());
            return json;
        } catch (error) {
            // 捕获错误并记录日志
            Log('❌fetch openapi error:', error);
        }
        return null;
    }
    // 如果是本地文件路径，首先检查缓存中是否存在该文件，如果存在则删除缓存
    if (require.cache[schemaPath]) {
        delete require.cache[schemaPath];
    }
    // 使用 require 加载本地文件
    const schema = require(schemaPath);
    return schema;
};
/**
 * 获取并转换 OpenAPI 配置
 * @param schemaPath 文件路径，可以是本地文件路径，也可以是网络路径
 * @returns 转换后的 OpenAPI 配置对象
 */
export const getOpenAPIConfig = async (schemaPath: string) => {
    // 获取 schema 文件
    const schema = await getSchema(schemaPath);
    // 如果 schema 获取失败，返回 null
    if (!schema) {
        return null;
    }
    // 将 schema 转换为 OpenAPI 格式
    const openAPI = await converterSwaggerToOpenApi(schema);
    return openAPI;
};

/**
 * 将 Swagger 对象转换为 OpenAPI 对象
 * @param swagger Swagger 对象
 * @returns 转换后的 OpenAPI 对象
 */
const converterSwaggerToOpenApi = (swagger: any) => {
    // 如果对象不是 Swagger 格式，直接返回对象
    if (!swagger.swagger) {
        return swagger;
    }
    // 使用 swagger2openapi 库进行转换
    return new Promise((resolve, reject) => {
        converter.convertObj(swagger, {}, (err, options) => {
            // 记录转换日志
            Log(['💺 将 Swagger 转化为 openAPI']);
            if (err) {
                // 如果转换出错，拒绝 Promise 并返回错误
                reject(err);
                return;
            }
            // 成功转换后，解析并返回 OpenAPI 对象
            resolve(options.openapi);
        });
    });
};
