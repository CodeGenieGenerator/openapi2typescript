## 介绍

[![GitHub Repo stars](https://img.shields.io/github/stars/CodeGenieGenerator/openapi2typescript?style=social)](https://github.com/CodeGenieGenerator/openapi2typescript)
[![npm (scoped)](https://img.shields.io/npm/v/yunfeidog-openapi2typescript)](https://www.npmjs.com/package/yunfeidog-openapi2typescript)
![GitHub tag (latest SemVer pre-release)](https://img.shields.io/github/v/tag/CodeGenieGenerator/openapi2typescript?include_prereleases)

根据 [OpenApi3](https://swagger.io/blog/news/whats-new-in-openapi-3-0/) 文档生成 request 请求代码。

如果你使用 [umi](https://umijs.org)
,你可以使用[@umijs/plugin-openapi](https://www.npmjs.com/package/@umijs/plugin-openapi) 插件。
本项目参考了：https://github.com/chenshuai2144/openapi2typescript 在此基础上进行了一些修改。
新增功能如下：

| 状态 | 说明                              |
|----|---------------------------------|
| ✅  | 支持用户自定义接口模版                     |
| ✅  | 系统内置多种请求库模版，如：axios、umi-request |
| ✅  | 接口文件名以xxxController.ts命名        |

## 使用

```shell
pnpm i --save-dev @yunfeidog/openapi2typescript
```

在项目根目录新建 ```openapi.config.ts```

```ts
import {generateService} from "@yunfeidog/openapi2typescript";

generateService({
    schemaPath: `${__dirname}/test/openapi.json`,
    serversPath: './test/gen/umi',
    requestLibrary: 'umi',
    customServicePath: 'test/custom-service-template'
});


```

供公司使用:

```ts
import {generateService} from "@yunfeidog/openapi2typescript";

let service = ['auth', 'baas', 'docshare', 'did', 'generator', 'governance']
for (let i = 0; i < service.length; i++) {
    generateService({
        schemaPath: `http://192.168.2.141:18001/${service[i]}/v3/api-docs`,
        serversPath: `./casll/${service[i]}`,
        requestLibrary: 'axios',
        requestImportStatement: 'import { request } from "@/utils/http"',
    });
}

```

在 ```package.json``` 的 ```script``` 中添加 api: ```"openapi": "ts-node openapi.config.ts",```

生成api

```shell
pnpm run openapi
```

## 参数

| 属性                     | 必填 | 备注                                             | 类型                                             | 默认值                  |
|------------------------|----|------------------------------------------------|------------------------------------------------|----------------------|
| requestLibPath         | 否  | 自定义请求方法路径                                      | string                                         | -                    |
| requestLibrary         | 是  | 默认支持的请求库                                       | 'umi' 、'axios'、  'fetch'、 'request'、  'custom' | umi                  |
| customServicePath      | 是  | 如果requestLibrary为custom，那么需要传入自定义的Controller位置 | string                                         |                      |
| requestOptionsType     | 否  | 自定义请求方法 options 参数类型                           | string                                         | {[key: string]: any} |
| requestImportStatement | 否  | 自定义请求方法表达式                                     | string                                         | -                    |
| apiPrefix              | 否  | api 的前缀                                        | string                                         | -                    |
| serversPath            | 否  | 生成的文件夹的路径                                      | string                                         | -                    |
| schemaPath             | 否  | Swagger 2.0 或 OpenAPI 3.0 的地址                  | string                                         | -                    |
| projectName            | 否  | 项目名称                                           | string                                         | -                    |
| namespace              | 否  | 命名空间名称                                         | string                                         | API                  |
| mockFolder             | 否  | mock目录                                         | string                                         | -                    |
| enumStyle              | 否  | 枚举样式                                           | string-literal \| enum                         | string-literal       |
| nullable               | 否  | 使用null代替可选                                     | boolean                                        | false                |
| dataFields             | 否  | response中数据字段                                  | string[]                                       | -                    |
| isCamelCase            | 否  | 小驼峰命名文件和请求函数                                   | boolean                                        | true                 |
| hook                   | 否  | 自定义 hook                                       | [Custom Hook](#Custom-Hook)                    | -                    |

## Custom Hook

| 属性                     | 类型                                                                                                                                                                          | 说明                                                |
|------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------|
| afterOpenApiDataInited | (openAPIData: OpenAPIObject) => OpenAPIObject                                                                                                                               | -                                                 |
| customFunctionName     | (data: APIDataType) => string                                                                                                                                               | 自定义请求方法函数名称                                       |
| customTypeName         | (data: APIDataType) => string                                                                                                                                               | 自定义类型名称                                           |
| customClassName        | (tagName: string) => string                                                                                                                                                 | 自定义类名                                             |
| customType             | (<br>schemaObject: SchemaObject \| undefined,<br>namespace: string,<br>originGetType:(schemaObject: SchemaObject \| undefined, namespace: string) => string,<br>) => string | 自定义获取类型 <br> *返回非字符串将使用默认方法获取type*                |
| customFileNames        | (<br>operationObject: OperationObject,<br>apiPath: string,<br>_apiMethod: string,<br>) => string[]                                                                          | 自定义生成文件名，可返回多个，表示生成多个文件. <br> *返回为空，则使用默认的获取方法获取* |
